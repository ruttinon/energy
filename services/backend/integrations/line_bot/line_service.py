"""
LINE Bot Service - Integration with LINE Messaging API
"""
import logging
from datetime import datetime
from typing import Dict, Any, List
import json
from pathlib import Path
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError, LineBotApiError
from linebot.models import (
    MessageEvent, TextMessage, TextSendMessage,
    QuickReply, QuickReplyButton, MessageAction,
    TemplateSendMessage, ButtonsTemplate, CarouselTemplate,
    CarouselColumn, URIAction, PostbackAction
)

from .line_config import LineConfig
from .user_preferences import user_preferences
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
from .webhook_handler import WebhookHandler as CustomWebhookHandler

logger = logging.getLogger(__name__)

class LineBotService:
    """LINE Bot service for EnergyLink integration"""
    
    def __init__(self, config: LineConfig):
        self.config = config
        self.line_bot_api = LineBotApi(config.channel_access_token)
        self.handler = WebhookHandler(config.channel_secret)
        
        # Register handlers
        self._register_handlers()
    
    def _register_handlers(self):
        """Register LINE message handlers"""
        @self.handler.add(MessageEvent, message=TextMessage)
        def handle_text_message(event):
            """Handle text messages from users"""
            try:
                user_message = event.message.text.strip()
                user_id = event.source.user_id
                
                # Get user project preference
                user_project = self._get_user_project_preference(user_id)
                
                # AI Chat Bot responses - get both text and optional quick reply
                response, quick_reply_buttons = self._generate_ai_response_with_buttons(user_message, user_project, user_id)
                
                # If no response (e.g. manual mode silent), don't reply
                if not response:
                    return

                # Build message with optional Quick Reply
                if quick_reply_buttons:
                    message = TextSendMessage(
                        text=response,
                        quick_reply=QuickReply(items=quick_reply_buttons)
                    )
                else:
                    message = TextSendMessage(text=response)
                
                # Send reply
                self.line_bot_api.reply_message(
                    event.reply_token,
                    message
                )
                
                logger.info(f"Replied to user {user_id}: {response}")
                
            except Exception as e:
                logger.error(f"Error handling message: {e}")
                self._send_error_reply(event.reply_token)

    def _get_user_project_preference(self, user_id: str):
        return user_preferences.get_user_project(user_id)

    def _send_error_reply(self, reply_token):
        try:
            self.line_bot_api.reply_message(
                reply_token,
                TextSendMessage(text="⚠️ ขออภัย เกิดข้อผิดพลาดในระบบ")
            )
        except:
            pass
    
    def _generate_ai_response_with_buttons(self, message: str, project_id: str = None, user_id: str = None) -> tuple:
        """Generate AI response with optional Quick Reply buttons"""
        response = self._generate_ai_response(message, project_id, user_id)
        
        # If response is None (e.g. manual mode), return None
        if response is None:
            return None, None

        quick_reply_buttons = None
        
        message_lower = message.lower()

        # Add Quick Reply buttons based on response type
        if 'สถานะ' in message_lower or 'status' in message_lower:
            quick_reply_buttons = [
                QuickReplyButton(action=MessageAction(label='ค่าไฟ', text='ค่าไฟ')),
                QuickReplyButton(action=MessageAction(label='แจ้งเตือน', text='แจ้งเตือน')),
                QuickReplyButton(action=MessageAction(label='รายงาน', text='รายงาน')),
            ]
        elif 'ค่าไฟ' in message_lower or 'bill' in message_lower:
            quick_reply_buttons = [
                QuickReplyButton(action=MessageAction(label='สถานะ', text='สถานะ')),
                QuickReplyButton(action=MessageAction(label='รายงาน', text='รายงาน')),
                QuickReplyButton(action=MessageAction(label='ช่วย', text='ช่วย')),
            ]
        elif 'ช่วย' in message_lower or 'help' in message_lower:
            quick_reply_buttons = [
                QuickReplyButton(action=MessageAction(label='สถานะ', text='สถานะ')),
                QuickReplyButton(action=MessageAction(label='ค่าไฟ', text='ค่าไฟ')),
                QuickReplyButton(action=MessageAction(label='โปรเจค', text='โปรเจค')),
            ]
        
        return response, quick_reply_buttons
    
    def _generate_ai_response(self, message: str, project_id: str = None, user_id: str = None) -> str:
        """Generate AI response based on user message and project"""
        
        msg_lower = message.lower()

        # 1. Mode Switching
        if msg_lower in ['human', 'admin', 'manual']:
            if user_id:
                user_preferences.set_user_mode(user_id, 'manual')
            return "🔄 เข้าสู่โหมด Manual แล้ว แอดมินจะมาตอบกลับเร็วๆนี้ครับ (AI หยุดทำงาน)"
        
        if msg_lower in ['ai', 'auto', 'bot']:
            if user_id:
                user_preferences.set_user_mode(user_id, 'ai')
            return "🤖 เข้าสู่โหมด AI แล้ว ถามข้อมูลพลังงานได้เลยครับ"

        # 2. Check Mode (If Manual, ignore other commands except mode switch)
        if user_id:
            mode = user_preferences.get_user_mode(user_id)
            if mode == 'manual':
                return "🧑‍💼 ขณะนี้อยู่โหมด Manual\nพิมพ์ \"AI\" เพื่อกลับมาใช้บอทตอบอัตโนมัติ"

        # 3. Project Linking (Support both "Link <ID>" and "โปรเจค <ID>")
        if msg_lower.startswith('link ') or msg_lower.startswith('โปรเจค '):
            # Extract project name/ID
            parts = message.split(' ', 1)
            if len(parts) > 1:
                requested_project = parts[1].strip()
                
                # Validate project exists
                projects_dir = Path(__file__).parent.parent.parent.parent.parent / "projects"
                if (projects_dir / requested_project).exists():
                    # Save user preference
                    if user_id:
                        user_preferences.set_user_project(user_id, requested_project)
                    
                    return f"""✅ เชื่อมต่อโปรเจค {requested_project} เรียบร้อย
                    
📊 ตอนนี้คุณกำลังดูข้อมูลของโปรเจค: {requested_project}
🔔 การแจ้งเตือนทั้งหมดจะส่งไปยังโปรเจคนี้
พิมพ์ "สถานะ" เพื่อดูข้อมูลพลังงานของโปรเจคนี้"""
                else:
                    return f"""❌ ไม่พบโปรเจค {requested_project}
                    
โปรดตรวจสอบ Project ID ให้ถูกต้อง หรือพิมพ์ "โปรเจค" เพื่อดูรายการที่มี"""

        # 4. My ID Command
        if msg_lower == 'my id' or msg_lower == 'myid':
            return f"🆔 Your User ID: {user_id}"

        # 5. Energy-related AI responses
        if any(keyword in msg_lower for keyword in ['สถานะ', 'status', 'ข้อมูล', 'data']):
            return self._get_energy_status(project_id)
        elif any(keyword in msg_lower for keyword in ['ค่าไฟ', 'bill', 'บิล', 'ราคา']):
            return self._get_billing_info(project_id)
        elif any(keyword in msg_lower for keyword in ['แจ้งเตือน', 'alert', 'เตือน']):
            return self._get_alerts(project_id)
        elif any(keyword in msg_lower for keyword in ['รายงาน', 'report', 'สรุป']):
            return self._get_reports(project_id)
        elif any(keyword in msg_lower for keyword in ['ช่วย', 'help', 'วิธีใช้']):
            return self._get_help_message()
        elif any(keyword in msg_lower for keyword in ['โปรเจค', 'project', 'เปลี่ยนโปรเจค']):
            return self._show_project_selection()
        else:
            return self._get_default_ai_response(message, project_id)
    
    def _get_energy_status(self, project_id: str = None) -> str:
        """Get current energy status"""
        try:
            if not project_id:
                from services.backend.shared_state import get_active_project, READINGS
                project_id = get_active_project()
                if not project_id:
                    try:
                        project_id = next(iter(READINGS.keys()), None)
                    except Exception:
                        project_id = None
            
            if project_id:
                from services.backend.shared_state import READINGS, LAST_SEEN, PROJECTS_ROOT
                import os, json, time
                
                now_ts = time.time()
                total_power = 0.0
                online_count = 0
                total_count = 0
                
                # Expected devices from config (for denominator)
                cfg_path = os.path.join(PROJECTS_ROOT, project_id, 'ConfigDevice.json')
                expected_ids = set()
                if os.path.exists(cfg_path):
                    try:
                        with open(cfg_path, 'r', encoding='utf-8') as f:
                            cfg = json.load(f)
                        for conv in cfg.get('converters', []):
                            for dev in (conv.get('devices') or []):
                                did = dev.get('id')
                                if did is not None:
                                    expected_ids.add(str(did))
                    except Exception:
                        expected_ids = set()
                
                # Read from shared memory
                data = READINGS.get(project_id, {}) or {}
                if not isinstance(data, dict):
                    data = {}
                processed_ids = set()
                for did, rec in data.items():
                    did_str = str(did)
                    if not isinstance(rec, dict):
                        rec = {}
                    vals = rec.get('values') or {}
                    if not isinstance(vals, dict):
                        vals = {}
                    
                    power_total = None
                    try:
                        for pk in [
                            'ActivePower_Total','TotalActivePower','power_active',
                            'P_Total','TotalPower','active_power_total','power'
                        ]:
                            v = vals.get(pk)
                            if v is not None:
                                power_total = float(v)
                                break
                    except Exception:
                        power_total = None
                    if power_total is None:
                        p_sum = 0.0
                        count = 0
                        for pk in [
                            'ActivePower_L1','ActivePower_L2','ActivePower_L3',
                            'Power_A','Power_B','Power_C','P_L1','P_L2','P_L3'
                        ]:
                            v = vals.get(pk)
                            if v is not None:
                                try:
                                    p_sum += float(v)
                                    count += 1
                                except Exception:
                                    pass
                        if count > 0:
                            power_total = p_sum
                    if power_total is not None:
                        total_power += power_total
                    
                    # Online detection: prefer explicit flag; fallback to LAST_SEEN / timestamp
                    is_online = False
                    try:
                        if rec.get('online') is True:
                            is_online = True
                        elif rec.get('online') is False:
                            is_online = False
                        else:
                            last_seen = None
                            try:
                                last_seen = (LAST_SEEN.get(project_id, {}) or {}).get(did_str)
                            except Exception:
                                last_seen = None
                            if last_seen is None:
                                try:
                                    last_seen = (LAST_SEEN.get(project_id, {}) or {}).get(did)
                                except Exception:
                                    last_seen = None
                            if last_seen is not None:
                                is_online = (now_ts - float(last_seen)) <= 300
                            else:
                                ts_str = rec.get('timestamp')
                                if ts_str:
                                    try:
                                        from datetime import datetime
                                        dt = datetime.fromisoformat(ts_str.replace(' ', 'T'))
                                        is_online = (time.time() - dt.timestamp()) <= 300
                                    except Exception:
                                        is_online = False
                                if not is_online:
                                    for vk in [
                                        'Voltage_A','Voltage_B','Voltage_C',
                                        'Current_A','Current_B','Current_C'
                                    ]:
                                        vv = vals.get(vk)
                                        try:
                                            if vv is not None and float(vv) > 0:
                                                is_online = True
                                                break
                                        except Exception:
                                            pass
                    except Exception:
                        is_online = False
                    
                    if is_online:
                        online_count += 1
                    processed_ids.add(did_str)
                
                if expected_ids:
                    total_count = len(expected_ids)
                else:
                    total_count = len(processed_ids)
                
                return f"""⚡ สถานะพลังงานปัจจุบัน ({project_id})
                
🔌 กำลังไฟรวม: {total_power:,.2f} kW
📱 อุปกรณ์ออนไลน์: {online_count}/{total_count}
🕒 ข้อมูล ณ: {datetime.now().strftime('%H:%M:%S')}

พิมพ์ "รายงาน" เพื่อดูสรุปย้อนหลัง"""

            if not project_id:
                return "⚠️ ยังไม่มีโปรเจคที่เชื่อมต่ออยู่\n\nกรุณาพิมพ์ \"Link <ProjectID>\" เพื่อเชื่อมต่อกับระบบของคุณ\n(เช่น Link test-project)"

            return f"❌ ไม่พบข้อมูลพลังงานสำหรับโปรเจค '{project_id}' ในขณะนี้\nโปรดตรวจสอบว่าระบบกำลังรันอยู่และเชื่อมต่ออินเทอร์เน็ต"
        except Exception as e:
            logger.error(f"Error getting status: {e}")
            return f"❌ เกิดข้อผิดพลาดในระบบ: {str(e)}"

    def _get_billing_info(self, project_id: str = None) -> str:
        try:
            if not project_id:
                from services.backend.shared_state import get_active_project
                project_id = get_active_project()
            if not project_id:
                return "⚠️ กรุณาเลือกโปรเจคก่อน โดยพิมพ์ 'Link <ProjectID>'"
            from services.backend.api.billing.billing_service import BillingService
            svc = BillingService()
            s = svc.get_dashboard_summary(project_id) or {}
            tu = float(s.get("today_units") or 0)
            tm = float(s.get("today_money") or 0)
            mu = float(s.get("month_units") or 0)
            mm = float(s.get("month_money") or 0)
            cp = float(s.get("compare_percent") or 0)
            return (
                f"💡 สรุปค่าไฟ ({project_id})\n\n"
                f"วันนี้ใช้พลังงาน: {tu:,.2f} kWh\n"
                f"วันนี้ค่าใช้จ่าย: {tm:,.2f} ฿\n\n"
                f"รอบเดือนนี้ใช้: {mu:,.2f} kWh\n"
                f"รอบเดือนนี้ค่าใช้จ่าย: {mm:,.2f} ฿\n"
                f"เทียบเดือนก่อน: {cp:+.1f}%"
            )
        except Exception:
            return "⚠️ ไม่สามารถดึงข้อมูลค่าไฟได้ในขณะนี้"

    def _get_alerts(self, project_id: str = None) -> str:
        return "🔔 ยังไม่มีการแจ้งเตือนใหม่ในขณะนี้"

    def _get_reports(self, project_id: str = None) -> str:
        try:
            if not project_id:
                from services.backend.shared_state import get_active_project
                project_id = get_active_project()
            if not project_id:
                return "⚠️ กรุณาเชื่อมต่อโปรเจคก่อน โดยพิมพ์ 'Link <ProjectID>'"
            from services.backend.api.billing.billing_service import BillingService
            svc = BillingService()
            hist = svc.get_usage_history(project_id, days=7) or []
            if not hist:
                return "📊 ยังไม่มีข้อมูลย้อนหลัง 7 วัน"
            total_kwh = sum(float(d.get("total_energy") or 0) for d in hist)
            total_cost = sum(float(d.get("total_cost") or 0) for d in hist)
            lines = "\n".join([f"- {d['date']}: {float(d.get('total_energy') or 0):,.2f} kWh | {float(d.get('total_cost') or 0):,.2f} ฿" for d in hist[-7:]])
            return (
                f"📊 สรุปย้อนหลัง 7 วัน ({project_id})\n\n"
                f"รวมพลังงาน: {total_kwh:,.2f} kWh\n"
                f"รวมค่าใช้จ่าย: {total_cost:,.2f} ฿\n\n"
                f"{lines}"
            )
        except Exception:
            return "⚠️ ไม่สามารถดึงรายงานย้อนหลังได้"

    def _get_help_message(self) -> str:
        return """🤖 คำสั่งที่ใช้ได้:

1. สถานะ - ดูข้อมูลพลังงานปัจจุบัน
2. Link <ProjectID> - เชื่อมต่อกับโปรเจค
3. My ID - ดู User ID ของคุณ
4. Human - เปลี่ยนเป็นโหมด Manual (คุยกับคน)
5. AI - เปลี่ยนกลับเป็นโหมด AI"""

    def _show_project_selection(self) -> str:
        # List available projects (limit to 5)
        try:
            projects_dir = Path(__file__).parent.parent.parent.parent.parent / "projects"
            projects = [d.name for d in projects_dir.iterdir() if d.is_dir()]
            projects = projects[:10]
            
            if not projects:
                return "ไม่พบโปรเจคในระบบ"
                
            list_str = "\n".join([f"- {p}" for p in projects])
            return f"""📁 โปรเจคที่มีในระบบ:
{list_str}

พิมพ์ "Link <ชื่อโปรเจค>" เพื่อเลือก"""
        except:
            return "ไม่สามารถดึงรายชื่อโปรเจคได้"

    def _get_default_ai_response(self, message: str, project_id: str = None) -> str:
        # Fallback to OpenAI if configured
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
             return "🤖 ผมไม่เข้าใจคำสั่งครับ พิมพ์ 'ช่วย' เพื่อดูคำสั่งที่ใช้ได้ (AI Not Configured)"
        
        if not OpenAI:
             return "🤖 ผมไม่เข้าใจคำสั่งครับ (OpenAI library missing)"

        try:
            client = OpenAI(api_key=api_key)
            
            system_prompt = "You are a helpful assistant for EnergyLink. Answer in Thai. Be concise."
            if project_id:
                system_prompt += f" The user is asking about Project ID: {project_id}."
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI Error: {e}")
            return "🤖 ขออภัย ระบบ AI ขัดข้องชั่วคราว"

    def process_webhook(self, body: str, signature: str) -> bool:
        try:
            verifier = CustomWebhookHandler(self.config.channel_secret)
            if self.config.channel_secret and signature:
                verifier.verify_signature(body, signature)
            import json
            data = json.loads(body)
            events = data.get("events", [])
            ok = False
            for event in events:
                if event.get("type") == "message" and (event.get("message") or {}).get("type") == "text":
                    user_id = (event.get("source") or {}).get("userId")
                    reply_token = event.get("replyToken")
                    text = (event.get("message") or {}).get("text") or ""
                    user_project = self._get_user_project_preference(user_id)
                    response, quick_reply_buttons = self._generate_ai_response_with_buttons(text, user_project, user_id)
                    if response:
                        if quick_reply_buttons:
                            message = TextSendMessage(text=response, quick_reply=QuickReply(items=quick_reply_buttons))
                        else:
                            message = TextSendMessage(text=response)
                        try:
                            self.line_bot_api.reply_message(reply_token, message)
                            ok = True
                        except Exception:
                            pass
            return ok
        except Exception as e:
            logger.error(f"process_webhook error: {e}")
            return False
