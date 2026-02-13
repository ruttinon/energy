import json
import os
import time
from typing import Dict, Optional, List
from .config import LINE_USERS_FILE, LINE_DATA_DIR
from .models import LineUser

# Ensure directory exists
os.makedirs(LINE_DATA_DIR, exist_ok=True)

def load_users() -> Dict[str, LineUser]:
    if not os.path.exists(LINE_USERS_FILE):
        return {}
    try:
        with open(LINE_USERS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return {uid: LineUser(**u) for uid, u in data.items()}
    except Exception:
        return {}

def save_users(users: Dict[str, LineUser]):
    try:
        data = {uid: u.dict() for uid, u in users.items()}
        with open(LINE_USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving LINE users: {e}")

def get_user(user_id: str) -> LineUser:
    users = load_users()
    if user_id not in users:
        # Create new user
        new_user = LineUser(user_id=user_id, mode="ai", last_interaction=time.time())
        users[user_id] = new_user
        save_users(users)
        return new_user
    return users[user_id]

def update_user(user: LineUser):
    users = load_users()
    users[user.user_id] = user
    save_users(users)

def get_all_users() -> List[LineUser]:
    return list(load_users().values())
