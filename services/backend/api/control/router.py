from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import time
import threading
from .models import ControlDescriptor, AuditLogEntry
from .service import control_service
from .device_discovery import device_discovery_service

router = APIRouter()
_HW_STATUS_CACHE = {}
_HW_STATUS_CACHE_LOCK = threading.Lock()
_HW_STATUS_CACHE_TTL_SEC = 5.0

@router.post("/execute", response_model=AuditLogEntry)
async def execute_control(descriptor: ControlDescriptor):
    """
    Execute a control action on a device.
    """
    from fastapi.concurrency import run_in_threadpool
    from services.backend import shared_state
    
    # Attempt to resolve project_id if not provided
    if not descriptor.project_id:
        try:
            active_info = shared_state.load_active()
            descriptor.project_id = active_info.get('active')
        except Exception:
            pass
            
    result = await run_in_threadpool(control_service.execute_control, descriptor)
    
    # ✅ Optimistic Update Shared State to prevent UI flipping
    if result.status == "success":
        try:
            from services.backend import shared_state
            
            act = str(descriptor.action or "").upper()
            if act == "1":
                act = "ON"
            elif act == "0":
                act = "OFF"

            val = 1 if act == "ON" else 0

            target_key = None
            write_inverted = False
            try:
                outputs_info = device_discovery_service.get_device_outputs(str(descriptor.device_id))
                for out in outputs_info.get('outputs', []):
                    if str(out.get('control_target')) == str(descriptor.control_target) or str(out.get('key')) == str(descriptor.control_target) or str(out.get('address')) == str(descriptor.control_target):
                        target_key = out.get('key')
                        write_inverted = bool(out.get('write_inverted'))
                        break
            except Exception:
                target_key = None
                write_inverted = False

            if act == "ON":
                val = 0 if write_inverted else 1
            elif act == "OFF":
                val = 1 if write_inverted else 0

            with shared_state.READINGS_LOCK:
                pid = None
                try:
                    pid = shared_state.load_active().get('active')
                except Exception:
                    pid = None

                if not pid:
                    try:
                        pid = next(iter(shared_state.READINGS.keys()), None)
                    except Exception:
                        pid = None

                if pid:
                    shared_state.READINGS.setdefault(pid, {})
                    rec = shared_state.READINGS[pid].setdefault(str(descriptor.device_id), {})
                    vals = rec.get('values')
                    if not isinstance(vals, dict):
                        vals = {}
                        rec['values'] = vals
                    vals[descriptor.control_target] = val
                    if target_key and target_key != descriptor.control_target:
                        vals[target_key] = val
                    rec['timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                print(f"[CONTROL] Optimistic Update: {descriptor.device_id} {descriptor.control_target} -> {val}")
        except Exception as e:
            print(f"[CONTROL] Optimistic Update Failed: {e}")

    if result.status == "failed":
        # We return 200 even on failure to show the audit log result, 
        # but you could change this to 400 or 500.
        pass
        
    return result

@router.get("/audit_log")
async def get_audit_log(limit: int = 50):
    """
    Retrieve recent audit logs.
    """
    import sqlite3
    try:
        from services.backend import shared_state
        from services.backend.api.billing.database import get_project_db_path
        active_info = shared_state.load_active()
        pid = active_info.get('active')
        if not pid:
            raise HTTPException(status_code=400, detail="No active project")
        try:
            limit = int(limit)
        except Exception:
            limit = 50
        limit = max(1, min(limit, 500))

        control_service._ensure_audit_table(pid)
        db_path = get_project_db_path(pid)
        with sqlite3.connect(db_path, check_same_thread=False) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT * FROM control_audit ORDER BY executed_at DESC LIMIT ?", (limit,))
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
            except sqlite3.OperationalError as e:
                if "no such table" in str(e).lower():
                    return []
                raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices")
async def list_controllable_devices(project: str = Query(None, description="Filter by project name")):
    """
    List all devices with controllable outputs.
    """
    try:
        devices = device_discovery_service.list_all_controllable_devices(project)
        return {"devices": devices, "count": len(devices)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}/outputs")
async def get_device_outputs(device_id: str):
    """
    Get controllable outputs for a specific device.
    """
    try:
        result = device_discovery_service.get_device_outputs(device_id)
        if 'error' in result and result['error']:
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}/status")
async def get_device_status(device_id: str):
    """
    Read current status of all digital outputs for a device.
    Uses Modbus polling data first; if missing/unknown, falls back to direct hardware read.
    """
    try:
        from services.backend import shared_state
        from .service import control_service
        
        # Get device config
        device_config = control_service._find_device_config(device_id)
        if not device_config:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Get outputs info
        result = device_discovery_service.get_device_outputs(device_id)
        if 'error' in result and result['error']:
            raise HTTPException(status_code=404, detail=result['error'])
        
        # Read from shared_state.READINGS (modbus poller data)
        statuses = []
        with shared_state.READINGS_LOCK:
            device_rec = None
            for _, pdata in (shared_state.READINGS or {}).items():
                if isinstance(pdata, dict) and str(device_id) in pdata:
                    device_rec = pdata.get(str(device_id))
                    break

        values_map = {}
        if isinstance(device_rec, dict):
            values_map = device_rec.get('values') or {}
        if not isinstance(values_map, dict):
            values_map = {}

        if device_rec is None:
            now = time.monotonic()
            with _HW_STATUS_CACHE_LOCK:
                cached = _HW_STATUS_CACHE.get(str(device_id))
                if cached and (now - float(cached.get('t', 0))) <= _HW_STATUS_CACHE_TTL_SEC:
                    return {
                        'device_id': device_id,
                        'statuses': cached.get('statuses', []),
                        'timestamp': datetime.now().isoformat(),
                        'source': 'hardware-cache',
                        'device_data_keys': []
                    }
        
        for output in result.get('outputs', []):
            key = output.get('key')
            address = output.get('address')
            func = output.get('function')
            inverted = bool(output.get('inverted'))
            
            display_value = None
            
            # Try to get value from polling data
            value = values_map.get(key)
            
            # Determine status
            # Determine status
            if value is not None:
                # Convert to int if needed
                try:
                    int_value = int(float(value))
                    is_active = (int_value == 1 or int_value == 65280)
                    is_on = (not is_active) if inverted else is_active
                    status_text = 'ON' if is_on else 'OFF'
                    display_value = 1 if is_on else 0
                except:
                    int_value = None
                    status_text = 'UNKNOWN'
                    display_value = None
            else:
                if device_rec is not None:
                    int_value = None
                    status_text = 'UNKNOWN'
                    display_value = None
                else:
                    # Fallback: direct hardware read (coils)
                    try:
                        ip = device_config.get('modbus_ip')
                        port = int(device_config.get('modbus_port') or 502)
                        slave = int(device_config.get('modbus_slave') or 1)
                        
                        # Normalize protocol
                        parent_id = device_config.get('parent')
                        protocol = 'modbus_tcp'
                        if parent_id:
                            protocol = control_service._find_parent_protocol(parent_id)
                        if 'tcp' in protocol and 'modbus' not in protocol:
                            protocol = 'tcp'
                        
                        # Only read coils for function 1 outputs
                        # Standard Digital Output / Relay
                        if func in [1, 5]:
                            # ✅ Use threadpool for blocking socket call
                            from fastapi.concurrency import run_in_threadpool
                            hw_val = await run_in_threadpool(
                                control_service._read_coil_status_with_fallback,
                                str(device_id), ip, port, slave, int(address), protocol=protocol
                            )
                            # hw_val = control_service._read_coil_status_with_fallback(str(device_id), ip, port, slave, int(address), protocol=protocol)
                            if hw_val is not None:
                                int_value = int(hw_val)
                                
                                # Hardware Read is RAW. Apply inverted logic locally.
                                # ✅ FIX: Support both 1 and 0xFF00 (65280) as ON
                                is_active = (int_value == 1 or int_value == 65280)
                                
                                if inverted:
                                    # Active Low: 0 is ON
                                    status_text = 'ON' if not is_active else 'OFF'
                                    # Invert value for UI (1=ON)
                                    display_value = 1 if not is_active else 0
                                else:
                                    # Active High: 1 is ON
                                    status_text = 'ON' if is_active else 'OFF'
                                    display_value = 1 if is_active else 0
                            else:
                                int_value = None
                                status_text = 'UNKNOWN'
                        else:
                            int_value = None
                            status_text = 'UNKNOWN'
                    except Exception:
                        int_value = None
                        status_text = 'UNKNOWN'
            
            statuses.append({
                'key': key,
                'address': address,
                'status': status_text,
                'value': display_value if display_value is not None else int_value
            })

        if device_rec is None:
            now = time.monotonic()
            with _HW_STATUS_CACHE_LOCK:
                _HW_STATUS_CACHE[str(device_id)] = {'t': now, 'statuses': statuses}
        
        return {
            'device_id': device_id,
            'statuses': statuses,
            'timestamp': datetime.now().isoformat(),
            'source': 'polling+fallback',
            'device_data_keys': list(values_map.keys()) if values_map else []  # Debug info
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
