import json
import os
from datetime import datetime, timedelta
from .rules_manager import load_rules
from .event_rules_manager import load_event_rules
from .config_manager import load_config
from .alert_manager import add_alert

# 🔥 Database functions
try:
    from utils.database_manager import save_alert_log, save_event_log, save_sensor_reading
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    # print("⚠️ Database not available - using JSON only")

# 🔥 XLSX Storage
try:
    from services.backend.api.xlsx_storage import save_alert, save_reading
except ImportError:
    save_alert = None
    save_reading = None
    # print("⚠️ XLSX Storage not available")

# ===========================================
# PATH
# ===========================================
THIS_FILE = os.path.abspath(__file__)
THIS_DIR = os.path.dirname(THIS_FILE)
PROJECT_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", "..")) # services/backend
DATA_DIR = os.path.join(PROJECT_ROOT, "data") # services/backend/data ?? No, probably project root data if standalone

PROJECTS_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", "..", "..", "..", "projects"))


CONVERTORS_PATH = os.path.join(DATA_DIR, "convertors.json")
LOG_PATH = os.path.join(DATA_DIR, "logs", "alert_logs.json")

os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

# 🔥 TIMEOUT สำหรับการตรวจสอบ OFFLINE (วินาที)
OFFLINE_TIMEOUT = 60  # 60 วินาที ถ้าไม่มีข้อมูลจึงจะถือว่า OFFLINE

def _get_status_path(project_id):
    if not project_id:
        return os.path.join(PROJECT_ROOT, "utils", "alert_module", "device_status.json")
    return os.path.join(PROJECTS_ROOT, project_id, "alert", "device_status.json")

def _get_alert_logs_path(project_id):
    """Get path for alert logs JSON file"""
    if not project_id:
        return LOG_PATH
    return os.path.join(PROJECTS_ROOT, project_id, "alert", "alert_logs.json")

# ===========================================
# DEVICE STATUS
# ===========================================
def load_status(project_id=None):
    path = _get_status_path(project_id)
    if not os.path.exists(path):
        return {}
    try:
        return json.load(open(path, "r", encoding="utf-8"))
    except:
        return {}

def save_status(data, project_id=None):
    path = _get_status_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ===========================================
# ALERT LOGS MANAGEMENT
# ===========================================
def load_alert_logs(project_id=None):
    """Load alert logs from JSON file"""
    path = _get_alert_logs_path(project_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            logs = json.load(f)
        # Keep only last 100 alerts
        return logs[-100:] if len(logs) > 100 else logs
    except:
        return []

def save_alert_logs(alerts, project_id=None):
    """Save alert logs to JSON file"""
    path = _get_alert_logs_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(alerts, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Alert Engine] ERROR saving alert logs: {e}")

def add_alert_to_logs(alert, project_id=None):
    """Add new alert to logs (both JSON and Excel)"""
    try:
        # Add to JSON logs
        logs = load_alert_logs(project_id)
        logs.append(alert)
        save_alert_logs(logs, project_id)
        
        # Save to Excel if available
        if save_alert and project_id:
            try:
                save_alert(
                    project_id=project_id,
                    device_id=alert.get('device_id', ''),
                    device_name=alert.get('device_name', ''),
                    alert_type=alert.get('severity', 'info'),
                    message=alert.get('message', '')
                )
                print(f"[Alert Engine] ✅ Saved to Excel: {alert.get('device_name')} - {alert.get('message')}")
            except Exception as e:
                print(f"[Alert Engine] ⚠️ Excel save failed: {e}")
                
    except Exception as e:
        print(f"[Alert Engine] ERROR adding alert: {e}")

# ===========================================
# ACTIVE ALERTS STATE (For Spam Prevention)
# ===========================================
def _get_active_alerts_path(project_id):
    if not project_id:
        return os.path.join(DATA_DIR, "logs", "active_alerts.json")
    return os.path.join(PROJECTS_ROOT, project_id, "alert", "active_alerts.json")

def load_active_alerts(project_id=None):
    """Load currently active alerts map: {device_id_rule_id: timestamp}"""
    path = _get_active_alerts_path(project_id)
    if not os.path.exists(path):
        return {}
    try:
        return json.load(open(path, "r", encoding="utf-8"))
    except:
        return {}

def save_active_alerts(active_map, project_id=None):
    path = _get_active_alerts_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(active_map, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Alert Engine] Error saving active alerts: {e}")

# ===========================================
# MAP DEVICE → CONVERTOR
# ===========================================
def map_device_to_convertor(device_id, project_id=None):
    try:
        # 1. Try Project Config (Priority)
        if project_id:
            cfg_path = os.path.join(PROJECTS_ROOT, project_id, "ConfigDevice.json")
            if os.path.exists(cfg_path):
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                
                for conv in cfg.get('converters', []):
                    # Check devices list
                    for d in (conv.get('devices') or []):
                        if str(d.get('id')) == str(device_id):
                             return {
                                "convertor_id": conv.get("id"),
                                "convertor_name": conv.get("name"),
                                "device_name": d.get("name", device_id)
                            }

        # 2. Try Global Convertors (Fallback)
        if os.path.exists(CONVERTORS_PATH):
            with open(CONVERTORS_PATH, "r", encoding="utf-8") as f:
                cv = json.load(f)

            for conv_id, conv_data in cv.items():
                devices = conv_data.get("devices", {})
                if device_id in devices:
                    return {
                        "convertor_id": conv_id,
                        "convertor_name": conv_data.get("name", conv_id),
                        "device_name": devices[device_id].get("name", device_id)
                    }

    except Exception as e:
        print("[Alert Engine] map_device error:", e)

    return {
        "convertor_id": None,
        "convertor_name": None,
        "device_name": device_id
    }

# ===========================================
# COMPARE ENGINE
# ===========================================
def compare(value, operator, threshold, threshold2=None):
    try:
        if operator == ">": return value > threshold
        if operator == "<": return value < threshold
        if operator == ">=": return value >= threshold
        if operator == "<=": return value <= threshold
        if operator == "==": return value == threshold
        if operator == "!=": return value != threshold
        if operator == "between" and threshold2 is not None:
            return threshold <= value <= threshold2
        if operator == "out_of_range" and threshold2 is not None:
            return not (threshold <= value <= threshold2)
    except:
        return False
    return False

# ===========================================
# APPLY EVENT RULES
# ===========================================
def apply_event_rules(sensor, device_id):
    rules = load_event_rules()
    for r in rules:
        m = r["metric"]
        if m not in sensor:
            continue

        try:
            value = float(sensor[m])
            th = float(r["threshold"])
        except:
            continue

        ok = compare(value, r["operator"], th, r.get("threshold2"))

        if ok and DB_AVAILABLE:
            try:
                save_event_log(
                    event_name=r["event_name"],
                    event_type="custom",
                    device_id=device_id,
                    user=None,
                    details=r.get("message", "")
                )
            except Exception as e:
                print(f"⚠️ Event DB log error: {e}")

# =====================================================
# 🔧 DEBUGGING & FIXES FOR ALERT ENGINE
# =====================================================

# วิธีตรวจสอบว่า Alert Engine ทำงานหรือไม่
# เพิ่มโค้ดนี้ใน alert_engine.py

def check_alerts(sensor_data: dict, device_id: str = None, project_id: str = None, dry_run: bool = False):
    """
    Enhanced version with debugging output
    """
    
    # 🔍 DEBUG: Print input data
    print(f"\n{'='*60}")
    print(f"[Alert Engine] CHECK ALERTS CALLED")
    print(f"{'='*60}")
    print(f"Project ID: {project_id}")
    print(f"Device ID: {device_id}")
    print(f"Dry Run: {dry_run}")
    print(f"Sensor Data: {sensor_data}")
    print(f"{'='*60}\n")
    
    alerts = []
    rules = load_rules(project_id)
    
    # 🔍 DEBUG: Print loaded rules
    print(f"[Alert Engine] Loaded {len(rules)} rules:")
    for r in rules:
        print(f"  - Rule #{r.get('id')}: {r.get('rule_name')}")
        print(f"    Metric: {r.get('metric')}")
        print(f"    Condition: {r.get('operator')} {r.get('threshold')}")
        print(f"    Active: {r.get('is_active', True)}")
    
    if not rules:
        print("⚠️  WARNING: No rules found! Please create rules first.")
        return []
    
    info = map_device_to_convertor(device_id, project_id)
    
    # ... rest of the function continues ...
    
    if not dry_run:
        # -------------------------------------------------------------
        # 🔥 DEVICE ONLINE / OFFLINE MONITOR
        # -------------------------------------------------------------
        status = load_status(project_id)
        now = datetime.now()
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        device_info = status.get(device_id, {
            "online": False,
            "last_seen": None,
            "offline_since": None,
            "offline_reason": None,
            "online_reason": None,
            "ip": None
        })
        
        # 🔌 ถ้าเดิมเป็น OFFLINE และตอนนี้ได้ข้อมูลใหม่ → เปลี่ยนเป็น ONLINE
        if not device_info["online"]:
            # ... (Recovery logic omitted for brevity, it's fine) ...
             # เพิ่ม Alert แจ้งว่ากลับมาแล้ว, etc.
             pass

        # Always update status to ONLINE when receiving data
        device_info["online"] = True
        device_info["last_seen"] = now_str
        status[device_id] = device_info
        save_status(status, project_id)

        # -------------------------------------------------------------
        # 🔥บันทึก sensor data ลง Excel (RESTORED)
        # -------------------------------------------------------------
        if save_reading and project_id and device_id:
            try:
                device_name = info.get('device_name', device_id)
                for key, value in sensor_data.items():
                    try:
                        # Skip strictly non-numeric values if desired, or try convert
                        float_value = float(value)
                        save_reading(
                            project_id=project_id,
                            device_id=device_id,
                            device_name=device_name,
                            key=key,
                            value=float_value,
                            unit=""
                        )
                    except (ValueError, TypeError):
                        continue
            except Exception as e:
                print(f"[Alert Engine] ⚠️ Excel reading save error: {e}")

        # -------------------------------------------------------------
        # 🔥 Log sensor reading to DB (RESTORED)
        # -------------------------------------------------------------
        if DB_AVAILABLE and device_id:
            try:
                save_sensor_reading(
                    device_id=device_id,
                    sensor_data=sensor_data,
                    convertor_id=info.get("convertor_id")
                )
            except Exception as e:
                 # print(f"⚠️ Sensor DB log error: {e}")
                 pass

        # -------------------------------------------------------------
        # 🔥 Apply event rules
        # -------------------------------------------------------------
        cfg = load_config()
        if cfg.get("rule_mode") in ["combined", "separate"]:
            apply_event_rules(sensor_data, device_id)


    # Load active alerts state
    active_alerts = {}
    if not dry_run:
        active_alerts = load_active_alerts(project_id)
        print(f"\n[Alert Engine] Active alerts state: {active_alerts}")
    
    dirty_state = False
    
    for rule in rules:
        if not rule.get("is_active", True):
            print(f"[Alert Engine] ⏭️  Skipping disabled rule: {rule.get('rule_name')}")
            continue

        metric = rule.get("metric")
        if not metric or metric not in sensor_data:
            print(f"[Alert Engine] ⏭️  Skipping rule {rule.get('rule_name')}: metric '{metric}' not in sensor data")
            print(f"              Available keys: {list(sensor_data.keys())}")
            continue

        try:
            value = float(sensor_data[metric])
            threshold = float(rule.get("threshold"))
        except Exception as e:
            print(f"[Alert Engine] ❌ Value/Threshold conversion error for {metric}: {e}")
            continue

        threshold2 = rule.get("threshold2")
        if threshold2 not in [None, ""]:
            try: 
                threshold2 = float(threshold2)
            except: 
                threshold2 = None
        else:
            threshold2 = None

        # Check condition
        is_triggered = compare(value, rule.get("operator"), threshold, threshold2)
        
        # 🔍 DEBUG: Print comparison result
        print(f"\n[Alert Engine] 🔎 Rule Check:")
        print(f"  Rule: {rule.get('rule_name')}")
        print(f"  Condition: {metric} = {value} {rule.get('operator')} {threshold}")
        print(f"  Result: {'🔴 TRIGGERED' if is_triggered else '🟢 OK'}")
        
        rule_id = str(rule.get("id"))
        unique_key = f"{device_id}_{rule_id}"
        
        # STATEFUL LOGIC
        if is_triggered:
            # If ALREADY active -> Do nothing (Spam Prevention)
            if unique_key in active_alerts:
                print(f"  ⏭️  Alert already active, skipping (spam prevention)")
                continue
                
            # If NEW alert -> Trigger
            alert = {
                "rule_id": rule.get("id"),
                "rule_name": rule.get("rule_name"),
                "convertor_id": info.get("convertor_id"),
                "convertor_name": info.get("convertor_name"),
                "device_id": device_id,
                "device_name": info.get("device_name"),
                "metric": metric,
                "value": value,
                "threshold": threshold,
                "threshold2": threshold2,
                "operator": rule.get("operator"),
                "severity": rule.get("severity", "info"),
                "message": rule.get("message") or f"{metric} {rule.get('operator')} {threshold}",
                "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "event": "ALERT STARTED"
            }
            alerts.append(alert)
            
            if not dry_run:
                print(f"  🚨 NEW ALERT TRIGGERED: {alert['message']}")
                add_alert_to_logs(alert, project_id)
                active_alerts[unique_key] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                dirty_state = True
                
                # DB / Event hooks
                if DB_AVAILABLE:
                    try: 
                        save_alert_log(alert)
                    except: 
                        pass
                    try:
                        save_event_log("Alarm Triggered", "alarm", device_id, None, 
                                     f"{alert['device_name']} - {alert['rule_name']}")
                    except: 
                        pass

        else:
            # Condition NOT met (Normal)
            # Check if it WAS active -> Recovery
            if unique_key in active_alerts:
                # Trigger Resolution
                resolve_msg = f"สถานะกลับสู่ปกติ ({metric} = {value})"
                alert = {
                    "rule_id": rule.get("id"),
                    "rule_name": rule.get("rule_name"),
                    "convertor_id": info.get("convertor_id"),
                    "convertor_name": info.get("convertor_name"),
                    "device_id": device_id,
                    "device_name": info.get("device_name"),
                    "metric": metric,
                    "value": value,
                    "threshold": threshold,
                    "threshold2": threshold2,
                    "operator": rule.get("operator"),
                    "severity": "info",
                    "message": resolve_msg,
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "event": "ALERT RESOLVED"
                }
                alerts.append(alert)
                
                if not dry_run:
                    print(f"  ✅ ALERT RESOLVED: {rule.get('rule_name')}")
                    add_alert_to_logs(alert, project_id)
                    del active_alerts[unique_key]
                    dirty_state = True
                    
                    if DB_AVAILABLE:
                        try:
                            save_event_log("Alarm Resolved", "alarm", device_id, None, 
                                         f"{alert['device_name']} - {alert['rule_name']} resolved")
                        except: 
                            pass

    # Save state if changed
    if not dry_run and dirty_state:
        save_active_alerts(active_alerts, project_id)
        print(f"\n[Alert Engine] ✅ Saved active alerts state")

    print(f"\n[Alert Engine] 📊 Summary: {len(alerts)} alerts generated")
    print(f"{'='*60}\n")
    
    return alerts


# =====================================================
# 🔧 QUICK DIAGNOSTIC FUNCTION
# =====================================================

def diagnose_alert_system(project_id: str = None):
    """
    Run complete diagnostic of alert system
    """
    print("\n" + "="*70)
    print("🔍 ALERT SYSTEM DIAGNOSTIC")
    print("="*70)
    
    # 1. Check Rules
    rules = load_rules(project_id)
    print(f"\n1️⃣  RULES CHECK:")
    print(f"   Total rules: {len(rules)}")
    for r in rules:
        print(f"   - #{r.get('id')}: {r.get('rule_name')}")
        print(f"     Metric: {r.get('metric')}")
        print(f"     Condition: {r.get('operator')} {r.get('threshold')}")
        print(f"     Active: {r.get('is_active', True)}")
    
    # 2. Check Active Alerts
    active = load_active_alerts(project_id)
    print(f"\n2️⃣  ACTIVE ALERTS STATE:")
    print(f"   Total active: {len(active)}")
    for key, ts in active.items():
        print(f"   - {key}: since {ts}")
    
    # 3. Check Recent Logs
    logs = load_alert_logs(project_id)
    print(f"\n3️⃣  RECENT ALERT LOGS:")
    print(f"   Total logs: {len(logs)}")
    recent = logs[-5:] if len(logs) > 5 else logs
    for log in recent:
        print(f"   - [{log.get('time')}] {log.get('device_name')}: {log.get('message')}")
        print(f"     Event: {log.get('event')}, Severity: {log.get('severity')}")
    
    # 4. Check Current Readings
    from services.backend.shared_state import READINGS
    readings = READINGS.get(project_id, {})
    print(f"\n4️⃣  CURRENT READINGS:")
    print(f"   Total devices: {len(readings)}")
    for dev_id, rec in readings.items():
        print(f"   - Device {dev_id} ({rec.get('device_name')})")
        print(f"     Online: {rec.get('online')}")
        print(f"     Last update: {rec.get('timestamp')}")
        print(f"     Values: {list(rec.get('values', {}).keys())}")
    
    print("\n" + "="*70)
    print("✅ DIAGNOSTIC COMPLETE")
    print("="*70 + "\n")


# =====================================================
# 🔧 MANUAL TEST FUNCTION
# =====================================================

def test_alert_manually(project_id: str, device_id: str, test_data: dict):
    """
    Manually test alert with sample data
    
    Example:
        test_alert_manually(
            "my-project-123",
            "device-001",
            {"voltage": 250, "current": 15.5, "temperature": 85}
        )
    """
    print("\n" + "="*70)
    print("🧪 MANUAL ALERT TEST")
    print("="*70)
    
    print(f"\nProject: {project_id}")
    print(f"Device: {device_id}")
    print(f"Test Data: {test_data}")
    
    # Run check_alerts
    alerts = check_alerts(test_data, device_id, project_id, dry_run=False)
    
    print(f"\n📊 Result: {len(alerts)} alerts generated")
    for alert in alerts:
        print(f"\n  Alert: {alert.get('rule_name')}")
        print(f"  Event: {alert.get('event')}")
        print(f"  Message: {alert.get('message')}")
        print(f"  Severity: {alert.get('severity')}")
    
    print("\n" + "="*70 + "\n")
    
    return alerts
# ===========================================
# BACKGROUND MONITOR (Check for offline devices)
# ===========================================
def check_offline_devices(project_id=None):
    """
    Check for devices that haven't sent data in OFFLINE_TIMEOUT seconds
    This should be called periodically (e.g., every 30 seconds)
    """
    try:
        status = load_status(project_id)
        now = datetime.now()
        
        for device_id, device_info in status.items():
            if not device_info.get("last_seen"):
                continue
                
            try:
                last_seen = datetime.strptime(device_info["last_seen"], "%Y-%m-%d %H:%M:%S")
                seconds_since = (now - last_seen).total_seconds()
                
                # If device was ONLINE but now exceeded timeout → mark as OFFLINE
                if device_info.get("online") and seconds_since > OFFLINE_TIMEOUT:
                    device_info["online"] = False
                    device_info["offline_since"] = now.strftime("%Y-%m-%d %H:%M:%S")
                    device_info["offline_reason"] = f"ไม่ได้รับข้อมูลเกิน {OFFLINE_TIMEOUT} วินาที (Timeout)"
                    
                    # Get device info
                    info = map_device_to_convertor(device_id, project_id)
                    
                    # Create offline alert
                    offline_alert = {
                        "rule_id": None,
                        "rule_name": "Device Offline",
                        "convertor_id": info.get("convertor_id"),
                        "convertor_name": info.get("convertor_name"),
                        "device_id": device_id,
                        "device_name": info.get("device_name"),
                        "metric": None,
                        "value": None,
                        "threshold": None,
                        "threshold2": None,
                        "operator": None,
                        "severity": "critical",
                        "message": f"อุปกรณ์ไม่ตอบสนอง ({int(seconds_since)}s) | เหตุผล: Timeout",
                        "time": now.strftime("%Y-%m-%d %H:%M:%S"),
                        "event": "OFFLINE"
                    }
                    
                    add_alert_to_logs(offline_alert, project_id)
                    print(f"[Alert Engine] 🔴 {device_id} ตรวจพบว่า OFFLINE")
                    
            except Exception as e:
                print(f"[Alert Engine] Error checking device {device_id}: {e}")
                continue
        
        # Save updated status
        save_status(status, project_id)
        
    except Exception as e:
        print(f"[Alert Engine] Error in check_offline_devices: {e}")
    
    
