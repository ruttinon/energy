import os, json, time, sqlite3
from typing import Optional, Dict, Any
from services.backend.shared_state import READINGS

def _project_path(project_id: str):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    return os.path.join(root, 'data', str(project_id))

def _project_settings(project_id: str):
    try:
        pj = os.path.join(_project_path(project_id), 'Project.json')
        if os.path.exists(pj):
            with open(pj, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def ps_get_config(project_id: str) -> Dict[str, Any]:
    s = _project_settings(project_id)
    return (s or {}).get('extension_powerstudio') or {}

def ps_set_config(project_id: str, cfg: Dict[str, Any]) -> None:
    pj = os.path.join(_project_path(project_id), 'Project.json')
    d = {}
    if os.path.exists(pj):
        try:
            with open(pj, 'r', encoding='utf-8') as f:
                d = json.load(f)
        except Exception:
            d = {}
    d['extension_powerstudio'] = cfg
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

def ps_probe(cfg: Dict[str, Any]) -> Dict[str, Any]:
    m = (cfg.get('mode') or '').lower()
    if m == 'api':
        url = cfg.get('api_base')
        if not url:
            return {"mode": m, "reachable": False, "error": "Missing api_base"}
        try:
            import urllib.request
            t0 = time.time()
            with urllib.request.urlopen(url, timeout=5) as resp:
                code = resp.getcode()
                dt = int((time.time() - t0) * 1000)
                return {"mode": m, "reachable": code == 200, "status_code": code, "response_time_ms": dt}
        except Exception as e:
            return {"mode": m, "reachable": False, "error": str(e)}
    if m == 'file':
        p = cfg.get('file_path')
        if not p:
            return {"mode": m, "reachable": False, "error": "Missing file_path"}
        ok = os.path.exists(p)
        size = 0
        if ok:
            try:
                size = os.path.getsize(p)
            except Exception:
                size = 0
        return {"mode": m, "reachable": ok, "size": size}
    if m == 'db':
        dbp = cfg.get('db_path')
        if not dbp:
            return {"mode": m, "reachable": False, "error": "Missing db_path"}
        try:
            t0 = time.time()
            conn = sqlite3.connect(dbp)
            conn.close()
            dt = int((time.time() - t0) * 1000)
            return {"mode": m, "reachable": True, "response_time_ms": dt}
        except Exception as e:
            return {"mode": m, "reachable": False, "error": str(e)}
    return {"mode": m, "reachable": False, "error": "Invalid mode"}

def ps_status(project_id: str) -> Dict[str, Any]:
    cfg = ps_get_config(project_id)
    mode = (cfg.get('mode') or 'api')
    devs = (READINGS.get(project_id) or {})
    latest_ts = None
    if devs:
        try:
            latest_ts = max([rec.get('timestamp') for rec in devs.values() if rec])
        except Exception:
            latest_ts = None
    return {
        "mode": mode,
        "connected": True,
        "source_summary": {
            "active_project": project_id,
            "devices": list(devs.keys()),
            "latest_timestamp": latest_ts
        },
        "config": {"mode": mode, "api_base": cfg.get('api_base'), "db_path": cfg.get('db_path'), "file_path": cfg.get('file_path')}
    }


def ps_fetch_latest_raw(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch raw data from Power Studio (API/File/DB) without normalization.
    Returns: {"items": [...Raw Items...], "raw": Optional[str]}
    """
    m = (cfg.get('mode') or '').lower()
    
    # --- API MODE ---
    if m == 'api':
        url = cfg.get('api_base')
        if not url:
            return {"items": [], "error": "Missing api_base"}
        try:
            import urllib.request, json as _json
            with urllib.request.urlopen(url, timeout=5) as resp:
                ct = resp.headers.get('content-type') or ''
                data = resp.read()
                decoded = data.decode('utf-8', errors='ignore')
                
                # Try parsing JSON
                try:
                    parsed = _json.loads(decoded)
                    # Handle common Power Studio API response formats
                    # Case 1: List of objects
                    if isinstance(parsed, list):
                        return {"items": parsed}
                    # Case 2: {"d": [...]} or {"data": [...]}
                    if isinstance(parsed, dict):
                        return {"items": parsed.get('d') or parsed.get('data') or parsed.get('records') or [parsed]}
                    return {"items": [parsed]}
                except:
                    return {"items": [], "raw": decoded}
        except Exception as e:
            return {"items": [], "error": str(e)}

    # --- FILE MODE ---
    if m == 'file':
        p = cfg.get('file_path')
        if not p or not os.path.exists(p):
            return {"items": [], "error": "File not found"}
        try:
            if p.lower().endswith('.json'):
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list): return {"items": data}
                    return {"items": [data]}
            # Add CSV support if needed
            return {"items": []}
        except Exception as e:
            return {"items": [], "error": str(e)}

    # --- DB MODE ---
    if m == 'db':
        dbp = cfg.get('db_path')
        if not dbp or not os.path.exists(dbp):
             return {"items": [], "error": "DB file not found"}
        try:
            conn = sqlite3.connect(dbp)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            # Generic query - typically customized per user schema
            cur.execute('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 50')
            rows = cur.fetchall()
            conn.close()
            items = [dict(r) for r in rows]
            return {"items": items}
        except Exception as e:
            return {"items": [], "error": str(e)}

    return {"items": [], "error": "Invalid mode"}

def ps_normalize(raw_data: Dict[str, Any], mapping: Dict[str, str]) -> list:
    """
    Convert Raw Data -> Normalized EnergyLink Readings
    mapping: {"PS_FIELD_NAME": "EL_PARAMETER_NAME"}
             e.g. {"V_L1": "voltage_l1", "KW_TOT": "power_active"}
    """
    items = raw_data.get('items', [])
    normalized = []
    
    # If no mapping provided, return raw items wrapped clearly
    if not mapping:
        return items

    for item in items:
        # Create a single standardized reading object
        reading = {
            # Try to identify device ID from common fields
            "device_id": item.get('device_id') or item.get('id') or 'unknown',
            "timestamp": item.get('timestamp') or item.get('ts') or time.time(),
            "values": {}
        }
        
        # Map values
        for ps_key, el_key in mapping.items():
            if ps_key in item:
                try:
                    val = float(item[ps_key])
                    reading['values'][el_key] = val
                except:
                    pass
        
        normalized.append(reading)
            

    return normalized

def ps_fetch_latest(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Backward compatibility wrapper.
    """
    return ps_fetch_latest_raw(cfg)


