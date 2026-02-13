import smtplib
from typing import Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from .config import SMTP_SERVER, SMTP_PORT, SENDER_EMAIL, SENDER_PASSWORD, TEST_RECIPIENT

def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send an email using the configured SMTP server.
    Returns True if successful, False otherwise.
    """
    if not SENDER_PASSWORD:
        print("⚠️ Email password not set. Skipping email.")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        # Connect to server
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls() # Secure the connection
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        
        # Send email
        text = msg.as_string()
        server.sendmail(SENDER_EMAIL, to_email, text)
        
        server.quit()
        print(f"✅ Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

def send_alert_email(alert_message: str, device_name: str, value: Any, timestamp: str):
    """
    Helper to send alert emails to the test recipient (and potentially admin).
    """
    subject = f"🚨 EnergyLink Alert: {device_name}"
    body = f"""
    EnergyLink System Alert
    
    Device: {device_name}
    Message: {alert_message}
    Value: {value}
    Time: {timestamp}
    
    This is an automated message.
    """
    
    # Send to Test Recipient as requested
    send_email(TEST_RECIPIENT, subject, body)
