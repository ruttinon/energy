"""
Background task to monitor device online/offline status
This should run as a separate thread or scheduled task
"""

import time
import threading
from .alert_engine import check_offline_devices
import os
import json

# Check interval (seconds)
CHECK_INTERVAL = 30

# Path to active project file
# Try services/backend/active_project.json first
ACTIVE_PROJECT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "active_project.json"))

def get_active_project():
    """Get currently active project ID"""
    try:
        if os.path.exists(ACTIVE_PROJECT_PATH):
            with open(ACTIVE_PROJECT_PATH, 'r') as f:
                data = json.load(f)
                return data.get('active')
    except:
        pass
    return None

def monitor_loop():
    """Main monitoring loop"""
    print("[Offline Monitor] Starting...")
    
    while True:
        try:
            # Get active project
            project_id = get_active_project()
            
            if project_id:
                print(f"[Offline Monitor] Checking devices for project: {project_id}")
                check_offline_devices(project_id)
            else:
                print("[Offline Monitor] No active project, checking default")
                check_offline_devices(None)
                
        except Exception as e:
            print(f"[Offline Monitor] Error: {e}")
        
        # Wait before next check
        time.sleep(CHECK_INTERVAL)

def start_monitor():
    """Start monitor in background thread"""
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()
    print("[Offline Monitor] Background thread started")
    return monitor_thread

if __name__ == "__main__":
    # Run standalone
    print("[Offline Monitor] Running in standalone mode...")
    monitor_loop()