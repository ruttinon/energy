import os
import sqlite3
import json
import glob
from datetime import datetime

# Configuration
PROJECT_ROOT = r"c:\Users\promb\Desktop\energylink\projects"
ACTIVE_PROJECT = "CPRAM-639ec8" # Based on recent context

print("="*60)
print(f"🚀 ENERGYLINK SYSTEM AUDIT | {datetime.now()}")
print(f"🎯 Target Project: {ACTIVE_PROJECT}")
print("="*60)

def check_db(project_id):
    db_path = os.path.join(PROJECT_ROOT, project_id, "data", "billing.db")
    print(f"\n1️⃣  DATABASE CHECK ({db_path})")
    
    if not os.path.exists(db_path):
        print(f"   ❌ Database NOT found!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check Tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"   ✅ Connection OK. Tables found: {tables}")
        
        expected_tables = ['daily_usage', 'alerts', 'control_audit', 'system_events', 'invoices', 'billing_config']
        missing = [t for t in expected_tables if t not in tables]
        if missing:
            print(f"   ⚠️  MISSING TABLES: {missing} (Might be created on first use)")
        else:
            print("   ✅ All Core Tables Present")

        # Check Data Counts
        for table in tables:
            try:
                count = cursor.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                print(f"      - {table}: {count} records")
            except:
                pass
                
        # Check Recent System Events
        if 'system_events' in tables:
            print("\n   🔍 Recent System Events:")
            events = cursor.execute("SELECT event_type, details, timestamp FROM system_events ORDER BY id DESC LIMIT 3").fetchall()
            for e in events:
                print(f"      [{e[2]}] {e[0]}: {e[1]}")

        # Check Active Alerts
        if 'alerts' in tables:
             print("\n   🔍 Active Alerts:")
             alerts = cursor.execute("SELECT device_id, message FROM alerts WHERE resolved=0").fetchall()
             if alerts:
                 for a in alerts:
                     print(f"      🔴 {a[0]}: {a[1]}")
             else:
                 print("      ✅ No active alerts")

        conn.close()
    except Exception as e:
        print(f"   ❌ Error inspecting DB: {e}")

def check_files(project_id):
    print(f"\n2️⃣  FILE STRUCTURE CHECK")
    p_path = os.path.join(PROJECT_ROOT, project_id)
    
    # Check Config
    cfg = os.path.join(p_path, "ConfigDevice.json")
    if os.path.exists(cfg):
        print(f"   ✅ ConfigDevice.json found")
    else:
        print(f"   ❌ ConfigDevice.json MISSING")

    # Check Data Folder
    data_path = os.path.join(p_path, "data")
    if os.path.exists(data_path):
        files = glob.glob(os.path.join(data_path, "*"))
        print(f"   📂 Data files: {[os.path.basename(f) for f in files]}")
    else:
        print(f"   ❌ Data folder missing!")

def check_backend_logs():
    print(f"\n3️⃣  BACKEND LOG CHECK")
    # This is rough, checking if we can find recent errors
    log_path = r"c:\Users\promb\Desktop\energylink\services\backend\data\billing_debug.log"
    if os.path.exists(log_path):
        print(f"   📄 billing_debug.log found. size: {os.path.getsize(log_path)} bytes")
    # Check for general backend errors? (Usually in terminal, but maybe we have a file)

def main():
    if os.path.exists(os.path.join(PROJECT_ROOT, ACTIVE_PROJECT)):
        check_db(ACTIVE_PROJECT)
        check_files(ACTIVE_PROJECT)
        check_backend_logs()
    else:
        print(f"❌ Project {ACTIVE_PROJECT} does not exist!")

if __name__ == "__main__":
    main()
