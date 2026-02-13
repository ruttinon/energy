from fastapi import APIRouter, Request, HTTPException, Body, Depends, Query
from typing import Optional, Dict, List, Any
import os
import json
from datetime import datetime

# Internal imports
from .alert_engine import load_alert_logs, load_status, check_offline_devices, check_alerts
from .rules_manager import load_rules, add_rule, update_rule, delete_rule

# Shared state
from services.backend.shared_state import READINGS

router = APIRouter()

def get_active_project_id():
    """Helper to get active project ID if not provided"""
    try:
        from services.backend.shared_state import load_active, save_active
        active = load_active().get('active')
        if active:
            return active
        # Fallback: pick first project folder
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))
        if os.path.isdir(root):
            for name in os.listdir(root):
                p = os.path.join(root, name)
                if os.path.isdir(p):
                    try:
                        save_active(name)
                    except Exception:
                        pass
                    return name
    except Exception:
        pass
    return None

# ===========================================
# ACTIVE ALERTS (aggregated)
# ===========================================
@router.get('/active')
def get_active_alerts(project_id: Optional[str] = None):
    """Aggregate active alerts across devices and offline status"""
    try:
        pid = project_id or get_active_project_id()
        if not pid:
            return {"status": "error", "message": "No active project", "data": []}
        
        # NOTE: Do NOT call check_offline_devices() here.
        # The background monitor thread handles this every 30s.
        # Calling it from API endpoints causes duplicate notification spam.
        
        status_map = {}
        try:
            status_map = load_status(pid) or {}
        except Exception:
            status_map = {}
        
        data = READINGS.get(pid, {}) or {}
        alerts: List[Dict[str, Any]] = []
        
        # Offline alerts
        try:
            for dev_id, st in (status_map or {}).items():
                if not st.get('online'):
                    alerts.append({
                        "type": "OFFLINE",
                        "title": "Device Offline",
                        "device_id": dev_id,
                        "severity": "critical",
                        "message": st.get('offline_reason') or "No response",
                        "timestamp": st.get('offline_since') or st.get('last_seen') or datetime.utcnow().isoformat()
                    })
        except Exception:
            pass
        
        # Rule-based alerts (dry-run)
        try:
            for dev_id, rec in data.items():
                values = rec.get('values') or {}
                ts = rec.get('timestamp') or ''
                try:
                    rule_alerts = check_alerts(values, dev_id, pid, dry_run=True) or []
                except Exception:
                    rule_alerts = []
                for a in rule_alerts:
                    alerts.append({
                        "type": a.get('type') or "ALERT",
                        "title": a.get('title') or a.get('type') or "Alert",
                        "device_id": a.get('device_id') or dev_id,
                        "severity": a.get('severity') or "warning",
                        "message": a.get('message') or a.get('desc') or "",
                        "timestamp": a.get('time') or a.get('timestamp') or ts
                    })
        except Exception:
            pass
        
        # Sort by severity/time (critical first)
        def _sev_rank(s):
            s = str(s or '').lower()
            if s == 'critical': return 3
            if s == 'error': return 2
            if s == 'warning': return 1
            return 0
        alerts.sort(key=lambda x: (_sev_rank(x.get('severity')), str(x.get('timestamp') or '')), reverse=True)
        
        return {"status": "ok", "data": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/{project_id}/active')
def get_active_alerts_for_project(project_id: str):
    """Compatibility path: /{project_id}/active"""
    return get_active_alerts(project_id=project_id)

# ===========================================
# GET CURRENT READINGS (for Param Dropdown)
# ===========================================
@router.get('/readings')
def get_readings_endpoint(project_id: Optional[str] = None):
    """Get current readings for all devices in active project"""
    try:
        pid = project_id or get_active_project_id()
        if not pid:
            return {"status": "error", "message": "No active project"}
        
        # Return data from shared memory
        data = READINGS.get(pid, {})
        
        # Format for frontend (device_id -> {key: value})
        formatted = {}
        for dev_id, rec in data.items():
            formatted[dev_id] = rec.get('values', {})
            
        return {"status": "ok", "data": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# CHECK RULES (Live Alerts)
# ===========================================
@router.post('/check')
def check_rules_endpoint(payload: dict = Body(...), project_id: Optional[str] = None):
    """Check rules against provided data (Dry Check)"""
    try:
        pid = project_id or get_active_project_id()
        
        device_id = payload.get('device')
        data = payload.get('data') # {param: value, ...}
        
        if not device_id or not data:
            return []
            
        # Run check_alerts in dry_run mode
        alerts = check_alerts(data, device_id, pid, dry_run=True)
        
        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# GET ALERT LOGS
# ===========================================
@router.get('/logs')
def get_alert_logs_endpoint(project_id: Optional[str] = None):
    """Get recent alert logs"""
    try:
        pid = project_id or get_active_project_id()
        logs = load_alert_logs(pid)
        
        # Return only last 50 alerts
        recent_logs = logs[-50:] if len(logs) > 50 else logs
        recent_logs.reverse()  # Most recent first
        
        return recent_logs
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# GET DEVICE STATUS
# ===========================================
@router.get('/device/status')
def get_device_status(project_id: Optional[str] = None):
    """Get current status of all devices"""
    try:
        pid = project_id or get_active_project_id()
        if not pid:
            return {}
        
        # NOTE: Offline check is handled by background monitor thread.
        # Do NOT call check_offline_devices() from API to prevent spam.
        
        # Load status from file
        status_map = load_status(pid)

        # Load realtime data from memory to augment status
        realtime_data = READINGS.get(pid, {})

        # Build expected devices from ConfigDevice.json to ensure all appear
        expected = {}
        try:
            proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))
            cfg_path = os.path.join(proj_root, pid, "ConfigDevice.json")
            if os.path.exists(cfg_path):
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                for conv in cfg.get('converters', []):
                    conv_name = conv.get('name') or conv.get('protocol')
                    host = (conv.get('settings') or {}).get('host') or conv.get('address')
                    for d in (conv.get('devices') or []):
                        did = str(d.get('id'))
                        expected[did] = {
                            "device_name": d.get('name') or did,
                            "convertor_name": conv_name or '-',
                            "ip": d.get('modbus_ip') or host,
                        }
        except Exception:
            pass

        # Merge sources: expected + status_map + realtime
        final_status = {}
        all_ids = set(expected.keys()) | set(status_map.keys()) | set(realtime_data.keys())

        for dev_id in all_ids:
            file_info = status_map.get(dev_id, {})
            mem_info = realtime_data.get(dev_id, {})
            exp_info = expected.get(dev_id, {})

            # Prefer memory online status
            is_online = mem_info.get('online', file_info.get('online', False))

            # Prefer memory timestamp
            last_seen = mem_info.get('timestamp') or file_info.get('last_seen')

            final_status[dev_id] = {
                "online": bool(is_online),
                "last_seen": last_seen,
                "offline_since": file_info.get("offline_since"),
                "offline_reason": file_info.get("offline_reason"),
                "ip": mem_info.get("ip") or file_info.get("ip") or exp_info.get("ip"),
                "device_name": mem_info.get("device_name") or file_info.get("device_name") or exp_info.get("device_name") or dev_id,
                "convertor_name": mem_info.get("converter") or file_info.get("convertor_name") or exp_info.get("convertor_name") or "-",
            }

        return final_status
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# GET ALERT RULES
# ===========================================
@router.get('/rules')
def get_rules_endpoint(project_id: Optional[str] = None):
    """Get all alert rules"""
    try:
        pid = project_id or get_active_project_id()
        rules = load_rules(pid)
        return rules
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# ADD ALERT RULE
# ===========================================
@router.post('/rules/add')
def add_alert_rule(payload: dict = Body(...), project_id: Optional[str] = None):
    """Add new alert rule"""
    try:
        pid = project_id or get_active_project_id()
        if not payload:
             raise HTTPException(status_code=400, detail="No data provided")
        
        new_rule = add_rule(pid, payload)
        return new_rule
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# UPDATE ALERT RULE
# ===========================================
@router.post('/rules/update/{rule_id}')
def update_alert_rule(rule_id: int, payload: dict = Body(...), project_id: Optional[str] = None):
    """Update existing alert rule"""
    try:
        pid = project_id or get_active_project_id()
        if not payload:
             raise HTTPException(status_code=400, detail="No data provided")
        
        updated = update_rule(pid, rule_id, payload)
        
        if updated:
            return updated
        else:
             raise HTTPException(status_code=404, detail="Rule not found")
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# DELETE ALERT RULE
# ===========================================
@router.delete('/rules/delete/{rule_id}')
def delete_alert_rule(rule_id: int, project_id: Optional[str] = None):
    """Delete alert rule"""
    try:
        pid = project_id or get_active_project_id()
        success = delete_rule(pid, rule_id)
        
        if success:
            return {"message": "Rule deleted"}
        else:
             raise HTTPException(status_code=404, detail="Rule not found")
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# CLEAR ALL ALERTS
# ===========================================
@router.post('/logs/clear')
def clear_alerts(project_id: Optional[str] = None):
    """Clear all alert logs"""
    try:
        pid = project_id or get_active_project_id()
        from .alert_engine import save_alert_logs
        save_alert_logs([], pid)
        return {"message": "Alerts cleared"}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# GET ALERT PARAMETERS (Dynamic from Template)
# ===========================================
@router.get('/parameters')
def get_alert_parameters(project_id: Optional[str] = None):
    """Get available metrics from device template"""
    try:
        # Tuple: (Path relative to backend service, Template Name)
        # In a real app, this might be dynamic based on project config
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "device_templates", "socomec", "DIRIS A-40.json"))
        
        if not os.path.exists(template_path):
             return {"status": "error", "message": "Template not found"}

        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        registers = data.get('registers', [])
        metrics = []
        for reg in registers:
            if 'key' in reg:
                metrics.append({
                    "key": reg['key'],
                    "label": f"{reg.get('description', reg['key'])} ({reg.get('unit', '')})",
                    "unit": reg.get('unit', '')
                })
        
        return metrics
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# TEST LINE ALERT
# ===========================================
@router.post("/test-line-alert")
def test_line_alert(project_id: str = Query(...), message: str = Query("ทดสอบการแจ้งเตือน LINE")):
    """ทดสอบส่งแจ้งเตือนไปยัง LINE สำหรับ project ที่ระบุ"""
    try:
        from .alert_engine import send_notifications
        
        send_notifications(project_id, message, "test_device", "test_value")
        
        return {"status": "ok", "message": f"ส่งการแจ้งเตือน LINE ให้ project {project_id} แล้ว"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
