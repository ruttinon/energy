from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, TextSendMessage
from .config import LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET

line_bot_api = LineBotApi(LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(LINE_CHANNEL_SECRET)

def reply_message(reply_token: str, text: str):
    try:
        line_bot_api.reply_message(reply_token, TextSendMessage(text=text))
    except Exception as e:
        print(f"Error replying to LINE: {e}")

def push_message(user_id: str, text: str):
    try:
        line_bot_api.push_message(user_id, TextSendMessage(text=text))
    except Exception as e:
        print(f"Error pushing to LINE: {e}")
