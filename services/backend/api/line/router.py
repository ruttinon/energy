from fastapi import APIRouter, Request, Header, HTTPException
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage
from .line_client import handler, line_bot_api
from .bot_logic import handle_text_message
from .config import LINE_CHANNEL_SECRET
import urllib.parse

router = APIRouter()

# ============================================================
# Fallback Bot Info (ใช้เมื่อ API get_bot_info() fail)
# ============================================================
FALLBACK_BOT_BASIC_ID = "@585vtsqe"
FALLBACK_BOT_NAME = "EnergyLink Bot"

@router.get("/status")
def webhook_status():
    return {"status": "active"}

@router.get("/link_info")
def get_link_info(project_id: str):
    """Get Deep Link and QR Code to link LINE account"""
    try:
        # Try to get Bot info from API first
        basic_id = FALLBACK_BOT_BASIC_ID
        bot_name = FALLBACK_BOT_NAME
        try:
            bot_info = line_bot_api.get_bot_info()
            basic_id = bot_info.basic_id or FALLBACK_BOT_BASIC_ID
            bot_name = bot_info.display_name or FALLBACK_BOT_NAME
        except Exception as e:
            print(f"[LINE] get_bot_info() failed, using fallback: {e}")
        
        # Construct Message
        message = f"Link {project_id}"
        encoded_msg = urllib.parse.quote(message)
        
        # Deep Link: opens LINE chat with bot and pre-fills message
        deep_link = f"https://line.me/R/oaMessage/{basic_id}/?{encoded_msg}"
        
        # Add Friend Link (more reliable than oaMessage)
        add_friend_link = f"https://line.me/R/ti/p/{basic_id}"
        
        # QR Code - use Add Friend link for QR (works better)
        qr_data = urllib.parse.quote(add_friend_link)
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={qr_data}"
        
        return {
            "bot_name": bot_name,
            "basic_id": basic_id,
            "deep_link": deep_link,
            "add_friend_link": add_friend_link,
            "qr_url": qr_url,
            "instruction": "Click the link or scan the QR code to add the bot as friend."
        }
    except Exception as e:
        # Even if everything fails, return fallback data
        basic_id = FALLBACK_BOT_BASIC_ID
        add_friend_link = f"https://line.me/R/ti/p/{basic_id}"
        qr_data = urllib.parse.quote(add_friend_link)
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={qr_data}"
        return {
            "bot_name": FALLBACK_BOT_NAME,
            "basic_id": basic_id,
            "deep_link": add_friend_link,
            "add_friend_link": add_friend_link,
            "qr_url": qr_url,
            "instruction": "Click the link or scan the QR code to add the bot as friend."
        }

@router.post("/callback")
async def callback(request: Request, x_line_signature: str = Header(None)):
    body = await request.body()
    body_str = body.decode('utf-8')
    
    # If no secret is configured, we can't verify. 
    # Warning: This is insecure.
    if not LINE_CHANNEL_SECRET:
        print("WARNING: No LINE_CHANNEL_SECRET configured. Skipping signature verification (Not recommended).")
        # If we skip verification, we must manually parse.
        # But handler.handle() REQUIRES secret to match.
        # So we might need to manually parse the JSON if secret is missing.
        import json
        data = json.loads(body_str)
        for event in data.get('events', []):
            if event.get('type') == 'message' and event.get('message', {}).get('type') == 'text':
                user_id = event.get('source', {}).get('userId')
                reply_token = event.get('replyToken')
                text = event.get('message', {}).get('text')
                handle_text_message(user_id, reply_token, text)
        return "OK"

    try:
        handler.handle(body_str, x_line_signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature. Please check your Channel Secret.")
        
    return "OK"

@handler.add(MessageEvent, message=TextMessage)
def handle_message(event):
    handle_text_message(event.source.user_id, event.reply_token, event.message.text)
