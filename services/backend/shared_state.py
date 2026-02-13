
# Shared state for the backend enabling access from different routers
# avoiding circular imports with fastapi_app.py

import threading
import os
import json
import sys

# Global dictionary to store realtime readings
# Structure: { project_id: { device_id: { timestamp, values: {key:val}, meta: {...} } } }
READINGS = {}
# Structure: { project_id: { device_id: last_valid_timestamp } }
LAST_SEEN = {}

# Locks
READINGS_LOCK = threading.RLock()

# Other shared state
POLL_THREADS = {}
STOP_FLAGS = {}
PURGED_DATA = set()
COMMANDS = {}

if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECTS_ROOT = os.path.join(ROOT, "projects")

# Centralize active project file INSIDE the backend package folder to avoid
# conflicting root copies. This makes behaviour deterministic in packaged EXE
# and development environments.
ACTIVE_FILE = os.path.join(os.path.dirname(__file__), "active_project.json")

def load_active():
    # Prefer backend-local active file
    backend_file = ACTIVE_FILE
    root_file = os.path.join(ROOT, "active_project.json")

    if os.path.exists(backend_file):
        try:
            return json.loads(open(backend_file, "r", encoding="utf-8").read())
        except Exception:
            print("[shared_state] Warning: failed reading backend active file")

    # Backwards compatibility: if a root-level file exists, migrate it into backend
    if os.path.exists(root_file):
        try:
            d = json.loads(open(root_file, "r", encoding="utf-8").read())
            pid = d.get("active")
            if pid:
                try:
                    save_active_project(pid)
                    print(f"[shared_state] Migrated active project from root to backend: {pid}")
                except Exception:
                    print("[shared_state] Failed to persist migrated active project")
                return {"active": pid}
        except Exception:
            pass

    # Fallback: pick the first available project and persist it
    try:
        for name in os.listdir(PROJECTS_ROOT):
            full = os.path.join(PROJECTS_ROOT, name)
            if os.path.isdir(full):
                save_active_project(name)
                return {"active": name}
    except Exception:
        pass
    return {"active": None}

def get_device_data(project_id: str) -> dict:
    """Get all device data for a project from shared state"""
    with READINGS_LOCK:
        return READINGS.get(project_id, {})

def get_active_project() -> str:
    """Get active project ID"""
    data = load_active()
    return data.get("active")

def save_active(project_id: str):
    """Save active project ID - Legacy function for backwards compatibility"""
    save_active_project(project_id)

def save_active_project(project_id: str):
    """Persist active project ID to disk"""
    try:
        data = {"active": project_id}
        with open(ACTIVE_FILE, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, indent=2))
        return True
    except Exception as e:
        print(f"[shared_state] Error saving active project: {e}")
        return False
