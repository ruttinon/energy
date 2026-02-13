import os

# Email Configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "energylinksacada@gmail.com"
# Password should be set in environment variable or updated here (App Password)
SENDER_PASSWORD = os.getenv("EMAIL_PASSWORD", "1234") 

# Default Recipients
ADMIN_EMAIL = "energylinksacada@gmail.com"
TEST_RECIPIENT = "promprtn@gmail.com"
