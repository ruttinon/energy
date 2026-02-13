import sqlite3
import os
from services.backend.api.billing.database import get_project_db_path, get_project_engine, Base
# Import models to register them with Base
import services.backend.api.billing.models 
from services.backend.api.alert_module.alert_manager import init_alert_table
from services.backend.api.system_events import init_system_events_table

# Manually init control audit since it's in a class method
def init_control_audit(project_id):
    try:
        db_path = get_project_db_path(project_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS control_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            control_mode TEXT,
            control_target TEXT,
            action TEXT,
            reason TEXT,
            operator TEXT,
            status TEXT,
            error_message TEXT,
            executed_at TEXT
        )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ProjectInit] Control Audit Init Error: {e}")

def init_project_db(project_id: str):
    """
    Initialize ALL tables for the project database.
    Ensures 'green' status on system audit.
    """
    if not project_id:
        return
    
    print(f"[ProjectInit] Initializing Database for Project: {project_id}")
    
    try:
        # 1. Billing & Core Models (SQLAlchemy)
        engine = get_project_engine(project_id)
        Base.metadata.create_all(bind=engine)
        print("  ✅ Billing/Core Tables")
        
        # 2. Alerts (Raw SQL)
        init_alert_table(project_id)
        print("  ✅ Alert Tables")
        
        # 3. System Events (Raw SQL)
        init_system_events_table(project_id)
        print("  ✅ System Event Tables")
        
        # 4. Control Audit (Raw SQL)
        init_control_audit(project_id)
        print("  ✅ Control Audit Tables")
        
    except Exception as e:
        print(f"❌ Project Init Failed: {e}")
