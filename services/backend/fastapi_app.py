from fastapi import FastAPI, HTTPException, Response, Depends, Cookie, Request
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid, os, json, secrets, time
from typing import Optional, Dict, List, Any
import qrcode
import base64
from io import BytesIO
import traceback
import threading, socket, struct, ctypes, sqlite3
import hmac
from datetime import datetime, timedelta
from .api.trend_api import get_device_registers
from .api.history_api import query_history
# from .api.xlsx_storage import save_readings_batch, save_device_status, generate_monthly_summary, auto_rotate_year # REMOVED
from services.backend.api.alert_module.alert_engine import check_alerts
from services.backend.api.alert_module.alert_routes import router as alert_router
from services.backend.api.photoview.photoview_router import router as photoview_router
from services.backend.api.report_builder.report_router import router as report_router
from services.backend.api.billing.billing_router import router as billing_router
from services.backend.api.support.support_router import router as support_router
from services.backend.api.store.store_router import router as store_router
from services.backend.api.service.service_router import router as service_router
from services.backend.api.notification.notification_router import router as notification_router
from services.backend.api.persistence import engine as persistence_engine
from services.backend.read_modbus.modbus_poller_final import start as start_poller
from services.backend.api.system_events import log_system_event
from services.backend import shared_state

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
import sys
import os

# Determine ROOT
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    ROOT = os.path.dirname(sys.executable)
    print(f"[BACKEND] Frozen execution detected. ROOT={ROOT}")
else:
    # Running as script
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    print(f"[BACKEND] Script execution detected. ROOT={ROOT}")

# Debug path info
print(f"[BACKEND] CWD={os.getcwd()}")
print(f"[BACKEND] sys.executable={sys.executable}")

# Define directories
PROJECTS_ROOT = os.path.join(ROOT, 'projects')

# CHECK FOR PRODUCTION BUILD (dist)
DIST_DIR = os.path.join(ROOT, 'dist')
FRONTEND_SRC_DIR = os.path.join(ROOT, 'frontend')
FRONTEND_DIST_DIR = os.path.join(FRONTEND_SRC_DIR, 'dist')

# Check for Bundled Frontend (PyInstaller)
BUNDLED_FRONTEND = None
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    BUNDLED_FRONTEND = os.path.join(sys._MEIPASS, 'frontend', 'dist')

if BUNDLED_FRONTEND and os.path.isdir(BUNDLED_FRONTEND):
    print(f"[BACKEND] Found bundled frontend at {BUNDLED_FRONTEND}")
    FRONTEND_DIR = BUNDLED_FRONTEND
    IS_PRODUCTION = True
elif os.path.isdir(FRONTEND_DIST_DIR):
    print(f"[BACKEND] Found frontend dist at {FRONTEND_DIST_DIR}")
    FRONTEND_DIR = FRONTEND_DIST_DIR
    IS_PRODUCTION = True
elif os.path.isdir(DIST_DIR):
    print(f"[BACKEND] Found production build at {DIST_DIR}")
    FRONTEND_DIR = DIST_DIR
    IS_PRODUCTION = True
elif os.path.isdir(FRONTEND_SRC_DIR):
    print(f"[BACKEND] Found source frontend at {FRONTEND_SRC_DIR}")
    FRONTEND_DIR = FRONTEND_SRC_DIR
    IS_PRODUCTION = False
else:
    # Fallback search as before
    FRONTEND_DIR = FRONTEND_SRC_DIR # Default fallback
    # ... (existing complex fallback logic omitted for brevity as dist/frontend are primary)
    print(f"[BACKEND] WARNING: Frontend directory not found via standard paths.")
    IS_PRODUCTION = False


os.makedirs(PROJECTS_ROOT, exist_ok=True)

app = FastAPI()

# Get local IP address for dynamic CORS configuration
import socket
try:
    local_ip = socket.gethostbyname(socket.gethostname())
except:
    local_ip = "127.0.0.1"

allowed_origins = [
    # Development origins
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8000",  # Frontend served on port 8000
    "http://127.0.0.1:8000",
    # Network origins
    f"http://{local_ip}:5000",  # Backend on this machine
    f"http://{local_ip}:8000",  # Frontend on this machine
    "http://192.168.1.52:5000",  # Specific network IP
    "http://192.168.1.52:8000",
    "http://192.168.1.52:5173",
    "http://192.168.1.52:5174",
    # Mobile
    "capacitor://localhost"
]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
from fastapi.responses import JSONResponse
from fastapi import HTTPException as _HTTPException
@app.exception_handler(_HTTPException)
async def _http_exc_handler(request, exc: _HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"status": "error", "message": str(exc.detail)})
@app.exception_handler(Exception)
async def _generic_exc_handler(request, exc: Exception):
    try:
        import traceback
        traceback.print_exc()
    except:
        pass
    return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

def _sync_device_images():
    try:
        import shutil
        exts = {"png","jpg","jpeg","webp","svg"}
        dest = RESOURCES_DIR
        os.makedirs(os.path.join(dest, "devices"), exist_ok=True)
        for m in os.listdir(DEVICE_TEMPLATES_DIR):
            src = os.path.join(DEVICE_TEMPLATES_DIR, m, "pic")
            if not os.path.isdir(src):
                continue
            for name in os.listdir(src):
                p = os.path.join(src, name)
                if not os.path.isfile(p):
                    continue
                ext = name.split(".")[-1].lower()
                if ext not in exts:
                    continue
                d1 = os.path.join(dest, name)
                d2 = os.path.join(dest, "devices", m, name)
                os.makedirs(os.path.dirname(d2), exist_ok=True)
                if not os.path.exists(d1):
                    try:
                        shutil.copy2(p, d1)
                    except Exception:
                        pass
                if not os.path.exists(d2):
                    try:
                        shutil.copy2(p, d2)
                    except Exception:
                        pass
    except Exception:
        pass

from services.backend.api.project_init import init_project_db

@app.on_event("startup")
def startup_event():
    print("[BACKEND] Starting Modbus Poller...")
    try:
        _sync_device_images()
    except Exception:
        pass
    try:
        from services.backend.api.alert_module.offline_monitor_task import start_monitor
        start_monitor()
    except Exception as e:
        print(f"[Startup] Failed to start offline monitor: {e}")
    threading.Thread(target=start_poller, args=(5,), daemon=True).start()
    
    # Log System Startup & Init DB
    try:
        active_info = shared_state.load_active()
        pid = active_info.get('active')
        if pid:
            init_project_db(pid) # Ensure tables exist
            try:
                from services.backend.api.control.service import control_service
                control_service._ensure_audit_table(pid)
            except Exception:
                pass
            log_system_event(pid, "SERVER_STARTUP", "Backend server started")
    except Exception as e:
        print(f"[Startup] Error initializing project: {e}")

@app.on_event("shutdown")
def shutdown_event():
    print("🛑 Shutting down...")
    try:
        active_info = shared_state.load_active()
        pid = active_info.get('active')
        if pid:
            log_system_event(pid, "SERVER_SHUTDOWN", "Backend server stopping")
    except:
        pass

# Include Alert Router
app.include_router(alert_router, prefix="/api/alert", tags=["Alerts"])
app.include_router(photoview_router, prefix="/api/photoview", tags=["Photoview"])
app.include_router(report_router, prefix="/api/report", tags=["Reports"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
app.include_router(support_router, prefix="/api/support", tags=["Support"])
app.include_router(store_router, prefix="/api/store", tags=["Store"])
app.include_router(service_router, prefix="/api/service", tags=["Service"])
app.include_router(notification_router, prefix="/api/notification", tags=["Notification"])

from services.backend.api.report_builder.template_router import router as template_router
app.include_router(template_router, prefix="/api/report_template", tags=["Templates"])

from services.backend.api.control.router import router as control_router
app.include_router(control_router, prefix="/api/control", tags=["Control"])

from services.backend.api.import_tool import router as import_router
app.include_router(import_router, prefix="/api", tags=["Import"])

from services.backend.integrations.line_bot.line_routes import router as line_router
app.include_router(line_router, prefix="/api", tags=["LINE Bot"])

# AI Router Integration
from services.backend.api.ai.ai_router import router as ai_router
app.include_router(ai_router, prefix="/api", tags=["AI"])

# Enable AI Learning
try:
    from services.backend.api.ai.ollama_service import ollama_service
    ollama_service.enable_learning(PROJECTS_ROOT)
    print("[AI] Learning engine enabled")
except Exception as e:
    print(f"[AI] Failed to enable learning: {e}")

# Frontend serving moved to end of file to prevent API route blocking

# =============================
# SESSION & USER FILES
# =============================
SESSIONS_FILE = os.path.join(ROOT, 'sessions.json')
USERS_FILE = os.path.join(ROOT, 'users.json')
CONTROL_FILE = os.path.join(ROOT, 'manager', 'control.json')

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
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data: return data
        
        # Fallback to backend dir
        fallback = os.path.join(ROOT, 'services', 'backend', 'users.json')
        if os.path.exists(fallback):
            with open(fallback, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except Exception:
        return {}

def save_users(users):
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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

from fastapi import Header as APIHeader

def get_current_user(
    session_id: Optional[str] = Cookie(None),
    user_session_id: Optional[str] = Cookie(None),
    admin_session_id: Optional[str] = Cookie(None),
    authorization: Optional[str] = APIHeader(None)
):
    sessions = load_sessions()
    sid = None

    # Priority 1: Authorization Header (Bearer Token)
    if authorization and authorization.lower().startswith("bearer "):
        sid = authorization.split(" ")[1]
    
    # Priority 2: Cookies (Fallback)
    elif user_session_id:
        sid = user_session_id
    elif session_id:
        sid = session_id
    elif admin_session_id:
        sid = admin_session_id

    if not sid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    username = sessions.get(sid)
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

def _is_valid_ip(ip: Optional[str]) -> bool:
    try:
        s = str(ip or '').strip()
        if not s:
            return False
        if s in {"1.2.3.5", "0.0.0.0"}:
            return False
        parts = s.split('.')
        if len(parts) != 4:
            return False
        for p in parts:
            if not p.isdigit():
                return False
            n = int(p)
            if n < 0 or n > 255:
                return False
        return True
    except Exception:
        return False

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
        try:
            return hmac.compare_digest(_hash_password(password, salt), pw_hash)
        except Exception:
            return False
    # Fallback for plain text or simple hash
    stored = str(user.get('password') or '')
    if not stored:
        return False
    return hmac.compare_digest(stored, password)

@app.post('/api/login')
def api_login(payload: LoginPayload, response: Response):
    # If project_id provided, try that project user FIRST (prevents global user shadowing project user)
    if payload.project_id:
        u = _get_project_user(payload.project_id, payload.username)
        if u and _verify_password(u, payload.password):
            sid = uuid.uuid4().hex
            sessions = load_sessions()
            sessions[sid] = payload.username
            save_sessions(sessions)
            response.set_cookie('user_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
            response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
            # Persist active project so UI won't remain stuck on a different project
            # try:
            #     save_active(payload.project_id)
            # except Exception:
            #     pass
            return {
                "username": payload.username,
                "role": (u or {}).get('role', 'user'),
                "selected_project": payload.project_id,
                "session_id": sid
            }

    # Next, try Global User
    u = get_user_obj(payload.username)
    if u and _verify_password(u, payload.password):
        sid = uuid.uuid4().hex
        sessions = load_sessions()
        sessions[sid] = payload.username
        save_sessions(sessions)

        # Clear conflicting cookies to ensure correct role is used
        response.delete_cookie('user_session_id')
        response.delete_cookie('session_id')
        
        response.set_cookie('admin_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
        
        # Return session_id in body for token-based auth
        selected = None
        try:
            ap = (u or {}).get('allowed_projects', [])
            if isinstance(ap, list) and len(ap) > 0:
                selected = ap[0]
        except Exception:
            selected = None
        resp = {
            "username": payload.username,
            "role": (u or {}).get('role', 'user'),
            "session_id": sid
        }
        if selected:
            resp['selected_project'] = selected
        return resp

    # If project_id was not provided, search across projects (legacy behavior)
    if not payload.project_id:
        target_pid = None
        user_obj = None
        try:
            for name in os.listdir(PROJECTS_ROOT):
                full = os.path.join(PROJECTS_ROOT, name)
                if not os.path.isdir(full):
                    continue
                u = _get_project_user(name, payload.username)
                if u and _verify_password(u, payload.password):
                    target_pid = name
                    user_obj = u
                    break
        except Exception:
            pass

        if target_pid:
            sid = uuid.uuid4().hex
            sessions = load_sessions()
            sessions[sid] = payload.username
            save_sessions(sessions)
            response.set_cookie('user_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
            response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
            # Persist active project so UI won't remain stuck on a different project
            # try:
            #     save_active(target_pid)
            # except Exception:
            #     pass
            return {
                "username": payload.username, 
                "role": (user_obj or {}).get('role', 'user'), 
                "selected_project": target_pid,
                "session_id": sid
            }

    raise HTTPException(status_code=401, detail='Invalid credentials')

@app.post('/api/logout')
def api_logout(
    session_id: Optional[str] = Cookie(None),
    user_session_id: Optional[str] = Cookie(None),
    authorization: Optional[str] = APIHeader(None),
    response: Response = None
):
    sessions = load_sessions()
    
    # Check header first
    target = None
    if authorization and authorization.lower().startswith("bearer "):
        target = authorization.split(" ")[1]
    
    if not target:
        target = user_session_id or session_id

    if target and target in sessions:
        try:
            sessions.pop(target, None)
            save_sessions(sessions)
        except Exception:
            pass
    if response is not None:
        if user_session_id:
            response.delete_cookie('user_session_id')
        if session_id:
            response.delete_cookie('session_id')
    return {"ok": True}
 
@app.post('/api/logout_admin')
def api_logout_admin(admin_session_id: Optional[str] = Cookie(None), response: Response = None):
    sessions = load_sessions()
    if admin_session_id and admin_session_id in sessions:
        try:
            sessions.pop(admin_session_id, None)
            save_sessions(sessions)
        except Exception:
            pass
    if response is not None:
        response.delete_cookie('admin_session_id')
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
QR_TTL = 180  # 3 minutes

def _cleanup_qr():
    with QR_LOCK:
        now = time.time()
        expired = [k for k, v in QR_TOKENS.items() if v['expires'] < now]
        for k in expired:
            del QR_TOKENS[k]

@app.post("/api/qr_login/start")
def qr_login_start(payload: QrStartPayload):
    _cleanup_qr()
    token = secrets.token_urlsafe(16)
    with QR_LOCK:
        QR_TOKENS[token] = {
            'created': time.time(),
            'expires': time.time() + QR_TTL,
            'status': 'pending',
            'redirect': payload.redirect,
            'project_id': payload.project_id
        }
    return {"token": token}

@app.get("/api/qr_login/status/{token}")
def qr_login_status(token: str):
    _cleanup_qr()
    with QR_LOCK:
        if token not in QR_TOKENS:
            return {"status": "invalid"}
        return {"status": QR_TOKENS[token]['status']}

@app.post("/api/qr_login/confirm")
def qr_login_confirm(payload: QrConfirmPayload):
    _cleanup_qr()
    with QR_LOCK:
        if payload.token not in QR_TOKENS:
            raise HTTPException(status_code=400, detail="Invalid token")
        
        # Verify user credentials
        user = get_user_obj(payload.username)
        if not user or not _verify_password(user, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Update token with user info
        QR_TOKENS[payload.token]['status'] = 'confirmed'
        QR_TOKENS[payload.token]['username'] = payload.username
        QR_TOKENS[payload.token]['user'] = user
        return {"status": "ok"}

@app.get("/api/qr_login/finalize/{token}")
def qr_login_finalize(token: str, response: Response):
    _cleanup_qr()
    with QR_LOCK:
        if token not in QR_TOKENS or QR_TOKENS[token]['status'] != 'confirmed':
            raise HTTPException(status_code=400, detail="Invalid or unconfirmed token")
        
        # Create session
        session_id = str(uuid.uuid4())
        sessions = load_sessions()
        sessions[session_id] = QR_TOKENS[token]['username']
        save_sessions(sessions)
        
        # Set session cookie
        response.set_cookie(key="user_session_id", value=session_id, httponly=True, max_age=86400, samesite='lax')
        response.set_cookie(key="session_id", value=session_id, httponly=True, max_age=86400, samesite='lax')
        
        # Cleanup and redirect
        redirect = QR_TOKENS[token].get('redirect', '/')
        del QR_TOKENS[token]
        return RedirectResponse(url=redirect)

# =============================
# AUDIT LOG API
# =============================
class AuditLogRequest(BaseModel):
    project_id: str
    username: Optional[str] = None
    action: str
    event_type: str
    details: str

@app.post("/api/audit/log")
async def create_audit_log(request: AuditLogRequest):
    try:
        log_system_event(
            request.project_id,
            request.event_type,
            f"[{request.action}] {request.details} (User: {request.username})"
        )
        return {"status": "success"}
    except Exception as e:
        print(f"[AUDIT ERROR] {e}")
        return {"status": "error", "message": str(e)}

# Convenience endpoint for user login bound to a project.
@app.get("/api/qr_login/start_user/{project_id}")
def qr_login_start_user(project_id: str):
    return qr_login_start(QrStartPayload(project_id=project_id))
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
    READINGS, READINGS_LOCK, POLL_THREADS, STOP_FLAGS, COMMANDS, LAST_SEEN
)

# =============================
# POWER STUDIO INTEGRATION
# =============================
from services.backend.api.powerstudio_router import router as powerstudio_router
app.include_router(powerstudio_router, prefix="/api/powerstudio", tags=["PowerStudio"])

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
    selected = None
    if u:
        ap = u.get('allowed_projects', [])
        if isinstance(ap, list) and len(ap) > 0:
            selected = ap[0]
    resp = {"username": username, "role": u.get("role", "user") if u else "user"}
    if selected:
        resp['selected_project'] = selected
    return resp

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notify: Optional[dict] = None
    line_info: Optional[dict] = None
    project_id: Optional[str] = None
    avatar: Optional[str] = None

class ChangePasswordPayload(BaseModel):
    old_password: str
    new_password: str
    project_id: Optional[str] = None

@app.get('/api/user/profile')
def user_profile(project_id: Optional[str] = None, username: str = Depends(get_current_user)):
    # 1. Try to load from specific project if provided
    if project_id:
        p_user = _get_project_user(project_id, username)
        if p_user:
            return {
                "username": username,
                "role": p_user.get("role", "user"),
                "display_name": p_user.get("display_name"),
                "phone": p_user.get("phone"),
                "email": p_user.get("email"),
                "notify": p_user.get("notify") or {},
                "avatar": p_user.get("avatar"),
                "project_id": project_id,
                "selected_project": project_id
            }

    # 2. Fallback to Global User logic
    u = get_user_obj(username) or {}
    
    # Logic to determine project_id (Auto-discovery)
    found_project_id = u.get('project_id')
    
    if not found_project_id:
        allowed = u.get("allowed_projects", [])
        if allowed and len(allowed) == 1:
            found_project_id = allowed[0]
        elif allowed and len(allowed) > 0:
             # Pick first allowed
             found_project_id = allowed[0]
        else:
            # No explicit allowed list, check filesystem
            all_projects = [d for d in os.listdir(PROJECTS_ROOT) if os.path.isdir(os.path.join(PROJECTS_ROOT, d))]
            if len(all_projects) == 1:
                found_project_id = all_projects[0]
            elif len(all_projects) > 0:
                # Multiple projects, find where user is explicitly listed
                explicit_matches = []
                for pid in all_projects:
                    try:
                        p_users = _load_project_users(pid)
                        if isinstance(p_users, dict) and username in p_users:
                            explicit_matches.append(pid)
                        elif isinstance(p_users, list):
                            for pu in p_users:
                                if str(pu.get('username')) == str(username):
                                    explicit_matches.append(pid)
                                    break
                    except:
                        pass
                
                if explicit_matches:
                    found_project_id = explicit_matches[0]
                elif u.get("role") == "admin":
                    active = load_active().get("active")
                    if active:
                        found_project_id = active
                    else:
                        found_project_id = all_projects[0]
                else:
                    # Fallback: just pick the first one
                    found_project_id = all_projects[0]

    return {
        "username": username,
        "role": u.get("role", "user"),
        "display_name": u.get("display_name"),
        "phone": u.get("phone"),
        "email": u.get("email"),
        "notify": u.get("notify") or {},
        "avatar": u.get("avatar"),
        "project_id": found_project_id,
        "selected_project": found_project_id
    }

@app.post('/api/user/profile')
def user_profile_update(payload: ProfileUpdate, username: str = Depends(get_current_user)):
    # 1. Update Project-Specific User if project_id provided
    if payload.project_id:
        users = _load_project_users(payload.project_id)
        # Handle List vs Dict structure
        if isinstance(users, list):
            found = None
            for u in users:
                if str(u.get('username')) == str(username):
                    found = u
                    break
            if not found:
                found = {"username": username}
                users.append(found)
            
            if payload.display_name is not None: found['display_name'] = payload.display_name
            if payload.phone is not None: found['phone'] = payload.phone
            if payload.email is not None: found['email'] = payload.email
            if payload.notify is not None: found['notify'] = payload.notify
            if payload.line_info is not None: found['line_info'] = payload.line_info
            if payload.avatar is not None: found['avatar'] = payload.avatar
            _save_project_users(payload.project_id, users)
            return {"ok": True}
        else:
            if not isinstance(users, dict): users = {}
            entry = users.get(username) or {"username": username}
            
            if payload.display_name is not None: entry['display_name'] = payload.display_name
            if payload.phone is not None: entry['phone'] = payload.phone
            if payload.email is not None: entry['email'] = payload.email
            if payload.notify is not None: entry['notify'] = payload.notify
            if payload.line_info is not None: entry['line_info'] = payload.line_info
            if payload.avatar is not None: entry['avatar'] = payload.avatar
            users[username] = entry
            _save_project_users(payload.project_id, users)
            return {"ok": True}

    # 2. Fallback to Global User Update
    users = load_users()
    if isinstance(users, list):
        found = None
        for u in users:
            if str(u.get('username')) == str(username):
                found = u
                break
        if not found:
            found = {"username": username}
            users.append(found)
        if payload.display_name is not None: found['display_name'] = payload.display_name
        if payload.phone is not None: found['phone'] = payload.phone
        if payload.email is not None: found['email'] = payload.email
        if payload.notify is not None: found['notify'] = payload.notify
        if payload.line_info is not None: found['line_info'] = payload.line_info
    else:
        entry = users.get(username) or {"username": username}
        if payload.display_name is not None: entry['display_name'] = payload.display_name
        if payload.phone is not None: entry['phone'] = payload.phone
        if payload.email is not None: entry['email'] = payload.email
        if payload.notify is not None: entry['notify'] = payload.notify
        if payload.line_info is not None: entry['line_info'] = payload.line_info
        users[username] = entry
    save_users(users)
    return {"ok": True}

@app.post('/api/user/change_password')
def user_change_password(payload: ChangePasswordPayload, username: str = Depends(get_current_user)):
    # 1. Project-Specific Password Change
    if payload.project_id:
        users = _load_project_users(payload.project_id)
        current = None
        is_list = isinstance(users, list)
        
        if is_list:
            for u in users:
                if str(u.get('username')) == str(username):
                    current = u
                    break
        else:
            if not isinstance(users, dict): users = {}
            current = users.get(username)
            
        if not current:
            raise HTTPException(status_code=404, detail="User not found in project")
            
        if not _verify_password(current, payload.old_password):
             raise HTTPException(status_code=401, detail="Invalid password")
             
        # Set NEW password (Hash)
        salt = secrets.token_hex(8)
        current['salt'] = salt
        current['password_hash'] = _hash_password(payload.new_password, salt)
        current.pop('password', None)
        
        if is_list:
            for i, u in enumerate(users):
                if str(u.get('username')) == str(username):
                    users[i] = current
                    break
        else:
            users[username] = current
            
        _save_project_users(payload.project_id, users)
        return {"ok": True}

    # 2. Global Fallback
    users = load_users()
    current = None
    is_list = isinstance(users, list)
    if is_list:
        for u in users:
            if str(u.get('username')) == str(username):
                current = u
                break
    else:
        current = users.get(username)
    if not current:
        raise HTTPException(status_code=404, detail="User not found")
    if str(current.get('password', '')) != str(payload.old_password):
        raise HTTPException(status_code=401, detail="Invalid password")
    current['password'] = payload.new_password
    if is_list:
        for i, u in enumerate(users):
            if str(u.get('username')) == str(username):
                users[i] = current
                break
    else:
        users[username] = current
    save_users(users)
    return {"ok": True}
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

@app.get('/api/public/projects')
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

@app.get('/api/public/projects/{project_id}/devices')
def public_devices(project_id: str):
    cfg_path = _config_path(project_id)
    if not os.path.exists(cfg_path):
        return {"devices": []}
    with open(cfg_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result = []
    for c_idx, conv in enumerate(data.get('converters', [])):
        c_name = conv.get('name') or conv.get('protocol') or f"Converter {c_idx+1}"
        for dev in (conv.get('devices') or []):
            host = (conv.get('settings') or {}).get('host') or conv.get('address')
            ip_raw = dev.get('modbus_ip')
            ip = ip_raw if _is_valid_ip(ip_raw) else (host if _is_valid_ip(host) else "")
            port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
            def _device_image_url(manufacturer: str, model: str, device_id: str, name: str):
                try:
                    exts = ["png","jpg","jpeg","webp","svg"]
                    candidates = []
                    m = str(manufacturer or "")
                    mdl = str(model or "")
                    nm = str(name or "").replace(" ", "_")
                    base_models = []
                    if mdl:
                        base_models.append(mdl)
                        base_models.append(mdl.replace("-", ""))
                        base_models.append(mdl.replace("_", ""))
                        base_models.append(mdl.replace("-", "_"))
                        base_models.append(mdl.replace("_", "-"))
                        base_models.extend([x + "-100" for x in list(base_models)])
                        base_models.extend([x + "_100" for x in list(base_models)])
                    if manufacturer and model:
                        for e in exts:
                            for bm in base_models or [mdl]:
                                candidates.append(os.path.join(RESOURCES_DIR, "devices", m, f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, m, f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, f"{m}_{bm}.{e}"))
                    if model:
                        for e in exts:
                            for bm in base_models or [mdl]:
                                candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, f"{bm}.{e}"))
                    if device_id:
                        for e in exts:
                            candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{device_id}.{e}"))
                            candidates.append(os.path.join(RESOURCES_DIR, f"{device_id}.{e}"))
                    if name:
                        for e in exts:
                            candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{nm}.{e}"))
                            candidates.append(os.path.join(RESOURCES_DIR, f"{nm}.{e}"))
                    for p in candidates:
                        if os.path.isfile(p):
                            rel = os.path.relpath(p, RESOURCES_DIR).replace("\\", "/")
                            return f"/resources/{rel}"
                    def _norm(s: str):
                        return ''.join(ch.lower() for ch in s if ch.isalnum())
                    queries = []
                    if mdl:
                        queries.append(_norm(mdl))
                        queries.extend([_norm(x) for x in base_models])
                    if nm:
                        queries.append(_norm(nm))
                    if device_id:
                        queries.append(_norm(str(device_id)))
                    for root_dir in [os.path.join(RESOURCES_DIR, "devices"), RESOURCES_DIR]:
                        if not os.path.isdir(root_dir):
                            continue
                        for r, _, files in os.walk(root_dir):
                            for f in files:
                                ext = f.split(".")[-1].lower()
                                if ext not in exts:
                                    continue
                                base = f[:-(len(ext)+1)]
                                norm = _norm(base)
                                if any(q and q in norm for q in queries):
                                    full = os.path.join(r, f)
                                    if full.startswith(RESOURCES_DIR):
                                        rel = os.path.relpath(full, RESOURCES_DIR).replace("\\", "/")
                                        return f"/resources/{rel}"
                    for p in candidates:
                        if os.path.isfile(p):
                            rel = os.path.relpath(p, RESOURCES_DIR).replace("\\", "/")
                            return f"/resources/{rel}"
                    default_path = os.path.join(RESOURCES_DIR, "devices", "default.png")
                    if os.path.isfile(default_path):
                        return "/resources/devices/default.png"
                    default_root = os.path.join(RESOURCES_DIR, "default.png")
                    if os.path.isfile(default_root):
                        return "/resources/default.png"
                except Exception:
                    pass
                return None
            img_url = _device_image_url(dev.get('manufacturer'), dev.get('model'), str(dev.get('id')), dev.get('name'))
            result.append({
                "id": dev.get('id'),
                "name": dev.get('name'),
                "manufacturer": dev.get('manufacturer'),
                "model": dev.get('model'),
                "converter": c_name,
                "converter_index": c_idx,
                "template_ref": dev.get('template_ref'),
                "modbus_slave": dev.get('modbus_slave') or dev.get('address'),
                "modbus_ip": ip,
                "modbus_port": port,
                "image_url": img_url,
                # Metadata for Detailed View
                "meta_serial": dev.get('meta_serial'),
                "meta_panel": dev.get('meta_panel'),
                "meta_ct": dev.get('meta_ct')
            })

    return {"devices": result}

@app.get('/api/public/projects/{project_id}/info')
def public_project_info(project_id: str):
    path = os.path.join(PROJECTS_ROOT, project_id)
    project_json = os.path.join(path, "Project.json")
    if not os.path.exists(project_json):
        return {"project_id": project_id, "project_name": project_id, "qr_code": ""}
    try:
        with open(project_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "project_id": project_id,
                "project_name": data.get("project_name", project_id),
                "qr_code": data.get("qr_code", "")
            }
    except Exception:
        return {"project_id": project_id, "project_name": project_id, "qr_code": ""}

@app.get('/api/public/projects/{project_id}/status')
def public_device_status(project_id: str):
    # Reuse existing logic
    return get_devices_status(project_id)

@app.get('/api/public/projects/{project_id}/readings')
def public_readings(project_id: str):
    try:
        # SQL-Only Fetch (User Request)
        from services.backend.api.database import DatabaseManager
        
        db = DatabaseManager(project_id, PROJECTS_ROOT)
        rows = db.get_realtime_view() # [{"device_id":, "parameter":, "value":, "unit":, "last_updated":}]
        
        items = []
        # Enhanced config mapping for description/naming if needed
        cfg_path = _config_path(project_id)
        dev_meta_map = {}
        
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                for conv in cfg.get('converters', []):
                    for dev in (conv.get('devices') or []):
                        did = str(dev.get('id'))
                        tpl = _load_device_template(dev.get('template_ref') or '')
                        regs = tpl.get('registers', [])
                        
                        reg_dict = {r.get('key'): r for r in regs}
                        dev_meta_map[did] = {
                            "name": dev.get('name'), 
                            "regs": reg_dict
                        }
            except:
                pass

        for r in rows:
            did = r['device_id']
            key = r['parameter']
            
            # Defaults
            dname = r['device_name']
            desc = ""
            
            # Encode/Enrich from config
            if did in dev_meta_map:
                meta = dev_meta_map[did]
                dname = meta["name"] or dname
                reg_info = meta["regs"].get(key)
                if reg_info:
                    desc = reg_info.get("description", "")
                    # could optimize unit here too if DB is empty
            
            items.append({
                "device_id": did,
                "device_name": dname,
                "parameter": key,
                "value": r['value'],
                "unit": r['unit'],
                "description": desc,
                "timestamp": r['last_updated']
            })
            
        return {"items": items}
    except Exception as e:
        print(f"[ERROR] public_readings: {e}")
        return {"items": [], "error": str(e)}

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

def _resolve_assets_dir(name: str):
    candidates = []
    candidates.append(os.path.join(ROOT, 'services', 'backend', name))
    candidates.append(os.path.join(ROOT, name))
    candidates.append(os.path.join(os.path.dirname(__file__), name))
    meipass = getattr(sys, '_MEIPASS', None)
    if meipass:
        candidates.append(os.path.join(meipass, name))
    for p in candidates:
        if os.path.isdir(p):
            return p
    return candidates[0]

DEVICE_TEMPLATES_DIR = _resolve_assets_dir('device_templates')
PROTOCOL_DIR = _resolve_assets_dir('protocol')
EXCEL_TEMPLATES_DIR = _resolve_assets_dir('excel_templates')
RESOURCES_DIR = _resolve_assets_dir('resources')
try:
    os.makedirs(RESOURCES_DIR, exist_ok=True)
    os.makedirs(os.path.join(RESOURCES_DIR, "devices"), exist_ok=True)
except Exception:
    pass

@app.get('/api/templates/devices')
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
from .integrations.powerstudio import ps_get_config, ps_set_config, ps_probe, ps_status, ps_fetch_latest

POLL_THREADS = {}
STOP_FLAGS = {}
PURGED_DATA = set()
COMMANDS = {}
PROBE_HINTS = {}
CAL_STATE = {}
_DB_LOCK = threading.Lock()
RETENTION_DAYS = int(os.getenv('SQLITE_RETENTION_DAYS') or 90)

def _project_db_file(project_id: str):
    return os.path.join(_project_data_dir(project_id), 'readings.db')

def _init_db(project_id: str):
    with _DB_LOCK:
        return

def _snapshot_to_db():
    with _DB_LOCK:
        try:
            from services.backend.api.database import DatabaseManager
            if getattr(sys, 'frozen', False):
                base_dir = os.path.dirname(sys.executable)
            else:
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            projects_root = os.path.join(base_dir, 'projects')
            for pid, devs in READINGS.items():
                if not _is_sqlite_enabled(pid):
                    continue
                db = DatabaseManager(pid, projects_root)
                rows = []
                for did, rec in (devs or {}).items():
                    meta = rec.get('meta') or {}
                    for k, v in (rec.get('values') or {}).items():
                        try:
                            fval = None if v is None else float(v)
                        except:
                            continue
                        unit = (meta.get(k) or {}).get('unit', '')
                        rows.append({'device_id': str(did), 'device_name': rec.get('device_name'), 'parameter': k, 'value': fval, 'unit': unit})
                if rows:
                    db.log_historical(rows)
        except Exception:
            pass

def _start_snapshot_thread():
    def _run():
        try:
            _snapshot_to_db()
        except Exception:
            pass
        while True:
            try:
                _snapshot_to_db()
            except Exception:
                pass
            time.sleep(600)
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
        
        if func in [1, 2]:
             bits = []
             for i in range(byte_count):
                 val = data[9+i]
                 for j in range(8):
                     if len(bits) < count:
                         bits.append(1 if (val & (1 << j)) else 0)
             return bits

        regs = []
        for i in range(0, byte_count, 2):
            regs.append((data[9+i] << 8) + data[10+i])
        return regs
    except Exception:
        return None

def _read_modbus_udp_raw(ip, port, unit_id, function, address, count, timeout=2):
    try:
        tid = int(time.time() * 1000) & 0xFFFF
        pid = 0
        length = 6
        pdu = struct.pack('>B B H H', unit_id, function, address, count)
        mbap = struct.pack('>H H H', tid, pid, length)
        req = mbap + pdu
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        s.sendto(req, (ip, port))
        data, _ = s.recvfrom(1024)
        s.close()
        if len(data) < 9:
            return None
        _, func, byte_count = struct.unpack('>B B B', data[6:9])
        if func != function:
            return None
        
        if func in [1, 2]:
             bits = []
             for i in range(byte_count):
                 val = data[9+i]
                 for j in range(8):
                     if len(bits) < count:
                         bits.append(1 if (val & (1 << j)) else 0)
             return bits

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
        if function in [1, 2]:
             bits = []
             for i in range(byte_count):
                 val = reply[3+i]
                 for j in range(8):
                     if len(bits) < count:
                         bits.append(1 if (val & (1 << j)) else 0)
             return bits

        regs = []
        for i in range(0, byte_count, 2):
            regs.append((reply[3 + i] << 8) + reply[4 + i])
        return regs
    except Exception:
        return None

def _template_path_from_ref(ref: str):
    if ref.startswith('/'):
        ref = ref[1:]
    ref = str(ref or '').strip()
    if not ref:
        return os.path.join(ROOT, "device_templates")
    rel = ref.replace('/', os.sep)
    mapped = []
    legacy_prefix = os.path.join('services', 'backend', 'device_templates') + os.sep
    if rel.startswith(legacy_prefix):
        mapped.append(os.path.join('device_templates', rel[len(legacy_prefix):]))
    candidates = []
    candidates.append(os.path.join(ROOT, rel))
    for m in mapped:
        candidates.append(os.path.join(ROOT, m))
    candidates.append(os.path.join(os.path.dirname(ROOT), rel))
    candidates.append(os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')), rel))
    meipass = getattr(sys, '_MEIPASS', None)
    if meipass:
        candidates.append(os.path.join(meipass, rel))
        for m in mapped:
            candidates.append(os.path.join(meipass, m))
    for p in candidates:
        if os.path.exists(p):
            return p
    try:
        base = os.path.basename(rel)
        if base.lower().endswith('.json'):
            root_templates = os.path.join(ROOT, 'device_templates')
            if os.path.isdir(root_templates):
                for r, _, files in os.walk(root_templates):
                    for f in files:
                        if f.lower() == base.lower():
                            return os.path.join(r, f)
    except Exception:
        pass
    return candidates[0]


def _start_thread_safe(name: str, target, args=(), daemon=True):
    """Start a thread that logs any exception to poller_errors.log instead of crashing silently."""
    def _run():
        try:
            target(*args)
        except Exception:
            import traceback
            tb = traceback.format_exc()
            print(f"[POLLER] THREAD ERROR in {name}:\n{tb}")
            try:
                with open(os.path.join(ROOT, 'poller_errors.log'), 'a', encoding='utf-8') as f:
                    f.write(f"[{datetime.now().isoformat()}] THREAD ERROR in {name}:\n")
                    f.write(tb + "\n\n")
            except Exception:
                pass

    th = threading.Thread(target=_run, name=name, daemon=daemon)
    th.start()
    return th

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
    protocol = (dev.get('protocol') or (conv.get('protocol') if isinstance(conv, dict) else None) or 'modbus_tcp').lower()
    
    if not ip:
        print(f"[POLLER] ❌ ERROR: No IP address configured for {device_name}")
        return
    # Reject invalid or placeholder IPs (e.g., 0.0.0.0)
    try:
        if not _is_valid_ip(ip):
            print(f"[POLLER] ❌ ERROR: Invalid IP '{ip}' for {device_name} — skipping poll")
            return
    except Exception:
        print(f"[POLLER] ❌ ERROR: IP validation failed for {device_name}")
        return
    
    print(f"[POLLER] 📡 Connection: {ip}:{port} (Unit {unit_id})")
    
    # Load template
    tpl = _load_device_template(dev.get('template_ref') or '')
    regs = tpl.get('registers', [])
    
    if not regs:
        print(f"[POLLER] ⚠️  WARNING: No registers defined for {device_name}")
        return
    
    print(f"[POLLER] 📋 Loaded {len(regs)} registers from template")
    
    interval = float((dev.get('polling_interval') if dev else None) or (tpl.get('polling_interval') if tpl else None) or 0.5)
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
            synth_ts = datetime.now()
            values = {}
            
            hint = None
            
            regs_sorted = sorted(regs, key=lambda x: int(x.get('address') or 0))
            blocks = []
            try:
                merge_gap = int((dev.get('merge_gap') if dev else None) or (tpl.get('merge_gap') if tpl else None) or 2)
                if merge_gap < 0:
                    merge_gap = 0
            except Exception:
                merge_gap = 2
            for r in regs_sorted:
                a = int(r.get('address') or 0)
                w = int(r.get('words') or 2)
                f = int(r.get('function') or 3)
                if f in (1, 2):
                    blocks.append({'func': f, 'start': a, 'total': w, 'items': [{'reg': r, 'off': 0}]})
                    continue
                if not blocks or f != blocks[-1]['func']:
                    blocks.append({'func': f, 'start': a, 'total': 0, 'items': []})
                last_end = blocks[-1]['start'] + blocks[-1]['total']
                gap = 0
                if a > last_end:
                    gap = a - last_end
                # หากช่องว่างไม่เกิน merge_gap ให้รวมในบล็อกเดียวเพื่อลดจำนวนรอบอ่าน
                if gap > 0 and gap <= merge_gap:
                    blocks[-1]['total'] += gap
                elif gap > merge_gap:
                    blocks.append({'func': f, 'start': a, 'total': 0, 'items': []})
                off = blocks[-1]['total']
                blocks[-1]['items'].append({'reg': r, 'off': off})
                blocks[-1]['total'] += w
            cal_map = (dev.get('calibration') or tpl.get('calibration') or {})
            alpha = float((dev.get('filter_alpha') if dev else None) or (tpl.get('filter_alpha') if tpl else None) or 0.3)
            dev_key = f"{project_id}:{device_id}"
            CAL_STATE.setdefault(dev_key, {})
            has_fresh_data = False
            
            for b in blocks:
                rr = None
                # Try Block Read
                if protocol == 'tcp':
                    rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, b['func'], b['start'], b['total'], timeout=timeout)
                    if rr is None and b['func'] == 3:
                        rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, b['start'], b['total'], timeout=timeout)
                    if rr is None:
                        rr = _read_modbus_tcp_raw(ip, port, unit_id, b['func'], b['start'], b['total'], timeout=timeout)
                        if rr is None and b['func'] == 3:
                            rr = _read_modbus_tcp_raw(ip, port, unit_id, 4, b['start'], b['total'], timeout=timeout)
                else:
                    rr = _read_modbus_tcp_raw(ip, port, unit_id, b['func'], b['start'], b['total'], timeout=timeout)
                    if rr is None and b['func'] == 3:
                        rr = _read_modbus_tcp_raw(ip, port, unit_id, 4, b['start'], b['total'], timeout=timeout)
                    if rr is None:
                        rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, b['func'], b['start'], b['total'], timeout=timeout)
                        if rr is None and b['func'] == 3:
                            rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, b['start'], b['total'], timeout=timeout)
                
                # Process items (with fallback)
                for it in b['items']:
                    r = it['reg']
                    k = r.get('key')
                    dt = r.get('datatype') or 'int16'
                    sc = float(r.get('scale') or 1)
                    w = int(r.get('words') or 2)
                    a = int(r.get('address') or 0)
                    f = int(r.get('function') or 3)
                    
                    last_map = CAL_STATE[dev_key].setdefault("_last", {})
                    seg = None
                    
                    # 1. Try extracting from block result
                    if rr is not None and len(rr) >= it['off'] + w:
                        seg = rr[it['off']:it['off'] + w]
                    
                    # 2. Fallback: Individual Read
                    if seg is None:
                        # Add a small delay to prevent flooding the device
                        time.sleep(0.05)
                        # Try reading this specific register individually
                        try:
                            if protocol == 'tcp':
                                seg = _read_modbus_rtu_over_tcp(ip, port, unit_id, f, a, w, timeout=timeout)
                                if seg is None and f == 3: seg = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, a, w, timeout=timeout)
                                if seg is None: seg = _read_modbus_tcp_raw(ip, port, unit_id, f, a, w, timeout=timeout)
                                if seg is None and f == 3: seg = _read_modbus_tcp_raw(ip, port, unit_id, 4, a, w, timeout=timeout)
                            else:
                                seg = _read_modbus_tcp_raw(ip, port, unit_id, f, a, w, timeout=timeout)
                                if seg is None and f == 3: seg = _read_modbus_tcp_raw(ip, port, unit_id, 4, a, w, timeout=timeout)
                                if seg is None: seg = _read_modbus_rtu_over_tcp(ip, port, unit_id, f, a, w, timeout=timeout)
                                if seg is None and f == 3: seg = _read_modbus_rtu_over_tcp(ip, port, unit_id, 4, a, w, timeout=timeout)
                        except:
                            pass

                    # 3. Decode
                    raw = None
                    if seg is not None:
                        raw = _decode_registers(seg, dt, sc)
                    
                    if raw is not None:
                        # Success!
                        has_fresh_data = True
                        c = cal_map.get(k) or {}
                        g = float(c.get('gain') or 1)
                        o = float(c.get('offset') or 0)
                        prev = CAL_STATE[dev_key].get(k)
                        ema = raw if prev is None else (alpha * raw + (1 - alpha) * prev)
                        out = ema * g + o
                        if (r.get('unit') or '').lower() == 'hz':
                            v = out
                            if v > 400:
                                for s in (10, 100, 1000, 10000):
                                    d = v / s
                                    if 40 <= d <= 70:
                                        out = d
                                        break
                            if not (40 <= out <= 70):
                                prev = last_map.get(k)
                                if prev and (synth_ts - prev['ts']).total_seconds() <= 10:
                                    out = prev['val']
                        out = round(out, 6)
                        CAL_STATE[dev_key][k] = ema
                        values[k] = out
                        last_map[k] = {"val": out, "ts": synth_ts}
                    else:
                        # Fail: Use cache
                        prev = last_map.get(k)
                        if prev and (synth_ts - prev['ts']).total_seconds() <= 10:
                            values[k] = prev['val']
                        else:
                            values[k] = None
            p_total = None
            if values.get("ActivePower") is not None:
                p_total = values.get("ActivePower")
            elif all(values.get(k) is not None for k in ["ActivePower_L1", "ActivePower_L2", "ActivePower_L3"]):
                p_total = (values.get("ActivePower_L1") or 0) + (values.get("ActivePower_L2") or 0) + (values.get("ActivePower_L3") or 0)
            elif values.get("TotalActivePower") is not None:
                p_total = values.get("TotalActivePower")
            elif values.get("ActivePower_Total") is not None:
                p_total = values.get("ActivePower_Total")
            ae_val = values.get("ActiveEnergy_kWh")
            last_ts = CAL_STATE[dev_key].get("_ts")
            ae_state = CAL_STATE[dev_key].get("_ae")
            if ae_val is not None:
                ae_state = float(ae_val)
            else:
                if p_total is not None and last_ts is not None:
                    try:
                        dt_sec = (synth_ts - last_ts).total_seconds()
                        if dt_sec > 0:
                            inc = max(0.0, float(p_total)) * dt_sec / 3600.0
                            ae_state = (ae_state or 0.0) + inc
                            values["ActiveEnergy_kWh"] = round(ae_state, 6)
                    except:
                        pass
            CAL_STATE[dev_key]["_ae"] = ae_state
            CAL_STATE[dev_key]["_ts"] = synth_ts
            
            # Check if we got any data (Strict: must have read new data this cycle)
            online = has_fresh_data
            
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
            if online:
                try:
                    LAST_SEEN.setdefault(project_id, {})[str(device_id)] = time.time()
                except Exception:
                    pass
            
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
            
            # Save to Persistence (Hybrid: SQL + Excel)
            try:
                if online:
                    meta = {}
                    for r in regs:
                        k = r.get('key')
                        if k:
                            meta[k] = {'unit': r.get('unit'), 'description': r.get('description')}
                    
                    persistence_engine.push_reading(
                        project_id=project_id,
                        device_id=device_id,
                        device_name=device_name,
                        values=values,
                        meta=meta,
                        timestamp=datetime.now()
                    )
            except Exception as e:
                print(f"[POLLER] ⚠️  Persistence error: {e}")
            
        except Exception as e:
            print(f"[POLLER] ❌ Polling error: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
        
        # Sleep
        time.sleep(max(0.2, float(interval)))
    
    print(f"\n[POLLER] 🛑 Stopped polling {device_name} (total polls: {poll_count}, success: {success_count})")


# =============================
# EXTENSION / OVERLAY ENDPOINTS
# =============================
class ControlRequest(BaseModel):
    device_id: str
    action: str  # 'trip'|'close' or 'off'|'on'
    reason: Optional[str] = None

@app.get('/api/extension/powerstudio/status')
def extension_powerstudio_status(username: str = Depends(get_current_user)):
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    return ps_status(pid)

@app.post('/api/extension/control')
def extension_queue_control(req: ControlRequest, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    tok = _get_project_token(pid)
    if not tok:
        raise HTTPException(status_code=404, detail="Project token not found")
    act = (req.action or '').lower()
    if act in {'off', 'trip'}:
        cmd = {"type": "breaker", "action": "trip", "reason": req.reason or "overdue"}
    elif act in {'on', 'close'}:
        cmd = {"type": "breaker", "action": "close", "reason": req.reason or "payment_ok"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    lst = COMMANDS.setdefault(pid, {}).setdefault(str(req.device_id), [])
    cid = secrets.token_hex(8)
    payload = {"id": cid, "cmd": cmd, "queued_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    lst.append(payload)
    return {"ok": True, "queued_id": cid, "device_id": req.device_id, "project_id": pid}

@app.get('/api/extension/commands/list')
def extension_commands_list(device_id: str, username: str = Depends(get_current_user)):
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    
    # Check permissions (Allow users if they have access to this project)
    if not _user_allowed_project(username, pid):
         raise HTTPException(status_code=403, detail="Forbidden")

    return {"commands": COMMANDS.get(pid, {}).get(str(device_id), [])}

class RawReadRequest(BaseModel):
    device_id: str
    function: int
    address: int
    count: int

@app.post('/api/debug/modbus/read')
def debug_modbus_read(req: RawReadRequest, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    cfg_path = _config_path(pid)
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    conv = None
    dev = None
    for c in (data.get('converters') or []):
        for d in (c.get('devices') or []):
            if str(d.get('id')) == str(req.device_id):
                conv = c
                dev = d
                break
        if dev is not None:
            break
    if dev is None:
        raise HTTPException(status_code=404, detail="Device not found")
    ip = dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address')
    port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
    unit_id = int(dev.get('modbus_slave') or dev.get('address') or 1)
    protocol = (dev.get('protocol') or (conv.get('protocol') if isinstance(conv, dict) else None) or 'modbus_tcp').lower()
    if not ip:
        raise HTTPException(status_code=400, detail="Invalid IP")
    rr = None
    if protocol == 'tcp':
        rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
        if rr is None:
            rr = _read_modbus_tcp_raw(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
    elif 'udp' in protocol:
        rr = _read_modbus_udp_raw(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
        if rr is None:
            rr = _read_modbus_tcp_raw(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
    else:
        rr = _read_modbus_tcp_raw(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
        if rr is None:
            rr = _read_modbus_rtu_over_tcp(ip, port, unit_id, int(req.function), int(req.address), int(req.count), timeout=5)
    return {"project_id": pid, "device_id": req.device_id, "function": req.function, "address": req.address, "count": req.count, "values": rr}
class PowerStudioConfig(BaseModel):
    mode: str
    api_base: Optional[str] = None
    db_path: Optional[str] = None
    file_path: Optional[str] = None

@app.get('/api/extension/powerstudio/config')
def extension_powerstudio_get_config(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    cfg = ps_get_config(pid)
    return {"project_id": pid, "config": cfg}

@app.post('/api/extension/powerstudio/config')
def extension_powerstudio_set_config(payload: PowerStudioConfig, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    ps_set_config(pid, payload.dict())
    return {"ok": True}

@app.get('/api/extension/powerstudio/probe')
def extension_powerstudio_probe(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    cfg = ps_get_config(pid)
    res = ps_probe(cfg)
    if not res.get('reachable') and 'error' in res:
        raise HTTPException(status_code=504, detail=res.get('error'))
    return res

@app.get('/api/extension/powerstudio/fetch_latest')
def extension_powerstudio_fetch_latest(username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    pid = load_active().get('active')
    if not pid:
        raise HTTPException(status_code=400, detail="No active project")
    cfg = ps_get_config(pid)
    return ps_fetch_latest(cfg)

@app.get('/api/projects/{project_id}/devices/status')
def get_device_status(project_id: str, username: str = Depends(get_current_user)):
    devs = (READINGS.get(project_id) or {})
    items = []
    for did, rec in devs.items():
        items.append({
            "device_id": did,
            "device_name": rec.get('device_name'),
            "online": bool(rec.get('online')),
            "timestamp": rec.get('timestamp')
        })
    return {"items": items, "total": len(items), "online": sum(1 for x in items if x.get('online')), "offline": sum(1 for x in items if not x.get('online'))}

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
    
    print(f"\n[POLLER] 📊 Summary: {started} started, {skipped} skipped\n")

    """
    THREAD SAFETY FIX:
    Use standard threading.Thread and explicit start.
    Check is_alive() before creating new ones.
    """
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
            
            # Check existing thread
            if key in POLL_THREADS:
                t = POLL_THREADS[key]
                if t.is_alive():
                    # Check if stop flag is set (maybe it's dying), if not, it's good
                    if not STOP_FLAGS.get(key):
                        print(f"[POLLER]   ✅ {device_name} - Already running")
                        continue
                    else:
                        print(f"[POLLER]   � {device_name} - Stopping (zombie)...")
                else:
                    # Dead thread in dict
                    print(f"[POLLER]   💀 {device_name} - Found dead thread, restarting...")
                    del POLL_THREADS[key]
            
            # Start new thread
            try:
                # Clear stop flag just in case
                if key in STOP_FLAGS:
                    del STOP_FLAGS[key]
                    
                print(f"[POLLER]   🚀 Starting {device_name}...")
                th = threading.Thread(target=_poll_device, args=(project_id, conv, dev), daemon=True, name=f"poll_{device_id}")
                POLL_THREADS[key] = th
                th.start()
                started += 1
            except Exception as e:
                 print(f"[POLLER]   ❌ Failed to start thread for {device_name}: {e}")

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
    try:
        _ensure_poller(pid)
    except Exception:
        pass

    # Load config for static info
    cfg_path = _config_path(pid)
    expected_devices = []
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            for conv in cfg.get('converters', []):
                for dev in (conv.get('devices') or []):
                    host = (conv.get('settings') or {}).get('host') or conv.get('address')
                    ip_raw = dev.get('modbus_ip')
                    # Choose effective IP used by poller: prefer valid device IP; else valid converter host; else empty
                    ip = ip_raw if _is_valid_ip(ip_raw) else (host if _is_valid_ip(host) else "")
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
            # Determine robust status
            last_seen = LAST_SEEN.get(pid, {}).get(did, 0)
            now = time.time()
            dt = now - last_seen
            
            # 5-Minute Rule
            if dt > 300:
                is_online = False
                status_color = 'offline' # Red
            else:
                 is_online = True
                 # If we have recent data but some values are missing/null, ideally warn
                 # For now, if within 5 min => Green/Orange logic could be added here
                 status_color = 'online' # Green (and user can handle orange in UI if partial)

            d['status'] = status_color
            d['last_update'] = rec.get('timestamp') or time.ctime(last_seen)
            d['last_seen_seconds_ago'] = int(dt)
            output_devices.append(d)
            if is_online:
                online_count += 1
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
            host = (conv.get('settings') or {}).get('host') or conv.get('address')
            ip_raw = dev.get('modbus_ip')
            ip = ip_raw if _is_valid_ip(ip_raw) else (host if _is_valid_ip(host) else "")
            port = int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502)
            def _device_image_url(manufacturer: str, model: str, device_id: str, name: str):
                try:
                    exts = ["png","jpg","jpeg","webp","svg"]
                    candidates = []
                    m = str(manufacturer or "")
                    mdl = str(model or "")
                    nm = str(name or "").replace(" ", "_")
                    base_models = []
                    if mdl:
                        base_models.append(mdl)
                        base_models.append(mdl.replace("-", ""))
                        base_models.append(mdl.replace("_", ""))
                        base_models.append(mdl.replace("-", "_"))
                        base_models.append(mdl.replace("_", "-"))
                        base_models.extend([x + "-100" for x in list(base_models)])
                        base_models.extend([x + "_100" for x in list(base_models)])
                    if manufacturer and model:
                        for e in exts:
                            for bm in base_models or [mdl]:
                                candidates.append(os.path.join(RESOURCES_DIR, "devices", m, f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, m, f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, f"{m}_{bm}.{e}"))
                    if model:
                        for e in exts:
                            for bm in base_models or [mdl]:
                                candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{bm}.{e}"))
                                candidates.append(os.path.join(RESOURCES_DIR, f"{bm}.{e}"))
                    if device_id:
                        for e in exts:
                            candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{device_id}.{e}"))
                            candidates.append(os.path.join(RESOURCES_DIR, f"{device_id}.{e}"))
                    if name:
                        for e in exts:
                            candidates.append(os.path.join(RESOURCES_DIR, "devices", f"{nm}.{e}"))
                            candidates.append(os.path.join(RESOURCES_DIR, f"{nm}.{e}"))
                    for p in candidates:
                        if os.path.isfile(p):
                            rel = os.path.relpath(p, RESOURCES_DIR).replace("\\", "/")
                            return f"/resources/{rel}"
                    def _norm(s: str):
                        return ''.join(ch.lower() for ch in s if ch.isalnum())
                    queries = []
                    if mdl:
                        queries.append(_norm(mdl))
                        queries.extend([_norm(x) for x in base_models])
                    if nm:
                        queries.append(_norm(nm))
                    if device_id:
                        queries.append(_norm(str(device_id)))
                    for root_dir in [os.path.join(RESOURCES_DIR, "devices"), RESOURCES_DIR]:
                        if not os.path.isdir(root_dir):
                            continue
                        for r, _, files in os.walk(root_dir):
                            for f in files:
                                ext = f.split(".")[-1].lower()
                                if ext not in exts:
                                    continue
                                base = f[:-(len(ext)+1)]
                                norm = _norm(base)
                                if any(q and q in norm for q in queries):
                                    full = os.path.join(r, f)
                                    if full.startswith(RESOURCES_DIR):
                                        rel = os.path.relpath(full, RESOURCES_DIR).replace("\\", "/")
                                        return f"/resources/{rel}"
                    for p in candidates:
                        if os.path.isfile(p):
                            rel = os.path.relpath(p, RESOURCES_DIR).replace("\\", "/")
                            return f"/resources/{rel}"
                    default_path = os.path.join(RESOURCES_DIR, "devices", "default.png")
                    if os.path.isfile(default_path):
                        return "/resources/devices/default.png"
                    default_root = os.path.join(RESOURCES_DIR, "default.png")
                    if os.path.isfile(default_root):
                        return "/resources/default.png"
                except Exception:
                    pass
                return None
            img_url = _device_image_url(dev.get('manufacturer'), dev.get('model'), str(dev.get('id')), dev.get('name'))
            result.append({
                "id": dev.get('id'),
                "name": dev.get('name'),
                "manufacturer": dev.get('manufacturer'),
                "model": dev.get('model'),
                "converter": conv.get('name') or conv.get('protocol'),
                "template_ref": dev.get('template_ref'),
                "modbus_slave": dev.get('modbus_slave') or dev.get('address'),
                "modbus_ip": ip,
                "modbus_port": port,
                "image_url": img_url
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
    # Enterprise Billing Sync
    import time
    from services.backend.shared_state import READINGS, load_active
    from services.backend.api.billing.billing_service import BillingService
    from services.backend.api.billing.database import DefaultSessionLocal as SessionLocal
    
    while True:
        try:
            active = load_active().get('active')
            if active:
                project_readings = READINGS.get(active, {})
                
                # Instantiate Service with DB Session
                db = SessionLocal()
                try:
                    svc = BillingService(db)
                    svc.calculate_sync(active, project_readings)
                finally:
                    db.close()

        except Exception as e:
            print(f"[Billing] Sync error: {e}")
        time.sleep(60)
        time.sleep(60)

@app.on_event('startup')
def _startup_jobs():
    _start_snapshot_thread()
    _start_mqtt()
    # Start background billing sync
    threading.Thread(target=_billing_bg_loop, daemon=True, name="BillingBg").start()
    try:
        active = load_active().get('active')
        
        # AUTO-SELECT PROJECT IF NONE ACTIVE
        if not active:
            print("[STARTUP] No active project selected. Scanning...")
            scans = [d for d in os.listdir(PROJECTS_ROOT) if os.path.isdir(os.path.join(PROJECTS_ROOT, d))]
            if scans:
                active = scans[0]
                save_active(active)
                print(f"[STARTUP] ✅ Auto-selected active project: {active}")
            else:
                print("[STARTUP] ⚠️ No projects found to select.")

        if active:
            _ensure_poller(active)
    except Exception as e:
        print(f"[STARTUP] Error: {e}")

def _db_stats(project_id: str):
    try:
        if not _is_sqlite_enabled(project_id):
            return {"exists": False, "rows": 0, "disabled": True}
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        projects_root = os.path.join(base_dir, 'projects')
        import datetime as _dt
        now = _dt.datetime.now()
        year_dir = os.path.join(projects_root, project_id, 'data', now.strftime('%Y'))
        db_path = os.path.join(year_dir, f"{now.strftime('%Y_%m')}.db")
        if not os.path.exists(db_path):
            return {"exists": False, "rows": 0}
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM historical_logs')
        rows = cur.fetchone()[0] or 0
        cur.execute('SELECT MIN(timestamp), MAX(timestamp) FROM historical_logs')
        mn, mx = cur.fetchone()
        conn.close()
        return {"exists": True, "rows": int(rows), "min_ts": mn, "max_ts": mx}
    except Exception:
        return {"exists": False, "rows": 0}

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
    
    # Persist via Hybrid Engine
    try:
        # Construct meta from input if possible, or leave empty
        meta = {}
        cleaned_values = {}
        for k, v in values.items():
            if isinstance(v, dict):
                cleaned_values[k] = v.get('value')
                meta[k] = {'unit': v.get('unit', '')}
            else:
                cleaned_values[k] = v
                meta[k] = {'unit': ''}

        persistence_engine.push_reading(
            project_id=project_id,
            device_id=device_id,
            device_name=device_name,
            values=cleaned_values,
            meta=meta,
            timestamp=datetime.fromisoformat(timestamp) if timestamp else datetime.now()
        )
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
    return {"status":"ok","saved":len(cleaned_values)}

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
        meta = {}
        cleaned_values = {}
        for key, val in values.items():
            if isinstance(val, dict):
                cleaned_values[key] = val.get('value')
                meta[key] = {'unit': val.get('unit','')}
            else:
                cleaned_values[key] = val
                meta[key] = {'unit': ''}
        persistence_engine.push_reading(
            project_id=pid,
            device_id=device_id,
            device_name=device_name,
            values=cleaned_values,
            meta=meta,
            timestamp=datetime.fromisoformat(timestamp) if timestamp else datetime.now()
        )
        READINGS.setdefault(pid, {})[str(device_id)] = {
            'device_name': device_name,
            'converter': req.get('converter'),
            'timestamp': timestamp,
            'values': {k: (v.get('value') if isinstance(v, dict) else v) for k, v in values.items()},
            'meta': {},
            'online': True,
            'last_error': None
        }
        return {"status":"ok","saved":len(cleaned_values)}
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
    display_name: Optional[str] = None

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notifications: Optional[Dict[str, bool]] = None
    line_info: Optional[Dict] = None

@app.post('/api/projects/{project_id}/users/upsert')
def upsert_project_user(project_id: str, payload: ProjectUserPayload, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    payload.username = payload.username.strip()
    
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
    if payload.display_name is not None:
        entry['display_name'] = payload.display_name
    users[payload.username] = entry
    _save_project_users(project_id, users)
    return {"ok": True}

@app.get('/api/user/profile')
async def get_user_profile(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    project_id = user.get('project_id')
    username = user.get('username')
    
    if not project_id or not username:
         raise HTTPException(status_code=400, detail="Invalid user session")

    users = _load_project_users(project_id)
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_data = users[username].copy()
    # Remove sensitive data
    user_data.pop('password_hash', None)
    user_data.pop('salt', None)
    
    # Inject project_id so frontend knows context
    user_data['project_id'] = project_id
    
    return user_data

@app.post('/api/user/profile')
async def update_user_profile(request: Request, data: UserProfileUpdate):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    project_id = user.get('project_id')
    username = user.get('username')
    
    if not project_id or not username:
         raise HTTPException(status_code=400, detail="Invalid user session")

    users = _load_project_users(project_id)
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = users[username]
    
    # Update fields
    if data.display_name is not None:
        user_data['display_name'] = data.display_name
    if data.email is not None:
        user_data['email'] = data.email
    if data.phone is not None:
        user_data['phone'] = data.phone
    if data.notifications is not None:
        if 'notifications' not in user_data:
            user_data['notifications'] = {}
        user_data['notifications'].update(data.notifications)
    if data.line_info is not None:
        user_data['line_info'] = data.line_info
        
    users[username] = user_data
    _save_project_users(project_id, users)
    
    return {"ok": True, "user": user_data}

@app.get('/api/projects/{project_id}/users')
def list_project_users(project_id: str, username: str = Depends(get_current_user)):
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    users_data = _load_project_users(project_id)
    if not isinstance(users_data, dict):
        users_data = {}

    result = []
    for uname, data in users_data.items():
        if isinstance(data, dict):
            result.append({
                "username": uname,
                "role": data.get("role", "user"),
                "display_name": data.get("display_name", ""),
                "has_password": "password_hash" in data or "password" in data
            })
        else:
            result.append({
                "username": uname,
                "role": "user",
                "display_name": "",
                "has_password": False
            })
    
    return {"users": result}

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
    
    response.set_cookie('user_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    
    return {
        "username": payload.username, 
        "role": (u or {}).get('role', 'user'), 
        "selected_project": payload.project_id
    }

class UserAnyPayload(BaseModel):
    username: str
    password: str

@app.post('/api/login_user_any')
def api_login_user_any(payload: UserAnyPayload, response: Response):
    # 1. Try Global Admin Login first
    u = get_user_obj(payload.username)
    if u and _verify_password(u, payload.password):
        sid = uuid.uuid4().hex
        sessions = load_sessions()
        sessions[sid] = payload.username
        save_sessions(sessions)
        response.set_cookie('admin_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
        return {
            "username": payload.username, 
            "role": (u or {}).get('role', 'user'), 
            "project_id": None, 
            "isAdmin": True,
            "redirect": "/app"
        }

    # 2. Search across all projects for this user
    target_pid = None
    user_obj = None
    
    # Check if we can find the user in any project
    try:
        for name in os.listdir(PROJECTS_ROOT):
            full = os.path.join(PROJECTS_ROOT, name)
            if not os.path.isdir(full):
                continue
            
            # Check user in this project
            u = _get_project_user(name, payload.username)
            if u and _verify_password(u, payload.password):
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
    
    response.set_cookie('user_session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    response.set_cookie('session_id', sid, httponly=True, samesite='strict', secure=False, max_age=7*24*3600)
    
    return {
        "username": payload.username, 
        "role": (user_obj or {}).get('role', 'user'), 
        "project_id": target_pid, 
        "redirect": f"/app?pid={target_pid}"
    }

# =============================
# SERVE FRONTEND (Moved to end)
# =============================
print(f"[BACKEND] Serving frontend from: {FRONTEND_DIR} (Production: {IS_PRODUCTION})")

if IS_PRODUCTION:
    # Mount assets folder
    assets_dir = os.path.join(FRONTEND_DIR, 'assets')
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.isdir(RESOURCES_DIR):
        app.mount("/resources", StaticFiles(directory=RESOURCES_DIR), name="resources")
    
    # Serve index.html on root
    @app.get("/")
    async def serve_spa_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    # Fallback for SPA routing (catch-all for non-API routes)
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        if full_path.startswith("api") or full_path.startswith("assets"):
            raise HTTPException(status_code=404)
        # Check if file exists (e.g. favicon.ico)
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise return index.html for React Router
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

else:
    # LEGACY / DEV MODE
    if os.path.isdir(FRONTEND_DIR):
        app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    if os.path.isdir(RESOURCES_DIR):
        app.mount("/resources", StaticFiles(directory=RESOURCES_DIR), name="resources")
    else:
        print("[BACKEND] WARNING: Frontend directory not found! Web UI will not work.")

    # Home -> User page
    @app.get("/")
    def home():
        if not os.path.isdir(FRONTEND_DIR):
            return {"error": "Frontend not found", "path_checked": FRONTEND_DIR}
        return RedirectResponse(url="/frontend/login.html")

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return FileResponse(os.path.join(FRONTEND_DIR, "favicon.ico"))

@app.get('/api/projects/{project_id}/login_qr')
def project_login_qr(project_id: str):
    url = f"/frontend/login.html?pid={project_id}"
    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return {"qr": f"data:image/png;base64,{b64}", "url": url}
# =============================
# SERVE FRONTEND (SPA)
# =============================
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount static assets first (CSS, JS, Images)
# In dev: frontend/dist/assets
# In prod (exe): internal/dist/assets
import sys

def get_frontend_dist():
    # If frozen (EXE), use executable directory
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
        dist = os.path.join(base_dir, "frontend", "dist")
        if os.path.exists(dist):
            return dist
        return os.path.join(base_dir, "dist")
    else:
        # Dev mode: use project ROOT
        return os.path.join(ROOT, "frontend", "dist")

dist_path = get_frontend_dist()

if os.path.exists(dist_path):
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.isdir(RESOURCES_DIR):
        app.mount("/resources", StaticFiles(directory=RESOURCES_DIR), name="resources")
    
    # Serve other root files like favicon, manifest if needed, or simply catch-all index
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API requests already handled above due to order? 
        # FastAPI matches routes in order. Since this is at bottom, specific API routes match first.
        # But we must be careful not to hide API 404s? 
        # Actually, API routes are usually defined with @app.get("/api/...") so they match specifically.
        
        # Check if file exists in dist (e.g. favicon.ico)
        file_path = os.path.join(dist_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to index.html for SPA routing
        index_path = os.path.join(dist_path, "index.html")
        return FileResponse(index_path)
else:
    print(f"[WARNING] Frontend dist not found at {dist_path}. API only mode.")
