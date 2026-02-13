from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time

from services.backend.fastapi_app import get_current_user, is_admin
from services.backend.integrations.powerstudio import (
    ps_get_config, ps_set_config, ps_probe, ps_fetch_latest_raw, ps_normalize
)
from services.backend.integrations.relay_driver import test_relay_connection, control_relay
from services.backend.shared_state import load_active
import os, json

router = APIRouter()

class TestConnectionPayload(BaseModel):
    mode: str
    api_base: Optional[str] = None
    db_path: Optional[str] = None
    file_path: Optional[str] = None

class ConfigPayload(BaseModel):
    enabled: bool
    mode: str
    connection: Dict[str, Any]
    mapping: Optional[Dict[str, str]] = None

class ControlTestPayload(BaseModel):
    ip: str
    port: int = 502
    unit_id: int = 1
    channel: int
    state: bool

class ControlConfigPayload(BaseModel):
    relays: List[Dict[str, Any]] = [] # list of relay boards
    mappings: List[Dict[str, Any]] = [] # device_id -> relay_id mapping

@router.get('/status')
def get_status(username: str = Depends(get_current_user)):
    """Check PowerStudio connection status"""
    project_id = load_active().get('active')
    if not project_id:
        return {"connected": False, "error": "No active project"}
    
    cfg = ps_get_config(project_id)
    if not cfg.get('enabled'):
        return {"connected": False, "mode": "disabled"}
        
    # Quick probe based on config
    probe_res = ps_probe(cfg.get('connection', {}))
    return {
        "connected": probe_res.get('connected', False),
        "mode": cfg.get('mode'),
        "config": cfg,
        "source_summary": probe_res
    }

@router.post('/test')
def test_connection(payload: TestConnectionPayload, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    cfg = payload.dict()
    # Adapter expects flattened config for probe
    probe_cfg = {
        "mode": cfg['mode'],
        "api_base": cfg.get('api_base'),
        "db_path": cfg.get('db_path'), 
        "file_path": cfg.get('file_path')
    }
    
    return ps_probe(probe_cfg)

@router.get('/config/{project_id}')
def get_config(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    return ps_get_config(project_id)

@router.post('/config/{project_id}')
def save_config(project_id: str, payload: ConfigPayload, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Store in Project.json
    ps_set_config(project_id, payload.dict())
    return {"ok": True}

@router.post('/preview')
def preview_data(payload: TestConnectionPayload, mapping: Optional[Dict[str, str]] = None, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")

    cfg = payload.dict()
    fetch_cfg = {
        "mode": cfg['mode'],
        "api_base": cfg.get('api_base'),
        "db_path": cfg.get('db_path'), 
        "file_path": cfg.get('file_path')
    }

    # 1. Fetch Raw
    raw_result = ps_fetch_latest_raw(fetch_cfg)
    
    # 2. Normalize
    normalized = ps_normalize(raw_result, mapping or {})

    return {
        "raw": raw_result.get('items', []), 
        "raw_meta": raw_result.get('raw'),
        "normalized": normalized,
        "error": raw_result.get('error')
    }

# ========================
# CONTROL ENDPOINTS
# ========================

@router.post('/control/test')
def test_relay(payload: ControlTestPayload, username: str = Depends(get_current_user)):
    """Test fire a relay"""
    return control_relay(payload.ip, payload.channel, payload.state, payload.port, payload.unit_id)

@router.post('/control/test_connection')
def test_relay_conn(payload: ControlTestPayload, username: str = Depends(get_current_user)):
    """Test connection to relay board"""
    return test_relay_connection(payload.ip, payload.port)

@router.post('/config/control/{project_id}')
def save_control_config(project_id: str, payload: ControlConfigPayload, username: str = Depends(get_current_user)):
    """Save control mapping configuration"""
    try:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))
        path = os.path.join(root, project_id, "ConfigControl.json")
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(payload.dict(), f, indent=2)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/config/control/{project_id}')
def get_control_config(project_id: str, username: str = Depends(get_current_user)):
    """Get control mapping configuration"""
    try:
        if getattr(sys, 'frozen', False):
            projects_root = os.path.join(os.path.dirname(sys.executable), 'projects')
        else:
            projects_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))
            
        path = os.path.join(projects_root, project_id, "ConfigControl.json")
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"relays": [], "mappings": []}
    except Exception as e:
        return {"relays": [], "mappings": []}
