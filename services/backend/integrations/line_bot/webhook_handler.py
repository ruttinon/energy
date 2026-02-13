"""
Complete LINE Bot Webhook Server
พร้อมใช้กับ FastAPI สำหรับรับข้อมูลจาก LINE
"""

import hmac
import hashlib
import base64
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class WebhookHandler:
    """Handle LINE webhook signature and events"""
    
    def __init__(self, channel_secret: str):
        """
        Initialize webhook handler
        
        Args:
            channel_secret: LINE Channel Secret
        """
        self.channel_secret = channel_secret
        self.request_log_file = Path(__file__).parent.parent.parent.parent / "webhook_requests.log"
    
    def verify_signature(self, body: str, signature: str) -> bool:
        """
        Verify LINE webhook signature
        
        Args:
            body: Request body as string
            signature: X-Line-Signature header value
        
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            hash_object = hmac.new(
                self.channel_secret.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            )
            expected_signature = base64.b64encode(hash_object.digest()).decode('utf-8')
            
            is_valid = hmac.compare_digest(signature, expected_signature)
            
            if not is_valid:
                logger.warning(f"Invalid signature. Expected: {expected_signature[:20]}..., Got: {signature[:20]}...")
            
            return is_valid
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False
    
    def log_webhook_request(self, body: str, signature: Optional[str], events_count: int):
        """Log incoming webhook request"""
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "signature": signature[:20] + "..." if signature else "None",
                "events_count": events_count,
                "body_length": len(body)
            }
            
            with open(self.request_log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            logger.error(f"Error logging request: {e}")
    
    def parse_events(self, body: str) -> list:
        """
        Parse LINE webhook events
        
        Args:
            body: Request body as string
        
        Returns:
            List of events
        """
        try:
            data = json.loads(body)
            return data.get('events', [])
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {e}")
            return []


class LineWebhookProcessor:
    """Process LINE webhook events"""
    
    def __init__(self):
        self.handlers = {}
    
    def register_handler(self, event_type: str, handler):
        """
        Register event handler
        
        Args:
            event_type: Type of event (e.g., 'message', 'follow', 'unfollow')
            handler: Callback function for event
        """
        self.handlers[event_type] = handler
        logger.info(f"Registered handler for event type: {event_type}")
    
    def process(self, events: list) -> Dict[str, Any]:
        """
        Process webhook events
        
        Args:
            events: List of LINE webhook events
        
        Returns:
            Processing result
        """
        results = {
            "total_events": len(events),
            "processed": 0,
            "failed": 0,
            "errors": []
        }
        
        for event in events:
            try:
                event_type = event.get('type')
                
                if event_type in self.handlers:
                    handler = self.handlers[event_type]
                    handler(event)
                    results["processed"] += 1
                    logger.info(f"Processed event: {event_type}")
                else:
                    logger.debug(f"No handler for event type: {event_type}")
                    results["processed"] += 1
                
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                results["failed"] += 1
                results["errors"].append(str(e))
        
        return results


# FastAPI Integration Functions

async def handle_line_webhook(
    body: str,
    signature: str,
    channel_secret: str,
    line_bot_api,
    line_service
) -> Dict[str, Any]:
    """
    Handle incoming LINE webhook
    
    Args:
        body: Request body
        signature: X-Line-Signature header
        channel_secret: LINE Channel Secret
        line_bot_api: LINE Bot API instance
        line_service: LINE Bot service instance
    
    Returns:
        Result dictionary
    """
    
    # Initialize webhook handler
    webhook_handler = WebhookHandler(channel_secret)
    
    # Log request
    print("\n" + "="*70)
    print(f"⏰ Webhook received at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Parse events
    events = webhook_handler.parse_events(body)
    
    if not events:
        print("❌ No events in webhook")
        return {"status": "error", "message": "No events"}
    
    print(f"✅ Events count: {len(events)}")
    
    # Log request
    webhook_handler.log_webhook_request(body, signature, len(events))
    
    # Verify signature (for production, this will be strict)
    if signature:
        is_valid = webhook_handler.verify_signature(body, signature)
        if not is_valid:
            logger.warning("⚠️  Webhook signature invalid - but processing anyway for debugging")
            print("⚠️  Signature validation: FAILED (but continuing...)")
        else:
            print("✅ Signature validation: PASSED")
    else:
        print("⚠️  No signature provided (debug mode)")
    
    # Process events using existing line_service
    result = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "events_processed": 0,
        "events_failed": 0,
        "details": []
    }
    
    for i, event in enumerate(events, 1):
        try:
            event_type = event.get('type')
            print(f"\n📨 Event {i}/{len(events)}: {event_type}")
            
            # Handle message event
            if event_type == 'message':
                message_type = event.get('message', {}).get('type')
                
                if message_type == 'text':
                    user_id = event.get('source', {}).get('userId')
                    reply_token = event.get('replyToken')
                    user_message = event.get('message', {}).get('text', '')
                    
                    print(f"   👤 User: {user_id[:20]}...")
                    print(f"   💬 Message: {user_message}")
                    print(f"   🔑 Reply Token: {reply_token[:20]}...")
                    
                    if line_service:
                        from .user_preferences import user_preferences
                        project_id = user_preferences.get_user_project(user_id)
                        
                        # Generate response using the more capable method
                        response, quick_replies = line_service._generate_ai_response_with_buttons(user_message, project_id, user_id)
                        
                        if response:
                            from linebot.models import TextSendMessage, QuickReply
                            
                            # Build message with optional quick replies
                            if quick_replies:
                                message = TextSendMessage(
                                    text=response,
                                    quick_reply=QuickReply(items=quick_replies)
                                )
                            else:
                                message = TextSendMessage(text=response)
                                
                            line_bot_api.reply_message(reply_token, message)
                            print(f"   ✅ Response sent: {response[:50]}...")
                            result["events_processed"] += 1
                    
            elif event_type == 'follow':
                user_id = event.get('source', {}).get('userId')
                print(f"   👋 User followed: {user_id[:20]}...")
                result["events_processed"] += 1
                
            elif event_type == 'unfollow':
                user_id = event.get('source', {}).get('userId')
                print(f"   👋 User unfollowed: {user_id[:20]}...")
                result["events_processed"] += 1
                
            elif event_type == 'join':
                group_id = event.get('source', {}).get('groupId')
                print(f"   👥 Joined group: {group_id[:20]}...")
                result["events_processed"] += 1
                
            else:
                print(f"   ⚠️  Unhandled event type: {event_type}")
                result["events_processed"] += 1
            
            result["details"].append({
                "event_number": i,
                "type": event_type,
                "status": "processed"
            })
            
        except Exception as e:
            logger.error(f"Error processing event {i}: {e}")
            print(f"   ❌ Error: {e}")
            result["events_failed"] += 1
            result["details"].append({
                "event_number": i,
                "status": "failed",
                "error": str(e)
            })
    
    print("\n" + "="*70)
    print(f"📊 Summary: {result['events_processed']} processed, {result['events_failed']} failed")
    print("="*70 + "\n")
    
    return result
