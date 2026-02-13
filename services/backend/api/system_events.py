import sqlite3
import os
from datetime import datetime
from services.backend.api.billing.database import get_project_db_path

def init_system_events_table(project_id):
    """Ensure system_events table exists"""
    try:
        db_path = get_project_db_path(project_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[SystemEvents] Init error: {e}")

def log_system_event(project_id: str, event_type: str, details: str = ""):
    """
    Log a system event (e.g., 'startup', 'shutdown', 'config_change')
    """
    if not project_id:
        return

    try:
        init_system_events_table(project_id)
        db_path = get_project_db_path(project_id)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO system_events (event_type, details)
            VALUES (?, ?)
        """, (event_type, details))
        conn.commit()
        conn.close()
        print(f"[SystemEvent] {event_type} logged for {project_id}")
    except Exception as e:
        print(f"[SystemEvent] Log error: {e}")
