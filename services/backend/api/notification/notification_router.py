from fastapi import APIRouter, HTTPException, Body, Depends, Cookie, Header
from typing import Optional, List, Dict, Any
import os, json, uuid, datetime

router = APIRouter()

def _root():
    import sys
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

ROOT = _root()
DATA_DIR = os.path.join(ROOT, 'services', 'backend', 'data')
os.makedirs(DATA_DIR, exist_ok=True)
NOTIFICATIONS_FILE = os.path.join(DATA_DIR, 'notifications.json')

def _load_notifications() -> List[Dict[str, Any]]:
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        return json.loads(open(NOTIFICATIONS_FILE, 'r', encoding='utf-8').read())
    except Exception:
        return []

def _save_notifications(items: List[Dict[str, Any]]):
    try:
        with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _sessions_file_path():
    return os.path.join(ROOT, 'sessions.json')

def get_current_user_dep(
    session_id: Optional[str] = Cookie(None),
    user_session_id: Optional[str] = Cookie(None),
    admin_session_id: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    try:
        sid = None
        if authorization and str(authorization).lower().startswith("bearer "):
            sid = str(authorization).split(" ")[1]
        elif user_session_id:
            sid = user_session_id
        elif session_id:
            sid = session_id
        elif admin_session_id:
            sid = admin_session_id
        if not sid:
            raise HTTPException(status_code=401, detail="Unauthorized")
        sessions = {}
        sf = _sessions_file_path()
        if os.path.exists(sf):
            try:
                sessions = json.loads(open(sf, 'r', encoding='utf-8').read())
            except Exception:
                sessions = {}
        username = sessions.get(sid)
        if not username:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return username
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Helper to create notification internally
def create_notification_internal(username: str, project_id: Optional[str], title: str, message: str, type: str = "info"):
    items = _load_notifications()
    nid = uuid.uuid4().hex
    notif = {
        "id": nid,
        "username": username,
        "project_id": project_id,
        "title": title,
        "message": message,
        "type": type,
        "read": False,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    items.append(notif)
    _save_notifications(items)
    
    # 🚀 LINE Notification Integration
    try:
        if project_id:
            # Lazy import to avoid circular dependency
            from services.backend.integrations.line_bot.line_config import LineConfig
            from services.backend.integrations.line_bot.line_service import LineBotService
            from services.backend.integrations.line_bot.alert_manager import AlertManager

            # We need to construct config manually or from env because we are deep in backend
            cfg = LineConfig.from_env()
            
            # Basic validation
            if cfg.channel_access_token and cfg.channel_secret:
                # Reuse global instance if possible or create new (lightweight)
                # Ideally we should use a shared instance but for now new instance is safer for threading
                line_service = LineBotService(cfg)
                alert_manager = AlertManager(line_service)
                
                # Format message
                icon = "ℹ️"
                if type == "warning": icon = "⚠️"
                elif type == "alert": icon = "🔔"
                elif type == "success": icon = "✅"
                elif type == "error": icon = "🚨"
                
                line_msg = f"{message}"
                # Use a cleaner format for LINE
                full_msg = f"{icon} {title}\n{line_msg}"
                
                alert_manager.send_alert_to_project_users(project_id, full_msg)
    except Exception as e:
        print(f"[Notification] Failed to send LINE alert: {e}")
        
    return nid

@router.get('/list')
def list_notifications(project_id: Optional[str] = None, username: str = Depends(get_current_user_dep)):
    items = _load_notifications()
    
    # Filter logic:
    # 1. Username matches (case-insensitive) OR notification is broadcast (username is None/Empty)
    # 2. Project matches OR notification is global (project_id is None/Empty)
    
    user_lower = str(username).lower().strip()
    out = []
    
    for n in items:
        # Check Username
        n_user = n.get('username')
        user_match = False
        if not n_user: # Broadcast
            user_match = True
        elif str(n_user).lower().strip() == user_lower:
            user_match = True
            
        if not user_match:
            continue
            
        # Check Project (if project_id is requested)
        if project_id:
            n_proj = n.get('project_id')
            if n_proj and str(n_proj) != str(project_id):
                continue
        
        out.append(n)
    
    out.sort(key=lambda x: x.get('created_at') or '', reverse=True)
    return {"items": out}

@router.post('/read/{notif_id}')
def mark_read(notif_id: str, username: str = Depends(get_current_user_dep)):
    items = _load_notifications()
    found = False
    user_lower = str(username).lower().strip()
    
    for n in items:
        # Check ownership (username match or broadcast)
        n_user = n.get('username')
        is_owner = False
        if not n_user:
            is_owner = True
        elif str(n_user).lower().strip() == user_lower:
            is_owner = True
            
        if n.get('id') == notif_id and is_owner:
            n['read'] = True
            found = True
            break
            
    if found:
        _save_notifications(items)
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Notification not found")

@router.post('/read_all')
def mark_all_read(project_id: Optional[str] = None, username: str = Depends(get_current_user_dep)):
    items = _load_notifications()
    user_lower = str(username).lower().strip()
    
    for n in items:
        # Check ownership
        n_user = n.get('username')
        is_owner = False
        if not n_user:
            is_owner = True
        elif str(n_user).lower().strip() == user_lower:
            is_owner = True
            
        if is_owner:
            # Check project match if provided
            if not project_id or not n.get('project_id') or str(n.get('project_id')) == str(project_id):
                n['read'] = True
                
    _save_notifications(items)
    return {"ok": True}

@router.post('/create')
def create_notification_api(payload: dict = Body(...)):
    # Admin or system use
    # payload: {username, project_id, title, message, type}
    create_notification_internal(
        username=payload.get('username'),
        project_id=payload.get('project_id'),
        title=payload.get('title'),
        message=payload.get('message'),
        type=payload.get('type') or 'info'
    )
    return {"ok": True}
