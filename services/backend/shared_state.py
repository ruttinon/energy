
# Shared state for the backend enabling access from different routers
# avoiding circular imports with fastapi_app.py

import threading
import os
import json

# Global dictionary to store realtime readings
# Structure: { project_id: { device_id: { timestamp, values: {key:val}, meta: {...} } } }
READINGS = {}

# Locks
READINGS_LOCK = threading.RLock()

# Other shared state
POLL_THREADS = {}
STOP_FLAGS = {}
PURGED_DATA = set()
COMMANDS = {}

# =============================
# ACTIVE PROJECT STORAGE
# =============================
ACTIVE_FILE = os.path.join(os.path.dirname(__file__), "active_project.json")

def load_active():
    if not os.path.exists(ACTIVE_FILE):
        return {"active": None}
    try:
        return json.loads(open(ACTIVE_FILE, "r", encoding="utf-8").read())
    except:
        return {"active": None}

def save_active(pid):
    json.dump({"active": pid},
              open(ACTIVE_FILE, "w", encoding="utf-8"),
              indent=2, ensure_ascii=False)
