"""
Background task to monitor device online/offline status
This should run as a separate thread or scheduled task
"""

import time
import threading
import os
import json
from .alert_engine import check_offline_devices, check_alerts
from services.backend.shared_state import READINGS

# Check interval (seconds)
CHECK_INTERVAL = 5

# Path to active project file
# Try services/backend/active_project.json first
ACTIVE_PROJECT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "active_project.json"))

def get_active_project():
    """Get currently active project ID"""
    try:
        from services.backend.shared_state import load_active
        d = load_active()
        return d.get('active')
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
                # 1. Check Offline Status
                # print(f"[Offline Monitor] Checking devices for project: {project_id}")
                check_offline_devices(project_id)
                
                # 2. Check Alert Rules (Rule Engine)
                try:
                    readings = READINGS.get(project_id, {})
                    if readings:
                        for device_id, data in readings.items():
                            values = data.get('values', {})
                            if values:
                                check_alerts(values, device_id, project_id, dry_run=False)
                except Exception as e:
                    print(f"[Monitor] Rule checking error: {e}")
                    
            else:
                # print("[Offline Monitor] No active project, checking default")
                pass
                
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
