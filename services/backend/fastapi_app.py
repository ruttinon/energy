from fastapi import FastAPI, HTTPException, Response, Depends, Cookie
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid, os, json, secrets, time
from typing import Optional
import qrcode
import base64
from io import BytesIO
import traceback
import threading, socket, struct, ctypes, sqlite3
import hmac
from datetime import datetime, timedelta
from .api.trend_api import get_device_registers
from .api.trend_api import get_device_registers
from .api.history_api import query_history
from .api.xlsx_storage import save_readings_batch, save_device_status, generate_monthly_summary, auto_rotate_year
from services.backend.api.alert_module.alert_engine import check_alerts
from services.backend.api.alert_module.alert_routes import router as alert_router
from services.backend.api.photoview.photoview_router import router as photoview_router
from services.backend.api.report_builder.report_router import router as report_router
from services.backend.api.billing.billing_router import router as billing_router

# =============================
# MQTT SUPPORT (optional)
# =============================
try:
    import paho.mqtt.client as mqtt
except Exception:
    mqtt = None

# =============================
# PATH ROOT
# =============================
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PROJECTS_ROOT = os.path.join(ROOT, 'projects')
os.makedirs(PROJECTS_ROOT, exist_ok=True)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

# Include Alert Router
app.include_router(alert_router, prefix="/api/alert", tags=["Alerts"])
app.include_router(photoview_router, prefix="/api/photoview", tags=["Photoview"])
app.include_router(report_router, prefix="/api/report", tags=["Reports"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])

from services.backend.api.report_builder.template_router import router as template_router
app.include_router(template_router, prefix="/api/report_template", tags=["Templates"])

# =============================
# SERVE FRONTEND
# =============================
FRONTEND_DIR = os.path.join(ROOT, "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")

# Home → User page
@app.get("/")
def home():
    return RedirectResponse(url="/frontend/user.html")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(FRONTEND_DIR, "favicon.ico"))

# =============================
# SESSION & USER FILES
# =============================
SESSIONS_FILE = os.path.join(os.path.dirname(__file__), 'sessions.json')
USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.json')
CONTROL_FILE = os.path.join(os.path.dirname(__file__), '..', 'manager', 'control.json')

# Create files if missing
if not os.path.exists(SESSIONS_FILE):
    with open(SESSIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)

if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)

if not os.path.exists(CONTROL_FILE):
    os.makedirs(os.path.dirname(CONTROL_FILE), exist_ok=True)
    with open(CONTROL_FILE, 'w', encoding='utf-8') as f:
        json.dump({"active": ""}, f)

def load_sessions():
    try:
        with open(SESSIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_sessions(s):
    try:
        with open(SESSIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(s, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

def load_users():
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def get_user_obj(username: str):
    try:
        users = load_users()
        if isinstance(users, dict):
            return users.get(username)
        if isinstance(users, list):
            for u in users:
                if str(u.get('username')) == str(username):
                    return u
        return None
    except Exception:
        return None

def get_current_user(session_id: Optional[str] = Cookie(None)):
    sessions = load_sessions()
    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    username = sessions.get(session_id)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return username

def is_admin(username: str) -> bool:
    u = get_user_obj(username)
    return (u or {}).get("role") == "admin"

class LoginPayload(BaseModel):
    username: str
    password: str
    project_id: Optional[str] = None

def _hash_password(password: str, salt: Optional[str]):
    import hashlib, hmac
    s = (salt or '').encode('utf-8')
    p = password.encode('utf-8')
    return hashlib.sha256(s + p).hexdigest()

def _verify_password(user: dict, password: str) -> bool:
    if not user:
        return False
    pw_hash = user.get('password_hash')
    salt = user.get('salt')
    if pw_hash and salt:
        return hmac.compare_digest(_hash_password(password, salt), pw_hash)
    return hmac.compare_digest(str(user.get('password') or ''), password)

@app.post('/api/login')
def api_login(payload: LoginPayload, response: Response):
    u = get_user_obj(payload.username)
    if not _verify_password(u, payload.password):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    sid = uuid.uuid4().hex
    sessions = load_sessions()
    sessions[sid] = payload.username
    save_sessions(sessions)
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    return {"username": payload.username, "role": (u or {}).get('role', 'user'), "allowed_projects": (u or {}).get('allowed_projects', [])}

@app.post('/api/logout')
def api_logout(session_id: Optional[str] = Cookie(None), response: Response = None):
    sessions = load_sessions()
    if session_id and session_id in sessions:
        try:
            sessions.pop(session_id, None)
            save_sessions(sessions)
        except Exception:
            pass
    if response is not None:
        response.delete_cookie('session_id')
    return {"ok": True}

# =============================
# QR LOGIN (one-time token)
# =============================
class QrStartPayload(BaseModel):
    redirect: Optional[str] = None
    project_id: Optional[str] = None

class QrConfirmPayload(BaseModel):
    token: str
    username: str
    password: str

QR_TOKENS = {}
QR_LOCK = threading.Lock()
QR_TTL = 180

def _cleanup_qr():
    now = time.time()
    with QR_LOCK:
        for k in list(QR_TOKENS.keys()):
            if QR_TOKENS[k].get('expires', 0) < now:
                QR_TOKENS.pop(k, None)

@app.post('/api/qr_login/start')
def qr_login_start(payload: QrStartPayload):
    _cleanup_qr()
    token = secrets.token_hex(16)
    expires = time.time() + QR_TTL
    base = os.getenv('PUBLIC_BASE') or ''
    try:
        base = base or (FRONTEND_DIR and '')
    except Exception:
        pass
    # URL for mobile confirmation page
    url = f"/frontend/login_qr_confirm.html?token={token}"
    # Generate QR image for this URL
    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    with QR_LOCK:
        QR_TOKENS[token] = {"status": "pending", "expires": expires, "sid": None, "username": None, "redirect": payload.redirect, "pid": payload.project_id}
    return {"token": token, "expires": int(expires), "qr": f"data:image/png;base64,{qr_b64}", "url": url}

@app.get('/api/qr_login/status')
def qr_login_status(token: str):
    _cleanup_qr()
    with QR_LOCK:
        info = QR_TOKENS.get(token)
    if not info:
        return {"status": "expired"}
    return {"status": info.get('status')}

@app.post('/api/qr_login/confirm')
def qr_login_confirm(payload: QrConfirmPayload):
    _cleanup_qr()
    with QR_LOCK:
        info = QR_TOKENS.get(payload.token)
    if not info:
        raise HTTPException(status_code=410, detail="QR token expired")
    # verify credentials
    u = get_user_obj(payload.username)
    if not _verify_password(u, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    sid = uuid.uuid4().hex
    sessions = load_sessions()
    sessions[sid] = payload.username
    save_sessions(sessions)
    with QR_LOCK:
        info.update({"status": "approved", "sid": sid, "username": payload.username})
        QR_TOKENS[payload.token] = info
    return {"ok": True}

@app.post('/api/qr_login/finalize')
def qr_login_finalize(token: str, response: Response):
    _cleanup_qr()
    with QR_LOCK:
        info = QR_TOKENS.get(token)
    if not info or info.get('status') != 'approved':
        raise HTTPException(status_code=400, detail="Not approved")
    sid = info.get('sid')
    username = info.get('username')
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    # remove token after use
    with QR_LOCK:
        QR_TOKENS.pop(token, None)
    u = get_user_obj(username)
    pid = info.get('pid')
    redirect = info.get('redirect') or (f"/frontend/user.html?pid={pid}" if pid else None)
    return {"username": username, "role": (u or {}).get('role', 'user'), "allowed_projects": (u or {}).get('allowed_projects', []), "redirect": redirect}

@app.post('/api/qr_login/start_user')
def qr_login_start_user(project_id: str):
    """Convenience endpoint for user login bound to a project."""
    return qr_login_start(QrStartPayload(redirect=f"/frontend/user.html?pid={project_id}", project_id=project_id))

# -----------------------------
# API: device registers (used by frontend/trend.js)
@app.get("/api/device/registers")
def api_device_registers(device: str, project_id: Optional[str] = None):
    """
    Return list of registers for device (called by frontend trend.js).
    """
    try:
        pid = project_id or load_active().get('active')
        if not pid:
            return {"registers": []}
        regs = get_device_registers(pid, device)
        return {"registers": regs}
    except Exception as e:
        traceback.print_exc()
        return {"registers": [], "error": str(e)}

# =============================
# ACTIVE PROJECT STORAGE
# =============================
from services.backend.shared_state import (
    load_active, save_active, 
    READINGS, READINGS_LOCK, POLL_THREADS, STOP_FLAGS, PURGED_DATA, COMMANDS
)

# =============================
# PROJECT CREATION API
# =============================
class ProjectCreate(BaseModel):
    name: str

@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectCreate, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    # Generate Project ID
    pid = payload.name.replace(" ", "_") + "-" + uuid.uuid4().hex[:6]
    path = os.path.join(PROJECTS_ROOT, pid)
    os.makedirs(path, exist_ok=True)

    # ------------------------
    # Create ConfigDevice.json
    # ------------------------
    cfg = {
        "version": "1.0",
        "project_id": pid,
        "converters": []
    }

    with open(os.path.join(path, "ConfigDevice.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

    # ------------------------
    # Create QR Code
    # ------------------------
    qr = qrcode.make(pid)
    buf = BytesIO()
    qr.save(buf, format="PNG")

    qr_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # ------------------------
    # Create Project.json
    # ------------------------
    meta = {
        "project_name": payload.name,
        "project_id": pid,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "ingest_token": secrets.token_hex(16)
    }

    with open(os.path.join(path, "Project.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    # ------------------------
    # Set Active Project
    # ------------------------
    save_active(pid)

    return {"project_id": pid}

# =============================
# GET ACTIVE PROJECT
# =============================
@app.get("/api/active")
def get_active(username: str = Depends(get_current_user)):
    return load_active()

@app.get('/api/me')
def get_me(username: str = Depends(get_current_user)):
    u = get_user_obj(username)
    return {"username": username, "role": u.get("role", "user") if u else "user", "allowed_projects": u.get("allowed_projects", []) if u else []}

# user-visible projects (no admin required)
@app.get('/api/user/projects')
def get_user_projects(username: str = Depends(get_current_user)):
    u = get_user_obj(username)
    allowed = set(u.get("allowed_projects", [])) if u else set()
    projects = []
    for name in os.listdir(PROJECTS_ROOT):
        full = os.path.join(PROJECTS_ROOT, name)
        if not os.path.isdir(full):
            continue
        if allowed and name not in allowed:
            continue
        project_json = os.path.join(full, "Project.json")
        display = name
        if os.path.exists(project_json):
            try:
                with open(project_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    display = data.get('project_name', name)
            except Exception:
                pass
        projects.append({"project_id": name, "project_name": display})
    return {"projects": projects, "active": load_active().get('active')}

# =============================
# PUBLIC (no login) read-only endpoints
# =============================

@app.get('/public/projects')
def public_projects():
    projects = []
    for name in os.listdir(PROJECTS_ROOT):
        full = os.path.join(PROJECTS_ROOT, name)
        if not os.path.isdir(full):
            continue
        project_json = os.path.join(full, 'Project.json')
        display = name
        if os.path.exists(project_json):
            try:
                with open(project_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    display = data.get('project_name', name)
            except Exception:
                pass
        projects.append({"project_id": name, "project_name": display})
    return {"projects": projects, "active": load_active().get('active')}

@app.get('/public/projects/{project_id}/devices')
def public_devices(project_id: str):
    cfg_path = _config_path(project_id)
    if not os.path.exists(cfg_path):
        return {"devices": []}
    with open(cfg_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result = []
    for conv in data.get('converters', []):
        for dev in (conv.get('devices') or []):
            ip = dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address')
            port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
            result.append({
                "id": dev.get('id'),
                "name": dev.get('name'),
                "manufacturer": dev.get('manufacturer'),
                "model": dev.get('model'),
                "converter": conv.get('name') or conv.get('protocol'),
                "template_ref": dev.get('template_ref'),
                "modbus_slave": dev.get('modbus_slave') or dev.get('address'),
                "modbus_ip": ip,
                "modbus_port": port
            })
    return {"devices": result}

@app.get('/public/projects/{project_id}/readings')
def public_readings(project_id: str):
    _ensure_poller(project_id)
    items = []
    data = READINGS.get(project_id, {})
    cfg_path = _config_path(project_id)
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            for conv in cfg.get('converters', []):
                for dev in (conv.get('devices') or []):
                    dev_id = str(dev.get('id'))
                    tpl = _load_device_template(dev.get('template_ref') or '')
                    regs = tpl.get('registers', [])
                    rec = data.get(dev_id, {})
                    ts = rec.get('timestamp')
                    dvname = rec.get('device_name') or dev.get('name')
                    for r in regs:
                        key = r.get('key')
                        val = (rec.get('values') or {}).get(key)
                        items.append({
                            "device_id": dev_id,
                            "device_name": dvname,
                            "parameter": key,
                            "value": val,
                            "unit": r.get('unit'),
                            "description": r.get('description'),
                            "timestamp": ts
                        })
        except Exception:
            pass
    else:
        for dev_id, rec in data.items():
            for key, val in (rec.get('values') or {}).items():
                meta = (rec.get('meta') or {}).get(key, {})
                items.append({
                    "device_id": dev_id,
                    "device_name": rec.get('device_name'),
                    "parameter": key,
                    "value": val,
                    "unit": meta.get('unit'),
                    "description": meta.get('description'),
                    "timestamp": rec.get('timestamp')
                })
    return {"items": items}

# =============================
# MANUALLY SET ACTIVE PROJECT
# =============================
@app.post("/api/active/{project_id}")
def set_active(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    target = os.path.join(PROJECTS_ROOT, project_id)

    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="Project not found")

    save_active(project_id)
    return {"ok": True, "active": project_id}

# ============= API: RETURN PROJECT LIST =============
@app.get("/api/projects/list")
def get_project_list(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not os.path.exists(PROJECTS_ROOT):
        return {"projects": []}

    projects = []
    for name in os.listdir(PROJECTS_ROOT):
        full = os.path.join(PROJECTS_ROOT, name)
        if os.path.isdir(full):
            # อ่าน Project.json เพื่อเอาชื่อโปรเจกต์
            project_json = os.path.join(full, "Project.json")
            if os.path.exists(project_json):
                try:
                    with open(project_json, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        projects.append({
                            "project_id": name,
                            "project_name": data.get("project_name", name)
                        })
                except:
                    # ถ้าอ่านไม่ได้ ใช้ชื่อโฟลเดอร์
                    projects.append({
                        "project_id": name,
                        "project_name": name
                    })
            else:
                projects.append({
                    "project_id": name,
                    "project_name": name
                })

    return {"projects": projects}

# ============= GET PROJECT INFO =============
@app.get("/api/projects/{project_id}/info")
def get_project_info(project_id: str, username: str = Depends(get_current_user)):
    path = os.path.join(PROJECTS_ROOT, project_id)
    project_json = os.path.join(path, "Project.json")
    
    if not os.path.exists(project_json):
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        with open(project_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "project_id": project_id,
                "project_name": data.get("project_name", project_id),
                "qr_code": data.get("qr_code", "")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================
# DEVICE TEMPLATE & PROTOCOL APIs
# =============================

DEVICE_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'device_templates')
PROTOCOL_DIR = os.path.join(os.path.dirname(__file__), 'protocol')
EXCEL_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'excel_templates')

@app.get('/api/templates/devices')
def list_device_templates(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = []
    if not os.path.exists(DEVICE_TEMPLATES_DIR):
        return {"templates": []}

    for mfg in sorted(os.listdir(DEVICE_TEMPLATES_DIR)):
        mfg_path = os.path.join(DEVICE_TEMPLATES_DIR, mfg)
        if not os.path.isdir(mfg_path):
            continue
        for fname in sorted(os.listdir(mfg_path)):
            if not fname.lower().endswith('.json'):
                continue
            full = os.path.join(mfg_path, fname)
            try:
                data = json.loads(open(full, 'r', encoding='utf-8').read())
            except Exception:
                data = {}
            model = os.path.splitext(fname)[0]
            result.append({
                "manufacturer": mfg,
                "model": model,
                "path": f"/services/backend/device_templates/{mfg}/{fname}",
                "polling_interval": data.get("polling_interval"),
                "registers_count": len(data.get("registers", []))
            })
    return {"templates": result}

@app.get('/api/templates/protocols')
def list_protocols(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    items = []
    if not os.path.exists(PROTOCOL_DIR):
        return {"protocols": []}
    for fname in sorted(os.listdir(PROTOCOL_DIR)):
        if not fname.lower().endswith('.json'):
            continue
        full = os.path.join(PROTOCOL_DIR, fname)
        try:
            data = json.loads(open(full, 'r', encoding='utf-8').read())
        except Exception:
            data = {}
        proto_id = os.path.splitext(fname)[0]
        items.append({
            "id": proto_id,
            "name": data.get("name", proto_id),
            "type": data.get("type"),
            "description": data.get("description"),
            "network_settings": data.get("network_settings", {}),
            "connection_types": data.get("connection_types", []),
            "examples": data.get("examples", {})
        })
    return {"protocols": items}

# =============================
# Excel templates & data preview
# =============================

@app.get('/api/excel/templates')
def list_excel_templates(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    items = []
    if not os.path.isdir(EXCEL_TEMPLATES_DIR):
        return {"templates": []}
    try:
        for fname in sorted(os.listdir(EXCEL_TEMPLATES_DIR)):
            if not fname.lower().endswith('.xlsx'):
                continue
            full = os.path.join(EXCEL_TEMPLATES_DIR, fname)
            try:
                st = os.stat(full)
                items.append({
                    "id": os.path.splitext(fname)[0],
                    "filename": fname,
                    "size": st.st_size,
                    "modified": int(st.st_mtime)
                })
            except Exception:
                items.append({"id": os.path.splitext(fname)[0], "filename": fname})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"templates": items}

@app.get('/api/projects/{project_id}/excel/preview')
def excel_data_preview(project_id: str, date: Optional[str] = None, username: str = Depends(get_current_user)):
    _ensure_poller(project_id)
    data = READINGS.get(project_id, {})
    devices = []
    try:
        for dev_id, rec in (data or {}).items():
            devices.append({
                "device_id": dev_id,
                "device_name": rec.get('device_name'),
                "converter": rec.get('converter'),
                "timestamp": rec.get('timestamp'),
                "values": rec.get('values') or {},
                "meta": rec.get('meta') or {}
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"date": date, "total_devices": len(devices), "devices": devices}

# =============================
# PROJECT CONFIG APIs (per project)
# =============================

def _project_path(project_id: str):
    return os.path.join(PROJECTS_ROOT, project_id)

def _config_path(project_id: str):
    return os.path.join(_project_path(project_id), 'ConfigDevice.json')

@app.get('/api/projects/{project_id}/config')
def get_project_config(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    cfg_path = _config_path(project_id)
    try:
        if not os.path.exists(cfg_path):
            os.makedirs(_project_path(project_id), exist_ok=True)
            base = {
                "version": "1.0",
                "project_id": project_id,
                "converters": []
            }
            with open(cfg_path, 'w', encoding='utf-8') as f:
                json.dump(base, f, indent=2, ensure_ascii=False)
            return base
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'converters' not in data:
            data['converters'] = []
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProjectConfigUpdate(BaseModel):
    converters: list

@app.post('/api/projects/{project_id}/config')
def update_project_config(project_id: str, payload: ProjectConfigUpdate, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    cfg_path = _config_path(project_id)
    try:
        os.makedirs(_project_path(project_id), exist_ok=True)
        if os.path.exists(cfg_path):
            with open(cfg_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {
                "version": "1.0",
                "project_id": project_id,
                "converters": []
            }
        data['converters'] = payload.converters or []
        with open(cfg_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================
# REALTIME READER (MODBUS TCP)
# =============================

from .shared_state import READINGS, READINGS_LOCK

POLL_THREADS = {}
STOP_FLAGS = {}
PURGED_DATA = set()
COMMANDS = {}
PROBE_HINTS = {}
_DB_LOCK = threading.Lock()
RETENTION_DAYS = int(os.getenv('SQLITE_RETENTION_DAYS') or 90)

def _project_db_file(project_id: str):
    return os.path.join(_project_data_dir(project_id), 'readings.db')

def _init_db(project_id: str):
    with _DB_LOCK:
        dbf = _project_db_file(project_id)
        conn = sqlite3.connect(dbf)
        cur = conn.cursor()
        cur.execute('CREATE TABLE IF NOT EXISTS readings (project_id TEXT, device_id TEXT, parameter TEXT, value REAL, unit TEXT, description TEXT, timestamp TEXT)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_readings_proj_ts ON readings(project_id, timestamp)')
        conn.commit()
        conn.close()

def _snapshot_to_db():
    with _DB_LOCK:
        for pid, devs in READINGS.items():
            if not _is_sqlite_enabled(pid):
                continue
            _init_db(pid)
            dbf = _project_db_file(pid)
            conn = sqlite3.connect(dbf)
            cur = conn.cursor()
            for did, rec in (devs or {}).items():
                ts = rec.get('timestamp')
                meta = rec.get('meta') or {}
                for k, v in (rec.get('values') or {}).items():
                    m = meta.get(k) or {}
                    cur.execute('INSERT INTO readings (project_id, device_id, parameter, value, unit, description, timestamp) VALUES (?,?,?,?,?,?,?)', (pid, str(did), k, None if v is None else float(v), m.get('unit'), m.get('description'), ts))
            try:
                cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).strftime('%Y-%m-%d %H:%M:%S')
                cur.execute('DELETE FROM readings WHERE project_id=? AND timestamp < ?', (pid, cutoff))
            except Exception:
                pass
            conn.commit()
            conn.close()

def _start_snapshot_thread():
    def _run():
        while True:
            try:
                _snapshot_to_db()
            except Exception:
                pass
            time.sleep(900)
    t = threading.Thread(target=_run, daemon=True)
    t.start()

def _project_data_dir(project_id: str):
    p = os.path.join(_project_path(project_id), 'data')
    os.makedirs(p, exist_ok=True)
    return p

def _project_readings_file(project_id: str):
    return os.path.join(_project_data_dir(project_id), 'readings.json')

def _load_project_readings(project_id: str):
    fp = _project_readings_file(project_id)
    if not os.path.exists(fp):
        return {}
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_project_readings(project_id: str, data: dict):
    fp = _project_readings_file(project_id)
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _modbus_later_dir(project_id: str):
    d = os.path.join(_project_data_dir(project_id), 'modbus_later')
    os.makedirs(d, exist_ok=True)
    return d

def _device_series_path(project_id: str, converter_name: str, device_filename: str):
    base = _modbus_later_dir(project_id)
    conv_dir = os.path.join(base, str(converter_name or 'converter'))
    os.makedirs(conv_dir, exist_ok=True)
    return os.path.join(conv_dir, f"{device_filename}.json")

def _append_device_series(project_id: str, converter_name: str, device_filename: str, payload: dict, limit: int = 1000):
    return

def _decode_registers(regs, datatype: str, scale: float):
    try:
        dt = (datatype or '').lower()
        scale = float(scale or 1)
        if 'float32' in dt and len(regs) >= 2:
            b = bytes([(int(regs[0]) >> 8) & 0xFF, int(regs[0]) & 0xFF, (int(regs[1]) >> 8) & 0xFF, int(regs[1]) & 0xFF])
            import struct as _st
            val_abcd = _st.unpack('>f', b)[0]
            val_dcba = _st.unpack('<f', b)[0]
            swapped = bytes([b[2], b[3], b[0], b[1]])
            val_badc = _st.unpack('>f', swapped)[0]
            val_cdab = _st.unpack('>f', swapped)[0]
            if '_abcd' in dt or dt.endswith('_be'):
                val = val_abcd
            elif '_dcba' in dt or dt.endswith('_le'):
                val = val_dcba
            elif '_badc' in dt:
                val = val_badc
            elif '_cdab' in dt:
                val = val_cdab
            else:
                for val in (val_abcd, val_dcba, val_badc, val_cdab):
                    if abs(val) > 0.1:
                        return round(val/scale, 6)
                return round(val_abcd/scale, 6)
            return round(val/scale, 6)
        if 'int32' in dt and len(regs) >= 2:
            raw = (int(regs[0]) << 16) | (int(regs[1]) & 0xFFFF)
            if raw >= 0x80000000:
                raw -= 0x100000000
            return round(raw/scale, 6)
        if 'uint32' in dt and len(regs) >= 2:
            raw = (int(regs[0]) << 16) | (int(regs[1]) & 0xFFFF)
            return round(raw/scale, 6)
        if 'int16' in dt and regs:
            v = int(regs[0])
            if v >= 0x8000:
                v -= 0x10000
            return round(v/scale, 6)
        if regs:
            return round(int(regs[0])/scale, 6)
    except Exception:
        return None

def _read_modbus_tcp_raw(ip, port, unit_id, function, address, count, timeout=2):
    try:
        tid = int(time.time() * 1000) & 0xFFFF
        pid = 0
        length = 6
        pdu = struct.pack('>B B H H', unit_id, function, address, count)
        mbap = struct.pack('>H H H', tid, pid, length)
        req = mbap + pdu
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        except Exception:
            pass
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(req)
        data = s.recv(1024)
        s.close()
        if len(data) < 9:
            return None
        _, func, byte_count = struct.unpack('>B B B', data[6:9])
        if func != function:
            return None
        regs = []
        for i in range(0, byte_count, 2):
            regs.append((data[9+i] << 8) + data[10+i])
        return regs
    except Exception:
        return None

def _read_modbus_rtu_over_tcp(ip, port, unit_id, function, address, count, timeout=2):
    try:
        payload = struct.pack('>B B H H', unit_id, function, address, count)
        crc = 0xFFFF
        for ch in payload:
            crc ^= ch
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        frame = payload + struct.pack('<H', crc)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(frame)
        reply = s.recv(1024)
        s.close()
        if len(reply) < 5 or reply[0] != unit_id or reply[1] != function:
            return None
        byte_count = reply[2]
        regs = []
        for i in range(0, byte_count, 2):
            regs.append((reply[3 + i] << 8) + reply[4 + i])
        return regs
    except Exception:
        return None

def _template_path_from_ref(ref: str):
    # ref like "/services/backend/device_templates/circutor/CVM-C4.json"
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    if ref.startswith('/'):
        ref = ref[1:]
    return os.path.join(base, ref.replace('/', os.sep))

def _load_device_template(ref: str):
    try:
        p = _template_path_from_ref(ref)
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"registers": []}

def _poll_device(project_id: str, conv: dict, dev: dict):
    """Enhanced polling with better error handling and alert integration"""
    
    device_id = str(dev.get('id'))
    device_name = dev.get('name', device_id)
    
    print(f"\n{'='*60}")
    print(f"[POLLER] Starting thread for {device_name} ({device_id})")
    print(f"{'='*60}")
    
    # Get connection details
    ip = dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address')
    port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
    unit_id = int(dev.get('modbus_slave') or dev.get('address') or 1)
    
    if not ip:
        print(f"[POLLER] ❌ ERROR: No IP address configured for {device_name}")
        return
    
    print(f"[POLLER] 📡 Connection: {ip}:{port} (Unit {unit_id})")
    
    # Load template
    tpl = _load_device_template(dev.get('template_ref') or '')
    regs = tpl.get('registers', [])
    
    if not regs:
        print(f"[POLLER] ⚠️  WARNING: No registers defined for {device_name}")
        return
    
    print(f"[POLLER] 📋 Loaded {len(regs)} registers from template")
    
    interval = int((dev.get('polling_interval') if dev else None) or (tpl.get('polling_interval') if tpl else None) or 3)
    timeout = float(dev.get('modbus_timeout') or (conv.get('settings') or {}).get('timeout') or 5)
    
    print(f"[POLLER] ⏱️  Poll interval: {interval}s, Timeout: {timeout}s")

    key = f"{project_id}:{device_id}"
    STOP_FLAGS[key] = False
    
    poll_count = 0
    error_count = 0
    success_count = 0

    def _compute_probe_hint():
        try:
            candidates = []
            for r in regs[:min(8, len(regs))]:
                try:
                    candidates.append((int(r.get('function') or 3), int(r.get('address') or 0), int(r.get('words') or 2)))
                except Exception:
                    pass
            if not candidates:
                candidates = [(3,0,2),(4,0,2)]
            for func, addr, words in candidates:
                rr = _read_modbus_tcp_raw(ip, port, unit_id, func, addr, words, timeout=timeout)
                if rr is None and func == 3:
                    rr = _read_modbus_tcp_raw(ip, port, unit_id, 4, addr, words, timeout=timeout)
                if rr is not None:
                    base_addr = regs[0].get('address') if regs else addr
                    try:
                        base_addr = int(base_addr or 0)
                    except Exception:
                        base_addr = addr
                    off = int(addr) - int(base_addr)
                    f_override = func
                    return {"offset": off, "function": f_override}
        except Exception:
            pass
        return None

    # Purge old data once
    if project_id not in PURGED_DATA:
        print(f"[POLLER] 🗑️  Purging old data directory...")
        base = _project_data_dir(project_id)
        try:
            fp = os.path.join(base, 'readings.json')
            if os.path.exists(fp):
                os.remove(fp)
        except Exception:
            pass
        PURGED_DATA.add(project_id)

    print(f"[POLLER] 🚀 Starting polling loop...\n")

    while not STOP_FLAGS.get(key, False):
        poll_count += 1
        
        try:
            values = {}
            
            # Probe if needed
            hint = PROBE_HINTS.get(key)
            if hint is None:
                print(f"[POLLER] 🔍 Probing device communication...")
                hint = _compute_probe_hint()
                if hint:
                    PROBE_HINTS[key] = hint
                    print(f"[POLLER] ✅ Probe successful: offset={hint.get('offset')}, func={hint.get('function')}")
                else:
                    print(f"[POLLER] ⚠️  Probe failed, using default settings")
            
            # Read all registers
            for r in regs:
                addr = int(r.get('address') or 0)
                func = int(r.get('function') or 3)
                words = int(r.get('words') or 2)
                datatype = r.get('datatype') or 'int16'
                scale = float(r.get('scale') or 1)
                reg_key = r.get('key')
                
                # Apply hint
                if hint:
                    try:
                        addr = addr + int(hint.get('offset') or 0)
                        func = int(hint.get('function') or func)
                    except Exception:
                        pass
                
                # Try reading
                rr = _read_modbus_tcp_raw(ip, port, unit_id, func, addr, words, timeout=timeout)
                
                if rr is None and func == 3:
                    rr = _read_modbus_tcp_raw(ip, port, unit_id, 4, addr, words, timeout=timeout)
                
                if rr is not None:
                    val = _decode_registers(rr, datatype, scale)
                    values[reg_key] = val
                else:
                    values[reg_key] = None
            
            # Check if we got any data
            online = any(v is not None for v in values.values())
            
            if online:
                success_count += 1
                error_count = 0  # Reset error counter
                
                if poll_count % 10 == 0:  # Log every 10 polls
                    print(f"[POLLER] ✅ Poll #{poll_count}: {device_name} - {sum(1 for v in values.values() if v is not None)}/{len(values)} registers OK")
            else:
                error_count += 1
                print(f"[POLLER] ❌ Poll #{poll_count}: {device_name} - No data received (error #{error_count})")
                
                # Retry probe after 3 consecutive errors
                if error_count >= 3:
                    print(f"[POLLER] 🔄 Retrying probe after {error_count} errors...")
                    new_hint = _compute_probe_hint()
                    if new_hint:
                        PROBE_HINTS[key] = new_hint
                        error_count = 0
            
            # Update memory cache
            READINGS.setdefault(project_id, {})[device_id] = {
                "device_name": device_name,
                "converter": conv.get('name') or conv.get('protocol'),
                "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                "values": values,
                "meta": {k: {"unit": r.get('unit'), "description": r.get('description')} for k, r in [(x.get('key'), x) for x in regs]},
                "online": online,
                "last_error": None if online else "no_data"
            }
            
            # 🔥 TRIGGER ALERTS - THIS IS THE KEY PART!
            if online:
                try:
                    print(f"[POLLER] 🚨 Checking alerts for {device_name}...")
                    alerts = check_alerts(values, device_id, project_id, dry_run=False)
                    if alerts:
                        print(f"[POLLER] 📢 Generated {len(alerts)} alert(s)")
                except Exception as e:
                    print(f"[POLLER] ⚠️  Alert check error: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Save to Excel
            try:
                unit_map = {(r.get('key') or ''): (r.get('unit') or '') for r in regs}
                readings_list = []
                for k, v in values.items():
                    if v is not None:
                        readings_list.append({
                            'device_id': device_id,
                            'device_name': device_name,
                            'key': k,
                            'value': v,
                            'unit': unit_map.get(k, '')
                        })
                
                if readings_list:
                    save_readings_batch(project_id, readings_list)
                    save_device_status(project_id, device_id, device_name, 
                                     'online' if online else 'offline', 
                                     datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            except Exception as e:
                print(f"[POLLER] ⚠️  Excel save error: {e}")
            
        except Exception as e:
            print(f"[POLLER] ❌ Polling error: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
        
        # Sleep
        time.sleep(max(1, interval))
    
    print(f"\n[POLLER] 🛑 Stopped polling {device_name} (total polls: {poll_count}, success: {success_count})")

def _ensure_poller(project_id: str):
    """Enhanced poller starter with better logging"""
    print(f"\n[POLLER] 🔧 Ensuring pollers for project: {project_id}")
    
    cfg_path = _config_path(project_id)
    if not os.path.exists(cfg_path):
        print(f"[POLLER] ⚠️  Config not found: {cfg_path}")
        return
    
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"[POLLER] ❌ Failed to load config: {e}")
        return
    
    started = 0
    skipped = 0
    
    for conv in data.get('converters', []):
        conv_name = conv.get('name') or conv.get('protocol')
        print(f"\n[POLLER] 📡 Converter: {conv_name}")
        
        for dev in (conv.get('devices') or []):
            device_id = str(dev.get('id'))
            device_name = dev.get('name', device_id)
            
            if dev.get('ingest_only') or conv.get('ingest_only'):
                print(f"[POLLER]   ⏭️  Skipping {device_name} (ingest_only)")
                skipped += 1
                continue
            
            key = f"{project_id}:{device_id}"
            t = POLL_THREADS.get(key)
            
            if t and t.is_alive():
                print(f"[POLLER]   ✅ {device_name} - Already running")
            else:
                print(f"[POLLER]   🚀 Starting {device_name}...")
                th = threading.Thread(
                    target=_poll_device, 
                    args=(project_id, conv, dev), 
                    daemon=True,
                    name=f"poll_{device_name}"
                )
                POLL_THREADS[key] = th
                th.start()
                started += 1
    
    print(f"\n[POLLER] 📊 Summary: {started} started, {skipped} skipped\n")

@app.get('/api/projects/{project_id}/readings')
def get_readings(project_id: str, username: str = Depends(get_current_user)):
    _ensure_poller(project_id)
    items = []
    data = READINGS.get(project_id, {})
    for dev_id, rec in data.items():
        # flatten per parameter
        for key, val in (rec.get('values') or {}).items():
            meta = (rec.get('meta') or {}).get(key, {})
            items.append({
                "device_id": dev_id,
                "device_name": rec.get('device_name'),
                "parameter": key,
                "value": val,
                "unit": meta.get('unit'),
                "description": meta.get('description'),
                "timestamp": rec.get('timestamp')
            })
    return {"items": items}

# =============================
# Diagnostics endpoints
# =============================

@app.get('/api/diagnostics/modbus_tcp')
def diag_modbus_tcp(ip: str, port: int = 502, unit_id: int = 1, address: int = 0, count: int = 2, function: int = 3, timeout: float = 5.0, username: str = Depends(get_current_user)):
    t0 = time.time()
    regs = _read_modbus_tcp_raw(ip, port, unit_id, function, address, count, timeout=timeout)
    dt = time.time() - t0
    if regs is None:
        raise HTTPException(status_code=504, detail=f"No response from {ip}:{port} (timeout={timeout}s)")
    return {"ip": ip, "port": port, "unit_id": unit_id, "function": function, "address": address, "count": count, "response_time_ms": int(dt*1000), "registers": regs}

@app.get('/public/diagnostics/modbus_tcp')
def public_diag_modbus_tcp(ip: str, port: int = 502, unit_id: int = 1, address: int = 0, count: int = 2, function: int = 3, timeout: float = 5.0):
    t0 = time.time()
    regs = _read_modbus_tcp_raw(ip, port, unit_id, function, address, count, timeout=timeout)
    dt = time.time() - t0
    if regs is None:
        raise HTTPException(status_code=504, detail=f"No response from {ip}:{port} (timeout={timeout}s)")
    return {"ip": ip, "port": port, "unit_id": unit_id, "function": function, "address": address, "count": count, "response_time_ms": int(dt*1000), "registers": regs}

@app.get('/public/diagnostics/modbus_rtu_over_tcp')
def public_diag_modbus_rtu_over_tcp(ip: str, port: int = 502, unit_id: int = 1, address: int = 0, count: int = 2, function: int = 3, timeout: float = 5.0):
    t0 = time.time()
    regs = _read_modbus_rtu_over_tcp(ip, port, unit_id, function, address, count, timeout=timeout)
    if regs is None and function == 3:
        regs = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, address, count, timeout=timeout)
    dt = time.time() - t0
    if regs is None:
        raise HTTPException(status_code=504, detail=f"No response from {ip}:{port} (timeout={timeout}s)")
    return {"ip": ip, "port": port, "unit_id": unit_id, "function": function, "address": address, "count": count, "response_time_ms": int(dt*1000), "registers": regs}

@app.get('/public/diagnostics/tcp_connect')
def public_tcp_connect(ip: str, port: int = 502, timeout: float = 5.0):
    t0 = time.time()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.close()
        dt = time.time() - t0
        return {"ip": ip, "port": port, "response_time_ms": int(dt*1000), "connected": True}
    except Exception as e:
        raise HTTPException(status_code=504, detail=f"TCP connect failed to {ip}:{port} ({str(e)})")

@app.get('/public/diagnostics/modbus_auto')
def public_diag_modbus_auto(ip: str, port: int = 502, unit_id: int = 1, template_path: Optional[str] = None, timeout: float = 5.0, max_try: int = 5):
    t0 = time.time()
    candidates = []
    try:
        if template_path:
            tpl = _load_device_template(template_path)
            for r in (tpl.get('registers') or []):
                try:
                    addr = int(r.get('address') or 0)
                    words = int(r.get('words') or 2)
                    func = int(r.get('function') or 3)
                    candidates.append((func, addr, words))
                    if len(candidates) >= max_try:
                        break
                except Exception:
                    pass
        if not candidates:
            candidates = [(3, 0, 2), (4, 0, 2)]
        for func, addr, words in candidates:
            regs = _read_modbus_tcp_raw(ip, port, unit_id, func, addr, words, timeout=timeout)
            if regs is None and func == 3:
                regs = _read_modbus_tcp_raw(ip, port, unit_id, 4, addr, words, timeout=timeout)
            if regs is not None:
                dt = time.time() - t0
                return {"protocol": "modbus_tcp", "ip": ip, "port": port, "unit_id": unit_id, "function": func, "address": addr, "count": words, "response_time_ms": int(dt*1000), "registers": regs}
            regs = _read_modbus_rtu_over_tcp(ip, port, unit_id, func, addr, words, timeout=timeout)
            if regs is None and func == 3:
                regs = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, addr, words, timeout=timeout)
            if regs is not None:
                dt = time.time() - t0
                return {"protocol": "rtu_over_tcp", "ip": ip, "port": port, "unit_id": unit_id, "function": func, "address": addr, "count": words, "response_time_ms": int(dt*1000), "registers": regs}
        raise HTTPException(status_code=504, detail=f"No registers readable from {ip}:{port} unit {unit_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/devices/status')
def get_devices_status(project_id: Optional[str] = None):
    pid = project_id or load_active().get('active')
    if not pid:
        return {"summary": {"online": 0, "offline": 0, "total": 0}, "devices": []}

    # Load config for static info
    cfg_path = _config_path(pid)
    expected_devices = []
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            for conv in cfg.get('converters', []):
                for dev in (conv.get('devices') or []):
                    ip = dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address')
                    expected_devices.append({
                        "convertor": conv.get('name') or conv.get('protocol'),
                        "name": dev.get('name') or str(dev.get('id')),
                        "device_id": str(dev.get('id')),
                        "ip_address": ip,
                    })
        except:
            pass

    # Load dynamic data
    data = READINGS.get(pid, {})
    output_devices = []
    online_count = 0

    if expected_devices:
        for d in expected_devices:
            did = d['device_id']
            rec = data.get(did, {})
            # Determine status
            is_online = rec.get('online', False)
            
            if is_online:
                online_count += 1
            
            d['status'] = 'online' if is_online else 'offline'
            d['last_update'] = rec.get('timestamp')
            output_devices.append(d)
    else:
        # Fallback if no config
        for dev_id, rec in data.items():
            is_online = rec.get('online', False)
            if is_online:
                online_count += 1
            output_devices.append({
                "convertor": rec.get('converter', 'Unknown'),
                "name": rec.get('device_name', dev_id),
                "device_id": dev_id,
                "ip_address": "",
                "status": "online" if is_online else "offline",
                "last_update": rec.get('timestamp')
            })

    return {
        "summary": {
            "online": online_count,
            "offline": len(output_devices) - online_count,
            "total": len(output_devices)
        },
        "devices": output_devices
    }

@app.get('/api/projects/{project_id}/devices')
def list_project_devices(project_id: str, username: str = Depends(get_current_user)):
    cfg_path = _config_path(project_id)
    if not os.path.exists(cfg_path):
        return {"devices": []}
    with open(cfg_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result = []
    for conv in data.get('converters', []):
        for dev in (conv.get('devices') or []):
            ip = dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address')
            port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
            result.append({
                "id": dev.get('id'),
                "name": dev.get('name'),
                "manufacturer": dev.get('manufacturer'),
                "model": dev.get('model'),
                "converter": conv.get('name') or conv.get('protocol'),
                "template_ref": dev.get('template_ref'),
                "modbus_slave": dev.get('modbus_slave') or dev.get('address'),
                "modbus_ip": ip,
                "modbus_port": port
            })
    return {"devices": result}

@app.get('/api/templates/device_content')
def get_device_template_content(path: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    data = _load_device_template(path)
    return data

@app.get('/api/device/registers')
def api_device_registers(device: str, project_id: Optional[str] = None):
    """ดึง registers จาก device template"""
    try:
        pid = project_id or load_active().get('active')
        if not pid:
            return {"registers": []}
        
        registers = get_device_registers(pid, device)
        return {"registers": registers}
    
    except Exception as e:
        print(f"[ERROR] /api/device/registers: {str(e)}")
        return {"registers": [], "error": str(e)}

# =============================
# DATA COMPAT endpoints for monitor/trend modules
# =============================

def _find_device(project_id: str, device_id: str):
    cfg_path = _config_path(project_id)
    if not os.path.exists(cfg_path):
        return None, None
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for conv in data.get('converters', []):
            for dev in (conv.get('devices') or []):
                if str(dev.get('id')) == str(device_id):
                    return conv, dev
    except Exception:
        pass
    return None, None

@app.get('/data/convertors.json')
def compat_convertors_json():
    active = load_active().get('active')
    result = {}
    if not active:
        return result
    cfg_path = _config_path(active)
    if not os.path.exists(cfg_path):
        return result
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for conv in data.get('converters', []):
            cid = str(conv.get('id'))
            entry = {
                "name": conv.get('name') or conv.get('protocol') or cid,
                "devices": {}
            }
            for dev in (conv.get('devices') or []):
                entry["devices"][str(dev.get('id'))] = {
                    "name": dev.get('name') or str(dev.get('id')),
                    "template_ref": dev.get('template_ref')
                }
            result[cid] = entry
    except Exception:
        return result
    return result

@app.get('/api/history/keys')
def api_history_keys(device: str, project_id: Optional[str] = None):
    active = project_id or load_active().get('active')
    if not active:
        return {"keys": []}
    conv, dev = _find_device(active, device)
    if not dev:
        return {"keys": []}
    tpl = _load_device_template(dev.get('template_ref') or '')
    keys = [r.get('key') for r in (tpl.get('registers') or []) if r.get('key')]
    return {"keys": keys}

@app.get('/api/json_latest/{device_id}')
def api_json_latest(device_id: str, project_id: Optional[str] = None):
    pid = project_id or load_active().get('active')
    if not pid:
        return {"status": "error", "msg": "no active project"}
    rec = (READINGS.get(pid) or {}).get(str(device_id))
    if not rec:
        _ensure_poller(pid)
        rec = (READINGS.get(pid) or {}).get(str(device_id))
    if not rec:
        return {"status": "error", "msg": "no data"}
    return {"status": "ok", "latest": rec.get('values') or {}, "timestamp": rec.get('timestamp')}

@app.get('/api/history')
def api_history(device: str, key: str, start: Optional[str] = None, end: Optional[str] = None, project_id: Optional[str] = None):
    pid = project_id or load_active().get('active')
    if not pid:
        return {"history": []}
    try:
        start_ts = start or (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        start_ts = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    try:
        end_ts = end or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        end_ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    dbf = _project_db_file(pid)
    
    # Try to find device name from cache
    dname = None
    try:
        cache = READINGS.get(pid, {})
        if str(device) in cache:
            dname = cache[str(device)].get('device_name')
    except:
        pass
    
    # Fallback: Load from ConfigDevice.json if not in cache (e.g. restart)
    if not dname:
        try:
            cfg = _project_settings(pid)
            found = False
            for conv in cfg.get('converters', []):
                for d in conv.get('devices', []):
                    if str(d.get('id')) == str(device):
                        dname = d.get('name')
                        found = True
                        break
                if found: break
        except:
            pass
    
    print(f"[API] History Query: dev={device} name={dname} key={key}")
    hist = query_history(pid, str(device), str(key), start_ts, end_ts, dbf, _is_sqlite_enabled(pid), device_name=dname)
    return {"history": hist}
def _get_project_token(project_id: str):
    pj = os.path.join(_project_path(project_id), "Project.json")
    if not os.path.exists(pj):
        return None
    try:
        with open(pj, 'r', encoding='utf-8') as f:
            d = json.load(f)
        if 'ingest_token' not in d:
            d['ingest_token'] = secrets.token_hex(16)
            with open(pj, 'w', encoding='utf-8') as f:
                json.dump(d, f, indent=2, ensure_ascii=False)
        return d.get('ingest_token')
    except Exception:
        return None

def _project_settings(project_id: str):
    try:
        pj = os.path.join(_project_path(project_id), 'Project.json')
        if os.path.exists(pj):
            with open(pj, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _is_sqlite_enabled(project_id: str) -> bool:
    s = _project_settings(project_id)
    if 'disable_sqlite' in s:
        return not bool(s.get('disable_sqlite'))
    return True

@app.get('/api/projects/{project_id}/ingest_token')
def get_ingest_token(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    tok = _get_project_token(project_id)
    if not tok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project_id": project_id, "ingest_token": tok}

class IngestPayload(BaseModel):
    project_id: str
    token: str
    device_id: str
    device_name: str
    converter: str
    timestamp: Optional[str] = None
    values: dict

@app.post('/public/ingest_json')
def public_ingest(payload: IngestPayload):
    return _apply_ingest(payload.dict())

def _apply_ingest(p: dict):
    tok = _get_project_token(p.get('project_id'))
    if not tok or tok != p.get('token'):
        print(f"[INGEST] Unauthorized project={p.get('project_id')} device={p.get('device_id')}")
        raise HTTPException(status_code=401, detail="Unauthorized")
    now_ts = p.get('timestamp') or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    READINGS.setdefault(p.get('project_id'), {})[str(p.get('device_id'))] = {
        "device_name": p.get('device_name'),
        "converter": p.get('converter'),
        "timestamp": now_ts,
        "values": p.get('values') or {},
        "meta": {},
        "online": True,
        "last_error": None
    }
    print(f"[INGEST] ok project={p.get('project_id')} device={p.get('device_id')} keys={len((p.get('values') or {}).keys())}")
    return {"ok": True}

class CommandPush(BaseModel):
    project_id: str
    token: str
    device_id: str
    commands: list

@app.post('/public/commands/push')
def public_commands_push(payload: CommandPush):
    tok = _get_project_token(payload.project_id)
    if not tok or tok != payload.token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    lst = COMMANDS.setdefault(payload.project_id, {}).setdefault(str(payload.device_id), [])
    for c in payload.commands:
        cid = secrets.token_hex(8)
        lst.append({"id": cid, "cmd": c})
    return {"ok": True, "queued": len(payload.commands)}

@app.get('/public/commands/pull')
def public_commands_pull(project_id: str, device_id: str, token: str):
    tok = _get_project_token(project_id)
    if not tok or tok != token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"commands": COMMANDS.get(project_id, {}).get(str(device_id), [])}

class CommandAck(BaseModel):
    project_id: str
    token: str
    device_id: str
    ids: list

@app.post('/public/commands/ack')
def public_commands_ack(payload: CommandAck):
    tok = _get_project_token(payload.project_id)
    if not tok or tok != payload.token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    lst = COMMANDS.setdefault(payload.project_id, {}).setdefault(str(payload.device_id), [])
    rm = set(payload.ids or [])
    COMMANDS[payload.project_id][str(payload.device_id)] = [x for x in lst if x.get('id') not in rm]
    return {"ok": True}
# =====================================================
# 🔧 NEW: DEBUG / DIAGNOSTIC (Added from alert_engine)
# =====================================================

@app.get('/api/debug/polling')
def debug_polling_status():
    """Check polling thread status"""
    status = {}
    for key, thread in POLL_THREADS.items():
        status[key] = {
            "alive": thread.is_alive() if thread else False,
            "stop_flag": STOP_FLAGS.get(key, False)
        }
    
    active = load_active().get('active')
    
    return {
        "active_project": active,
        "poll_threads": status,
        "readings": {pid: list(devs.keys()) for pid, devs in READINGS.items()},
        "purged_data": list(PURGED_DATA)
    }

@app.get('/api/debug/alert-system')
def debug_alert_system():
    """Complete alert system diagnostic"""
    from services.backend.api.alert_module.alert_engine import diagnose_alert_system
    
    active = load_active().get('active')
    if active:
        diagnose_alert_system(active)
    
    return {"message": "Check server logs for diagnostic output"}

@app.post('/api/debug/force-poll/{device_id}')
def force_poll_device(device_id: str, project_id: Optional[str] = None):
    """Force manual poll of a specific device"""
    pid = project_id or load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    
    # Find device in config
    cfg_path = _config_path(pid)
    if not os.path.exists(cfg_path):
        raise HTTPException(status_code=404, detail="Project config not found")
    
    with open(cfg_path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    
    found_conv = None
    found_dev = None
    
    for conv in cfg.get('converters', []):
        for dev in (conv.get('devices') or []):
            if str(dev.get('id')) == str(device_id):
                found_conv = conv
                found_dev = dev
                break
        if found_dev:
            break
    
    if not found_dev:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    # Manually poll once
    try:
        ip = found_dev.get('modbus_ip') or (found_conv.get('settings') or {}).get('host') or found_conv.get('address')
        port = int(found_dev.get('modbus_port') or (found_conv.get('settings') or {}).get('port') or found_conv.get('port') or 502)
        unit_id = int(found_dev.get('modbus_slave') or found_dev.get('address') or 1)
        
        if not ip:
            raise HTTPException(status_code=400, detail="Device has no IP address configured")
        
        # Load template
        tpl = _load_device_template(found_dev.get('template_ref') or '')
        regs = tpl.get('registers', [])
        
        if not regs:
            raise HTTPException(status_code=400, detail="Device has no registers defined")
        
        # Try reading first register
        first_reg = regs[0]
        addr = int(first_reg.get('address') or 0)
        func = int(first_reg.get('function') or 3)
        words = int(first_reg.get('words') or 2)
        
        result = _read_modbus_tcp_raw(ip, port, unit_id, func, addr, words, timeout=5)
        
        if result is None:
            # Try function 4
            result = _read_modbus_tcp_raw(ip, port, unit_id, 4, addr, words, timeout=5)
        
        if result is None:
            raise HTTPException(status_code=504, detail=f"No response from {ip}:{port}")
        
        return {
            "device_id": device_id,
            "device_name": found_dev.get('name'),
            "ip": ip,
            "port": port,
            "unit_id": unit_id,
            "test_read": {
                "address": addr,
                "function": func,
                "registers": result
            },
            "message": "✅ Device is responding! Polling should work."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Polling error: {str(e)}")

@app.post('/api/debug/restart-polling')
def restart_polling(project_id: Optional[str] = None):
    """Restart all polling threads for a project"""
    pid = project_id or load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    
    # Stop all threads for this project
    stopped = []
    for key in list(POLL_THREADS.keys()):
        if key.startswith(f"{pid}:"):
            STOP_FLAGS[key] = True
            stopped.append(key)
            # Remove from dict
            POLL_THREADS.pop(key, None)
    
    # Wait a moment
    import time
    time.sleep(2)
    
    # Restart polling
    _ensure_poller(pid)
    
    # Check what started
    started = []
    for key in POLL_THREADS.keys():
        if key.startswith(f"{pid}:"):
            started.append(key)
    
    return {
        "stopped": stopped,
        "started": started,
        "message": f"Restarted {len(started)} polling threads"
    }


def _billing_bg_loop():
    """Background loop to sync billing every minute"""
    from services.backend.api.billing.billing_service import sync_billing_for_project
    import time
    from services.backend.shared_state import READINGS
    while True:
        try:
            active = load_active().get('active')
            if active:
                # Pass the live reading dict for this project
                project_readings = READINGS.get(active, {})
                sync_billing_for_project(active, project_readings)
        except Exception as e:
            print(f"[Billing] Sync error: {e}")
        time.sleep(60)

@app.on_event('startup')
def _startup_jobs():
    _start_snapshot_thread()
    _start_mqtt()
    # Start background billing sync
    threading.Thread(target=_billing_bg_loop, daemon=True, name="BillingBg").start()
    try:
        active = load_active().get('active')
        if active:
            _ensure_poller(active)
    except Exception:
        pass

def _db_stats(project_id: str):
    try:
        if not _is_sqlite_enabled(project_id):
            return {"exists": False, "rows": 0, "disabled": True}
        dbf = _project_db_file(project_id)
        if not os.path.exists(dbf):
            return {"exists": False, "rows": 0}
        conn = sqlite3.connect(dbf)
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM readings WHERE project_id=?', (project_id,))
        rows = cur.fetchone()[0] or 0
        cur.execute('SELECT MIN(timestamp), MAX(timestamp) FROM readings WHERE project_id=?', (project_id,))
        mn, mx = cur.fetchone()
        conn.close()
        return {"exists": True, "rows": int(rows), "min_ts": mn, "max_ts": mx}
    except Exception:
        return {"exists": os.path.exists(_project_db_file(project_id)), "rows": 0}

@app.post('/public/snapshot')
def public_snapshot(project_id: Optional[str] = None, token: Optional[str] = None):
    # optional protection using ingest_token when project_id provided
    if project_id:
        tok = _get_project_token(project_id)
        if not tok or tok != token:
            raise HTTPException(status_code=401, detail="Unauthorized")
    _snapshot_to_db()
    if project_id:
        return {"ok": True, "stats": _db_stats(project_id)}
    # if not specified, return stats for active
    active = load_active().get('active')
    return {"ok": True, "stats": _db_stats(active) if active else {"exists": False, "rows": 0}}

@app.get('/public/snapshot')
def public_snapshot_get(project_id: Optional[str] = None, token: Optional[str] = None):
    return public_snapshot(project_id=project_id, token=token)

@app.get('/public/db/status')
def public_db_status(project_id: str):
    return _db_stats(project_id)

def _start_mqtt():
    if mqtt is None:
        return
    broker = os.getenv('MQTT_BROKER')
    if not broker:
        return
    port = int(os.getenv('MQTT_PORT') or 1883)
    topic = os.getenv('MQTT_TOPIC') or 'energylink/ingest'
    client = mqtt.Client()
    def _on_message(_c,_u,msg):
        try:
            d = json.loads(msg.payload.decode('utf-8'))
            _apply_ingest(d)
        except Exception:
            pass
    client.on_message = _on_message
    try:
        client.connect(broker, port, 60)
        client.subscribe(topic)
        client.loop_start()
    except Exception:
        pass

@app.post("/public/ingest")
def ingest_readings(req: dict):
    print("[INGEST] received at", datetime.now().isoformat())
    print("[INGEST] body:", req)
    """
    รับข้อมูลจาก agent/modbus_push.py และบันทึกลง CSV
    Auto summary ทุกเดือน และ auto rotate ทุกปี
    """
    project_id = req.get('project_id') or req.get('project')
    device_id = req.get('device_id')
    device_name = req.get('device_name', device_id)
    timestamp = req.get('timestamp', datetime.now().isoformat())
    values = req.get('values', {})
    
    # บันทึก readings
    readings_list = []
    for key, val in values.items():
        if isinstance(val, dict):
            v = val.get('value')
            u = val.get('unit', '')
        else:
            v = val
            u = ''
        readings_list.append({'device_id': device_id, 'device_name': device_name, 'key': key, 'value': v, 'unit': u})
    
    try:
        save_readings_batch(project_id, readings_list)
        save_device_status(project_id, device_id, device_name, 'online', timestamp)
        now = datetime.now()
        generate_monthly_summary(project_id, now.strftime('%Y'), now.strftime('%m'))
        auto_rotate_year(project_id)
        try:
            _apply_ingest({
                'project_id': project_id,
                'token': req.get('token'),
                'device_id': device_id,
                'device_name': device_name,
                'converter': req.get('converter'),
                'timestamp': timestamp,
                'values': {k: (v.get('value') if isinstance(v, dict) else v) for k, v in values.items()}
            })
        except Exception:
            pass
    except Exception as e:
        import traceback; traceback.print_exc()
        return {"status":"error","message":str(e)}
    print("[INGEST] completed")
    return {"status":"ok","saved":len(readings_list)}

def _user_allowed_project(username: str, project_id: str) -> bool:
    if is_admin(username):
        return True
    u = get_user_obj(username)
    allowed = set(u.get("allowed_projects", []) if u else [])
    return (not allowed) or (project_id in allowed)

@app.post('/api/ingest')
def api_ingest(req: dict, username: str = Depends(get_current_user)):
    pid = req.get('project_id') or req.get('project')
    if not pid or not _user_allowed_project(username, pid):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        device_id = req.get('device_id')
        device_name = req.get('device_name') or device_id
        timestamp = req.get('timestamp') or datetime.now().isoformat()
        values = req.get('values') or {}
        readings_list = []
        for key, val in values.items():
            if isinstance(val, dict):
                v = val.get('value'); u = val.get('unit','')
            else:
                v = val; u = ''
            readings_list.append({'device_id': device_id, 'device_name': device_name, 'key': key, 'value': v, 'unit': u})
        save_readings_batch(pid, readings_list)
        save_device_status(pid, device_id, device_name, 'online', timestamp)
        READINGS.setdefault(pid, {})[str(device_id)] = {
            'device_name': device_name,
            'converter': req.get('converter'),
            'timestamp': timestamp,
            'values': {k: (v.get('value') if isinstance(v, dict) else v) for k, v in values.items()},
            'meta': {},
            'online': True,
            'last_error': None
        }
        return {"status":"ok","saved":len(readings_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _project_users_file(project_id: str):
    return os.path.join(_project_path(project_id), 'users.json')

def _load_project_users(project_id: str):
    fp = _project_users_file(project_id)
    if not os.path.exists(fp):
        return {}
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_project_users(project_id: str, data: dict):
    fp = _project_users_file(project_id)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _get_project_user(project_id: str, username: str):
    d = _load_project_users(project_id)
    if isinstance(d, dict):
        return d.get(username)
    if isinstance(d, list):
        for u in d:
            if str(u.get('username')) == str(username):
                return u
    return None

class ProjectUserPayload(BaseModel):
    username: str
    password: Optional[str] = None
    role: Optional[str] = 'user'

@app.post('/api/projects/{project_id}/users/upsert')
def upsert_project_user(project_id: str, payload: ProjectUserPayload, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    users = _load_project_users(project_id)
    if not isinstance(users, dict):
        users = {}
    entry = users.get(payload.username) or {"username": payload.username}
    if payload.password:
        salt = secrets.token_hex(8)
        entry['salt'] = salt
        entry['password_hash'] = _hash_password(payload.password, salt)
        entry.pop('password', None)
    entry['role'] = payload.role or 'user'
    users[payload.username] = entry
    _save_project_users(project_id, users)
    return {"ok": True}

@app.get('/api/projects/{project_id}/users')
def list_project_users(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"users": list((_load_project_users(project_id) or {}).keys())}

@app.post('/api/login_user')
def api_login_user(payload: LoginPayload, response: Response):
    if not payload.project_id:
        raise HTTPException(status_code=400, detail='project_id required')
    u = _get_project_user(payload.project_id, payload.username)
    if not _verify_password(u, payload.password):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    sid = uuid.uuid4().hex
    sessions = load_sessions()
    sessions[sid] = payload.username
    save_sessions(sessions)
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    return {"username": payload.username, "role": (u or {}).get('role', 'user'), "allowed_projects": [payload.project_id]}

class UserAnyPayload(BaseModel):
    username: str
    password: str

@app.post('/api/login_user_any')
def api_login_user_any(payload: UserAnyPayload, response: Response):
    # Search across all projects for this user
    target_pid = None
    user_obj = None
    try:
        for name in os.listdir(PROJECTS_ROOT):
            full = os.path.join(PROJECTS_ROOT, name)
            if not os.path.isdir(full):
                continue
            u = _get_project_user(name, payload.username)
            if _verify_password(u, payload.password):
                target_pid = name
                user_obj = u
                break
    except Exception:
        pass
    if not target_pid:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    sid = uuid.uuid4().hex
    sessions = load_sessions()
    sessions[sid] = payload.username
    save_sessions(sessions)
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    return {"username": payload.username, "role": (user_obj or {}).get('role', 'user'), "project_id": target_pid, "redirect": f"/frontend/user.html?pid={target_pid}"}

@app.get('/api/projects/{project_id}/login_qr')
def project_login_qr(project_id: str):
    url = f"/frontend/login.html?pid={project_id}"
    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return {"qr": f"data:image/png;base64,{b64}", "url": url}
