import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

# Internal imports
from services.backend.api.alert_module.rules_manager import load_rules
from services.backend.api.alert_module.alert_manager import add_alert, get_alerts
from services.backend.api.billing.database import get_project_db_path
from services.backend.api.alert_module.event_engine import log_event as save_event_log
from services.backend.shared_state import READINGS, LAST_SEEN
try:
    from services.backend.api.email.email_service import send_email as _send_email
except ImportError:
    _send_email = None

_LINE_ALERT_MANAGER = None

# ============================================================
# STARTUP GRACE PERIOD
# หลัง server เริ่ม ไม่ส่งแจ้งเตือนช่วงนี้
# เพราะตอนเริ่มจะยังไม่มีข้อมูลครบ ต้องรอ poller เก็บ data ก่อน
# ============================================================
_ENGINE_START_TIME = time.time()
_STARTUP_GRACE_SECONDS = 180  # 3 นาที

# Projects Root
PROJECTS_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))

def _get_project_dir(project_id: str) -> str:
    return os.path.join(PROJECTS_ROOT, project_id)

def _get_alert_dir(project_id: str) -> str:
    return os.path.join(_get_project_dir(project_id), "alert")

def _get_active_alerts_path(project_id: str) -> str:
    return os.path.join(_get_alert_dir(project_id), "active_alerts.json")

def _get_alert_logs_path(project_id: str) -> str:
    return os.path.join(_get_alert_dir(project_id), "alert_logs.json")

def _get_device_status_path(project_id: str) -> str:
    return os.path.join(_get_alert_dir(project_id), "device_status.json")

def _is_in_grace_period() -> bool:
    return (time.time() - _ENGINE_START_TIME) < _STARTUP_GRACE_SECONDS

def load_alert_logs(project_id: str, limit: int = 100) -> List[Dict]:
    path = _get_alert_logs_path(project_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            logs = json.load(f)
        logs.sort(key=lambda x: x.get('time', ''), reverse=True)
        return logs[:limit]
    except Exception as e:
        print(f"Error loading alert logs: {e}")
        return []

def save_alert_logs(logs: list, project_id: str):
    """Save alert logs to JSON file (used by clear alerts endpoint)"""
    path = _get_alert_logs_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving alert logs: {e}")

def load_status(project_id: str) -> Dict:
    path = _get_device_status_path(project_id)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def save_status(project_id: str, status: Dict):
    path = _get_device_status_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(status, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving status: {e}")

def load_active_alerts(project_id: str) -> Dict:
    path = _get_active_alerts_path(project_id)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_active_alerts(active_alerts: Dict, project_id: str):
    path = _get_active_alerts_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, 'w') as f:
            json.dump(active_alerts, f, indent=2)
    except:
        pass

def _get_device_online_from_readings(project_id: str, dev_id: str) -> bool:
    """
    ตรวจสอบสถานะ Online โดยยึดตามตรรกะเดียวกับหน้า Web (ใช้ LAST_SEEN เป็นหลัก)
    - ถ้ามี LAST_SEEN: online = (now - last_seen) <= 300 วินาที
    - ถ้าไม่มี LAST_SEEN: พึ่งพา readings['online'] หรือ timestamp ใน readings
    """
    try:
        now_ts = time.time()
        last_seen_map = LAST_SEEN.get(project_id, {}) or {}
        last_seen_val = last_seen_map.get(str(dev_id))
        if last_seen_val is None:
            last_seen_val = last_seen_map.get(dev_id)
        if last_seen_val is not None:
            try:
                return (now_ts - float(last_seen_val)) <= 300
            except Exception:
                pass
    except Exception:
        pass
    
    readings = READINGS.get(project_id, {}) or {}
    dev_data = readings.get(str(dev_id)) or readings.get(dev_id) or {}
    
    if dev_data.get('online') is True:
        return True
    if dev_data.get('online') is False:
        return False
    
    ts = dev_data.get('timestamp')
    if ts:
        try:
            if isinstance(ts, str):
                last_seen_dt = datetime.fromisoformat(ts.replace(' ', 'T'))
            else:
                last_seen_dt = ts
            return (datetime.now() - last_seen_dt).total_seconds() <= 300
        except Exception:
            return False
    return False


# ============================================================
# DEBOUNCE / CONFIRMATION
# ============================================================
_offline_confirm_counters: Dict[str, int] = {}  # key: "project_device" -> count
_OFFLINE_CONFIRM_REQUIRED = 2  # ต้องตรวจเจอ Offline 2 ครั้ง (60 วิ) ถึงจะแจ้ง
_MIN_OFFLINE_SECONDS = 30       # ต้อง Offline อย่างน้อย 30 วิ ก่อนส่งแจ้งเตือน (กัน Flap)
_OFFLINE_COOLDOWN_SECONDS = 600 # กันสแปม: แจ้ง Offline ไม่เกินทุก 10 นาที/อุปกรณ์
_RECOVERY_COOLDOWN_SECONDS = 300 # กันสแปม: แจ้ง Recovery ไม่เกินทุก 5 นาที/อุปกรณ์

def check_offline_devices(project_id: str):
    """
    ตรวจสอบสถานะ online/offline ของอุปกรณ์
    
    STATE MACHINE + CONFIRMATION:
    1. Online -> Offline: ต้องเจอ 2 ครั้งติดกันถึงจะแจ้ง (ลด Noise)
    2. Offline -> Online: แจ้งทันที (Responsive)
    """
    if not project_id:
        return

    status_map = load_status(project_id)
    
    config_path = os.path.join(_get_project_dir(project_id), "ConfigDevice.json")
    if not os.path.exists(config_path):
        return

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except:
        return

    updated = False
    now = datetime.now()
    in_grace = _is_in_grace_period()
    
    # Flatten expected devices from config
    expected_devices = []
    for conv in config.get('converters', []):
        for dev in conv.get('devices', []):
            expected_devices.append(str(dev.get('id')))

    readings = READINGS.get(project_id, {})
    all_device_ids = set(expected_devices)
    
    for dev_id in all_device_ids:
        # Get existing status
        dev_status = status_map.get(dev_id, {
            "online": False, 
            "last_seen": None,
            "offline_since": None,
            "offline_notified": False,
            "_initialized": False,
            "_first_offline_detected_ts": None,
            "_last_offline_notify_ts": None,
            "_last_recovery_notify_ts": None
        })
        
        # ======== DETERMINE CURRENT ONLINE STATUS ========
        current_online = _get_device_online_from_readings(project_id, dev_id)
        
        # Get names for notification
        dev_name, conv_name = _get_device_info(project_id, dev_id)
        display_name = dev_name if dev_name else f"Device {dev_id}"
        
        # Get last_seen for display
        dev_data = readings.get(dev_id) or readings.get(str(dev_id))
        last_seen_str = dev_data.get('timestamp') if dev_data else None
        
        prev_online = dev_status.get('online', False)
        was_initialized = dev_status.get('_initialized', False)
        was_notified_offline = dev_status.get('offline_notified', False)
        confirm_key = f"{project_id}_{dev_id}"
        
        # ==============================
        # CASE 1: ครั้งแรกเจออุปกรณ์
        # ==============================
        if not was_initialized:
            dev_status['online'] = current_online
            dev_status['_initialized'] = True
            dev_status['last_seen'] = last_seen_str
            if not current_online:
                dev_status['offline_since'] = now.strftime("%Y-%m-%d %H:%M:%S")
                dev_status['offline_notified'] = False
                dev_status['_first_offline_detected_ts'] = now.timestamp()
            else:
                dev_status['offline_since'] = None
                dev_status['offline_notified'] = False
                dev_status['_first_offline_detected_ts'] = None
            _offline_confirm_counters[confirm_key] = 0
            # print(f"[ALERT INIT] {display_name}: {'ONLINE' if current_online else 'OFFLINE'}")
        
        # ==============================
        # CASE 2: สถานะปัจจุบัน = ONLINE
        # ==============================
        elif current_online:
            _offline_confirm_counters[confirm_key] = 0 # Reset counter
            
            if not prev_online:
                # 🟢 Offline -> Online (Recovery)
                dev_status['online'] = True
                dev_status['last_seen'] = last_seen_str
                dev_status['offline_since'] = None
                
                if was_notified_offline and not in_grace:
                    last_rec_ts = dev_status.get('_last_recovery_notify_ts')
                    if not last_rec_ts or (now.timestamp() - float(last_rec_ts)) >= _RECOVERY_COOLDOWN_SECONDS:
                        print(f"[ALERT] 🟢 {display_name}: OFFLINE -> ONLINE")
                        log_alert(project_id, dev_id, "Device Recovery", f"อุปกรณ์ {display_name} กลับมาออนไลน์")
                        send_notifications(project_id, f"อุปกรณ์ {display_name} [ID:{dev_id}] กลับมาออนไลน์แล้ว", dev_id, "RECOVERY")
                        resolve_alerts_for_device(project_id, dev_id, "Device Offline")
                        dev_status['_last_recovery_notify_ts'] = now.timestamp()
                
                dev_status['offline_notified'] = False
                dev_status['_first_offline_detected_ts'] = None
            else:
                # Still Online
                if last_seen_str:
                    dev_status['last_seen'] = last_seen_str
        
        # ==============================
        # CASE 3: สถานะปัจจุบัน = OFFLINE
        # ==============================
        else:
            if prev_online:
                # 🔴 Online -> Offline (Start Confirming)
                count = _offline_confirm_counters.get(confirm_key, 0) + 1
                _offline_confirm_counters[confirm_key] = count
                
                # Mark first offline detection time
                if not dev_status.get('_first_offline_detected_ts'):
                    dev_status['_first_offline_detected_ts'] = now.timestamp()
                
                elapsed_offline = now.timestamp() - float(dev_status.get('_first_offline_detected_ts') or now.timestamp())
                
                if count >= _OFFLINE_CONFIRM_REQUIRED and elapsed_offline >= _MIN_OFFLINE_SECONDS:
                    # ✅ CONFIRMED OFFLINE
                    dev_status['online'] = False
                    dev_status['offline_since'] = now.strftime("%Y-%m-%d %H:%M:%S")
                    
                    # Cooldown check (anti-spam)
                    last_off_ts = dev_status.get('_last_offline_notify_ts')
                    cooldown_ok = (not last_off_ts) or ((now.timestamp() - float(last_off_ts)) >= _OFFLINE_COOLDOWN_SECONDS)
                    
                    if not in_grace and not was_notified_offline and cooldown_ok:
                        print(f"[ALERT] 🔴 {display_name}: ONLINE -> OFFLINE (Confirmed)")
                        log_alert(project_id, dev_id, "Device Offline", f"อุปกรณ์ {display_name} ขาดการติดต่อ")
                        send_notifications(project_id, f"🚨 อุปกรณ์ {display_name} [ID:{dev_id}] ขาดการติดต่อ!", dev_id, "OFFLINE")
                        dev_status['offline_notified'] = True
                        dev_status['_last_offline_notify_ts'] = now.timestamp()
                else:
                    pass
            else:
                # Still Offline
                pass
        
        status_map[dev_id] = dev_status
        updated = True

    if updated:
        save_status(project_id, status_map)

def check_alerts(values: dict, device_id: str, project_id: str, dry_run: bool = False):
    """Check rules against current readings"""
    if not project_id: return []
    
    rules = load_rules(project_id)
    active_alerts = load_active_alerts(project_id)
    readings = READINGS.get(project_id, {})
    
    updated = False
    
    for rule in rules:
        if not rule.get('enabled', True): continue
        
        try:
            dev_id = str(rule.get('device_id'))
            param = rule.get('parameter')
            operator = rule.get('operator')
            threshold = float(rule.get('threshold', 0))
            
            if dev_id in readings:
                val = readings[dev_id].get(param)
                if val is not None:
                    triggered = False
                    if operator == '>' and val > threshold: triggered = True
                    elif operator == '<' and val < threshold: triggered = True
                    elif operator == '>=' and val >= threshold: triggered = True
                    elif operator == '<=' and val <= threshold: triggered = True
                    elif operator == '==' and val == threshold: triggered = True
                    
                    rule_id = rule.get('id', 'unknown')
                    rule_key = f"{rule_id}_{dev_id}"
                    
                    if triggered:
                        if rule_key not in active_alerts:
                            msg = f"{rule.get('name')} triggered: {val} {operator} {threshold}"
                            active_alerts[rule_key] = {
                                "start_time": datetime.now().isoformat(),
                                "value": val,
                                "message": msg,
                                "rule_id": rule_id
                            }
                            updated = True
                            if not dry_run and not _is_in_grace_period():
                                log_alert(project_id, dev_id, "Rule Triggered", msg)
                                send_notifications(project_id, msg, dev_id, val)
                    else:
                        if rule_key in active_alerts:
                            del active_alerts[rule_key]
                            updated = True
                            if not dry_run and not _is_in_grace_period():
                                msg = f"{rule.get('name')} returned to normal: {val}"
                                log_alert(project_id, dev_id, "Rule Recovery", msg)
                                send_notifications(project_id, msg, dev_id, "NORMAL")
                                resolve_alerts_for_device(project_id, dev_id, "Rule Triggered")
        except:
            pass
            
    if updated and not dry_run:
        save_active_alerts(active_alerts, project_id)
    
    return []

def resolve_alerts_for_device(project_id: str, device_id: str, alert_type: str):
    """Mark all active alerts of this type as resolved in DB"""
    try:
        from .alert_manager import get_alerts, resolve_alert
        existing = get_alerts(project_id)
        for al in existing:
            if str(al.get('device_id')) == str(device_id) and al.get('alert_type') == alert_type:
                resolve_alert(project_id, al.get('id'))
    except Exception as e:
        print(f"Error resolving alerts: {e}")

def load_project_users_local(project_id: str) -> Dict:
    path = os.path.join(_get_project_dir(project_id), "users.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def _get_device_info(project_id: str, device_id: str):
    """Get device name and converter name from config"""
    try:
        config_path = os.path.join(_get_project_dir(project_id), "ConfigDevice.json")
        if not os.path.exists(config_path):
            return None, None
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        for conv in config.get('converters', []):
            conv_name = conv.get('name') or conv.get('protocol') or "Unknown Converter"
            for dev in conv.get('devices', []):
                if str(dev.get('id')) == str(device_id):
                    dev_name = dev.get('name') or f"Device {device_id}"
                    return dev_name, conv_name
    except:
        pass
    return None, None

def send_notifications(project_id: str, message: str, device_id: str, value: Any):
    """Send notifications (LINE + Email) — called only on actual state changes."""
    global _LINE_ALERT_MANAGER
    
    # Block during grace period
    if _is_in_grace_period():
        print(f"[ALERT] Notification BLOCKED (grace period): {message}")
        return

    dev_name, conv_name = _get_device_info(project_id, device_id)
    display_name = dev_name if dev_name else f"Device {device_id}"

    # LINE notifications
    try:
        if _LINE_ALERT_MANAGER is None:
            from services.backend.integrations.line_bot.line_config import LineConfig
            from services.backend.integrations.line_bot.line_service import LineBotService
            from services.backend.integrations.line_bot.alert_manager import AlertManager as LineAlertManager
            cfg = LineConfig.from_env()
            try:
                cfg.validate()
            except Exception:
                cfg = None
            if cfg:
                _LINE_ALERT_MANAGER = LineAlertManager(LineBotService(cfg))

        if _LINE_ALERT_MANAGER is not None:
            try:
                text = (
                    f"{message}\n\n"
                    f"📦 Device: {display_name}\n"
                    f"🔌 Converter: {conv_name or '-'}\n"
                    f"🆔 ID: {device_id}\n"
                    f"📊 Value: {value}\n"
                    f"🕒 Time: {datetime.now().strftime('%H:%M:%S')}"
                )
                _LINE_ALERT_MANAGER.send_alert_to_project_users(project_id, text)
                print(f"[LINE ALERT] ✅ Sent: {message}")
            except Exception as e:
                print(f"[LINE ALERT] Error: {e}")
    except Exception as e:
        print(f"[LINE ALERT] Init error: {e}")

    # Email notifications
    try:
        users = load_project_users_local(project_id)
        recipients = []
        for username, user_data in users.items():
            notif_prefs = user_data.get('notifications', {})
            if notif_prefs.get('email', False) and user_data.get('email'):
                recipients.append(user_data['email'])
        if recipients:
            subject = f"🚨 EnergyLink Alert: {project_id} - {device_id}"
            body = f"""Alert: {message}
Device: {device_id}
Value: {value}
Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---
This is an automated alert from EnergyLink system."""
            from services.backend.api.email.email_service import send_email
            for recipient in recipients:
                send_email(recipient, subject, body)
    except Exception as e:
        print(f"[EMAIL ALERT] Error: {e}")

def log_alert(project_id: str, device_id: str, alert_type: str, message: str):
    """Append to alert_logs.json and SQLite"""
    path = _get_alert_logs_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    new_log = {
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event": "ALERT",
        "rule_name": alert_type,
        "device_id": device_id,
        "message": message,
        "severity": "critical"
    }
    
    try:
        logs = []
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        logs.insert(0, new_log)
        if len(logs) > 1000:
            logs = logs[:1000]
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
        add_alert(device_id, alert_type, message, project_id)
    except Exception as e:
        print(f"Error logging alert: {e}")
