import time
from typing import List
from .store import get_user, update_user
from .ai_service import get_ai_response
from .line_client import reply_message, push_message
from services.backend.api.service.service_router import _load_jobs

def handle_text_message(user_id: str, reply_token: str, text: str):
    user = get_user(user_id)
    user.last_interaction = time.time()
    
    # 1. Check for commands
    if text.lower() == "human" or text.lower() == "admin":
        user.mode = "manual"
        update_user(user)
        reply_message(reply_token, "🔄 Switched to Manual Mode. An admin will be with you shortly.")
        print(f"User {user_id} requested admin support.")
        return

    if text.lower() == "ai" or text.lower() == "auto":
        user.mode = "ai"
        update_user(user)
        reply_message(reply_token, "🤖 Switched to AI Mode.")
        return

    # Project Linking Command: "Link <ProjectID>"
    if text.lower().startswith("link "):
        try:
            pid = text.split(" ", 1)[1].strip()
            user.project_id = pid
            update_user(user)
            reply_message(reply_token, f"✅ Linked to project: {pid}. I can now answer questions about your system.")
            return
        except:
            reply_message(reply_token, "Usage: Link <ProjectID>")
            return

    # 2. Handle Manual Mode
    if user.mode == "manual":
        return

    # 3. Handle Service Tracking
    if "my service" in text.lower() or "check job" in text.lower():
        reply_message(reply_token, "To track your service, please provide your Ticket ID or contact Admin.")
        return

    # 4. AI Response
    user.context_history.append({"user": text})
    if len(user.context_history) > 10:
        user.context_history = user.context_history[-10:]
    
    # Get AI Answer (with project context)
    ai_reply = get_ai_response(text, user.context_history, user.project_id)
    
    # Update context with AI reply
    user.context_history.append({"ai": ai_reply})
    update_user(user)
    
    reply_message(reply_token, ai_reply)

def notify_user(user_id: str, message: str):
    push_message(user_id, message)
