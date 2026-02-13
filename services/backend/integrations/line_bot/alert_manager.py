"""
Alert Manager for LINE Bot - Send alerts to users based on their project preferences
"""
import logging
from .user_preferences import user_preferences
from .line_service import LineBotService
from linebot.models import TextSendMessage

logger = logging.getLogger(__name__)

class AlertManager:
    """Manage alerts for LINE Bot users"""
    
    def __init__(self, line_service: LineBotService):
        self.line_service = line_service
    
    def send_alert_to_project_users(self, project_id: str, alert_message: str):
        """Send alert to all users who have selected this project"""
        try:
            # Get all users who have selected this project
            users = user_preferences.get_all_users_for_project(project_id)
            
            if not users:
                logger.info(f"No users found for project {project_id}")
                return
            
            # Send alert to each user
            for user_id in users:
                try:
                    # Determine icon and title based on content
                    is_recovery = "back online" in alert_message.lower() or "normal" in alert_message.lower() or "recovery" in alert_message.lower()
                    
                    if is_recovery:
                        title = f"✅ สถานะปกติ [{project_id}]"
                    else:
                        title = f"🚨 แจ้งเตือน [{project_id}]"

                    self.line_service.line_bot_api.push_message(
                        user_id,
                        TextSendMessage(text=f"{title}\n\n{alert_message}")
                    )
                    logger.info(f"Alert sent to user {user_id} for project {project_id}")
                except Exception as e:
                    logger.error(f"Failed to send alert to user {user_id}: {e}")
            
            logger.info(f"Alert sent to {len(users)} users for project {project_id}")
            
        except Exception as e:
            logger.error(f"Error sending project alert: {e}")
    
    def send_alert_to_all_users(self, alert_message: str):
        """Send alert to all users"""
        try:
            # Get all users
            all_users = list(user_preferences.preferences.keys())
            
            for user_id in all_users:
                try:
                    self.line_service.line_bot_api.push_message(
                        user_id,
                        TextSendMessage(text=f"📢 ประกาศทั้วหมด\n\n{alert_message}")
                    )
                except Exception as e:
                    logger.error(f"Failed to send broadcast alert to user {user_id}: {e}")
            
            logger.info(f"Broadcast alert sent to {len(all_users)} users")
            
        except Exception as e:
            logger.error(f"Error sending broadcast alert: {e}")
