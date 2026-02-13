from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from typing import List, Optional
import os, json
from datetime import datetime

if getattr(__import__('sys'), 'frozen', False):
    ROOT = os.path.dirname(__import__('sys').executable)
else:
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

PROJECTS_ROOT = os.path.join(ROOT, 'projects')

router = APIRouter()

def _project_path(project_id: str):
    return os.path.join(PROJECTS_ROOT, project_id)

def _support_dir(project_id: str):
    path = os.path.join(_project_path(project_id), 'support')
    os.makedirs(path, exist_ok=True)
    return path

def _tickets_json(project_id: str):
    return os.path.join(_support_dir(project_id), 'tickets.json')

def _attachments_dir(project_id: str, ticket_id: str):
    path = os.path.join(_support_dir(project_id), 'attachments', ticket_id)
    os.makedirs(path, exist_ok=True)
    return path

def _load_tickets(project_id: str) -> List[dict]:
    tj = _tickets_json(project_id)
    if not os.path.exists(tj):
        return []
    try:
        with open(tj, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def _save_tickets(project_id: str, tickets: List[dict]):
    tj = _tickets_json(project_id)
    try:
        with open(tj, 'w', encoding='utf-8') as f:
            json.dump(tickets, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot save tickets: {e}")

@router.get("/{project_id}/tickets")
def list_tickets(project_id: str):
    tickets = _load_tickets(project_id)
    tickets.sort(key=lambda x: x.get('created_at') or '', reverse=True)
    return {"status": "ok", "data": tickets}

@router.post("/{project_id}/submit")
async def submit_ticket(
    project_id: str,
    name: str = Form(...),
    phone: str = Form(...),
    project_name: Optional[str] = Form(None),
    description: str = Form(...),
    files: List[UploadFile] = File(None)
):
    tid = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    ticket = {
        "id": tid,
        "project_id": project_id,
        "project_name": project_name,
        "name": name,
        "phone": phone,
        "description": description,
        "attachments": [],
        "created_at": datetime.utcnow().isoformat() + "Z",
        "status": "open"
    }

    if files:
        adir = _attachments_dir(project_id, tid)
        for f in files:
            fname = os.path.basename(f.filename or '')
            if not fname:
                fname = f"file_{datetime.utcnow().strftime('%H%M%S%f')}"
            dest = os.path.join(adir, fname)
            try:
                content = await f.read()
                with open(dest, 'wb') as out:
                    out.write(content)
                ticket["attachments"].append({"filename": fname})
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save file {fname}: {e}")

    tickets = _load_tickets(project_id)
    tickets.append(ticket)
    _save_tickets(project_id, tickets)

    try:
        import smtplib
        from email.mime.text import MIMEText
        admin_email = os.environ.get("SUPPORT_ADMIN_EMAIL", "")
        smtp_host = os.environ.get("SUPPORT_SMTP_HOST", "")
        smtp_port = int(os.environ.get("SUPPORT_SMTP_PORT", "0") or "0")
        smtp_user = os.environ.get("SUPPORT_SMTP_USER", "")
        smtp_pass = os.environ.get("SUPPORT_SMTP_PASS", "")

        if admin_email and smtp_host and smtp_port > 0:
            body = f"[Support Ticket]\nProject: {project_id}\nName: {name}\nPhone: {phone}\nDesc: {description}\nAttachments: {len(ticket['attachments'])}"
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = f"New Support Ticket ({project_id}) #{tid}"
            msg["From"] = smtp_user or admin_email
            msg["To"] = admin_email
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_user and smtp_pass:
                    try:
                        server.starttls()
                    except Exception:
                        pass
                    server.login(smtp_user, smtp_pass)
                server.sendmail(msg["From"], [admin_email], msg.as_string())
    except Exception:
        pass

    return {"status": "ok", "id": tid}

@router.get("/{project_id}/attachment/{ticket_id}/{filename}")
def download_attachment(project_id: str, ticket_id: str, filename: str):
    path = os.path.join(_attachments_dir(project_id, ticket_id), filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)
