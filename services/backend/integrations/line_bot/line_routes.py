"""
LINE Bot API Routes
"""
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
import logging
from typing import Dict, Any
from datetime import datetime
import urllib.parse

from .line_config import LineConfig
from .line_service import LineBotService
from .webhook_handler import handle_line_webhook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/line", tags=["LINE Bot"])

# Global LINE bot service instance
line_bot_service: LineBotService = None

def get_line_service() -> LineBotService:
    """Get LINE bot service instance"""
    global line_bot_service
    if line_bot_service is None:
        try:
            config = LineConfig.from_env()
            config.validate()
            line_bot_service = LineBotService(config)
            logger.info("LINE Bot service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LINE Bot service: {e}")
            raise HTTPException(status_code=500, detail="LINE Bot service not configured")
    
    return line_bot_service

@router.post("/webhook")
async def line_webhook(
    request: Request,
    x_line_signature: str = Header(None),
    line_service: LineBotService = Depends(get_line_service)
):
    """LINE webhook endpoint"""
    try:
        body = await request.body()
        body_str = body.decode('utf-8')
        
        # Get configuration for signature verification
        config = LineConfig.from_env()
        
        # Use webhook handler
        result = await handle_line_webhook(
            body=body_str,
            signature=x_line_signature or "",
            channel_secret=config.channel_secret,
            line_bot_api=line_service.line_bot_api,
            line_service=line_service
        )
        
        if result.get("status") == "ok":
            return JSONResponse(content={"status": "ok"})
        else:
            logger.error(f"Webhook processing failed: {result}")
            return JSONResponse(content={"status": "ok"})  # Always return 200 to LINE
            
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"status": "ok"})  # Always return 200 to LINE


@router.post("/webhook_v2")
async def line_webhook_v2(
    request: Request,
    x_line_signature: str = Header(None),
    line_service: LineBotService = Depends(get_line_service)
):
    """LINE webhook endpoint (v2)"""
    try:
        body = await request.body()
        body_str = body.decode('utf-8')

        signature = x_line_signature or "debug"
        ok = line_service.process_webhook(body_str, signature)
        if not ok:
            logger.error("Webhook v2: process_webhook returned False")

        return JSONResponse(content={"status": "ok"})
    except Exception as e:
        logger.error(f"Webhook v2 error: {e}")
        return JSONResponse(content={"status": "ok"})

@router.post("/callback")
async def line_callback(
    request: Request,
    x_line_signature: str = Header(None),
    line_service: LineBotService = Depends(get_line_service)
):
    body = await request.body()
    body_str = body.decode('utf-8')
    config = LineConfig.from_env()
    result = await handle_line_webhook(
        body=body_str,
        signature=x_line_signature or "",
        channel_secret=config.channel_secret,
        line_bot_api=line_service.line_bot_api,
        line_service=line_service
    )
    return JSONResponse(content={"status": "ok"})

@router.get("/test/respond")
async def test_respond(text: str, line_service: LineBotService = Depends(get_line_service)):
    resp, buttons = line_service._generate_ai_response_with_buttons(text, None, None)
    data = {"response": resp, "quick_reply": bool(buttons)}
    return JSONResponse(content=data)

@router.get("/link_info")
async def get_link_info(project_id: str, line_service: LineBotService = Depends(get_line_service)):
    try:
        basic_id = "@585vtsqe"
        bot_name = "EnergyLink Bot"
        try:
            bot_info = line_service.line_bot_api.get_bot_info()
            basic_id = bot_info.basic_id or basic_id
            bot_name = bot_info.display_name or bot_name
        except Exception as e:
            logger.warning(f"get_bot_info() failed, using fallback: {e}")
        message = f"Link {project_id}"
        encoded_msg = urllib.parse.quote(message)
        deep_link = f"https://line.me/R/oaMessage/{basic_id}/?{encoded_msg}"
        add_friend_link = f"https://line.me/R/ti/p/{basic_id}"
        qr_data = urllib.parse.quote(add_friend_link)
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={qr_data}"
        return JSONResponse(content={
            "bot_name": bot_name,
            "basic_id": basic_id,
            "deep_link": deep_link,
            "add_friend_link": add_friend_link,
            "qr_url": qr_url,
            "instruction": "Click the link or scan the QR code to add the bot as friend."
        })
    except Exception as e:
        basic_id = "@585vtsqe"
        add_friend_link = f"https://line.me/R/ti/p/{basic_id}"
        qr_data = urllib.parse.quote(add_friend_link)
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={qr_data}"
        return JSONResponse(content={
            "bot_name": "EnergyLink Bot",
            "basic_id": basic_id,
            "deep_link": add_friend_link,
            "add_friend_link": add_friend_link,
            "qr_url": qr_url,
            "instruction": "Click the link or scan the QR code to add the bot as friend."
        })
@router.post("/send/{user_id}")
async def send_message(
    user_id: str,
    message_data: Dict[str, str],
    line_service: LineBotService = Depends(get_line_service)
):
    """Send message to specific user"""
    try:
        message = message_data.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        success = line_service.send_message(user_id, message)
        
        if success:
            return JSONResponse(content={"status": "sent", "user_id": user_id})
        else:
            raise HTTPException(status_code=500, detail="Failed to send message")
            
    except Exception as e:
        logger.error(f"Send message error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/broadcast")
async def broadcast_message(
    message_data: Dict[str, str],
    line_service: LineBotService = Depends(get_line_service)
):
    """Broadcast message to all users"""
    try:
        message = message_data.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        success = line_service.broadcast_message(message)
        
        if success:
            return JSONResponse(content={"status": "broadcasted"})
        else:
            raise HTTPException(status_code=500, detail="Failed to broadcast message")
            
    except Exception as e:
        logger.error(f"Broadcast error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/status")
async def line_status():
    """Get LINE bot status"""
    try:
        global line_bot_service
        if line_bot_service is None:
            return JSONResponse(content={
                "status": "not_configured",
                "message": "LINE Bot service not initialized"
            })
        
        return JSONResponse(content={
            "status": "active",
            "message": "LINE Bot service is running"
        })
        
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/test")
async def test_line_bot(
    message_data: Dict[str, str],
    line_service: LineBotService = Depends(get_line_service)
):
    """Test LINE bot functionality"""
    try:
        message = message_data.get("message", "ทดสอบ LINE Bot")
        user_id = message_data.get("user_id", "test")
        
        # For testing, we'll just validate the service is working
        response = line_service._generate_ai_response(message)
        
        return JSONResponse(content={
            "status": "test_passed",
            "user_message": message,
            "ai_response": response
        })
        
    except Exception as e:
        logger.error(f"Test error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
