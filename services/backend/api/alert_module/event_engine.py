import json
import os
from datetime import datetime

THIS_FILE = os.path.abspath(__file__)
THIS_DIR = os.path.dirname(THIS_FILE)
PROJECT_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

EVENT_LOG_PATH = os.path.join(DATA_DIR, "logs", "event_logs.json")
os.makedirs(os.path.dirname(EVENT_LOG_PATH), exist_ok=True)


def log_event(event, event_type="system", details="", user=None, device=None):
    """Smart event logging — merge repeated events instead of spamming."""
    
    record_key = f"{event}|{event_type}|{details}|{device}|{user}"

    # Load old logs
    logs = []
    if os.path.exists(EVENT_LOG_PATH):
        try:
            with open(EVENT_LOG_PATH, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except:
            logs = []

    # Try to find if same event already exists
    found = None
    for ev in logs:
        key = f"{ev['event']}|{ev['type']}|{ev['details']}|{ev.get('device')}|{ev.get('user')}"
        if key == record_key:
            found = ev
            break

    # If event already exists → increase count only
    if found:
        found["count"] = found.get("count", 1) + 1
        found["time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # update time
    else:
        # Add new event
        new_ev = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "event": event,
            "type": event_type,
            "details": details,
            "user": user,
            "device": device,
            "count": 1
        }
        logs.append(new_ev)

    # Save file
    with open(EVENT_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
