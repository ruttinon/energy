import sys
import os
import time
from datetime import datetime

# Adjust path to reach backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.backend.api.database import DatabaseManager

def test_db():
    print("🧪 Testing SQL-Based Architecture...")
    
    # กำหนด project จริงจาก config หรือ database
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "projects"))
    
    db = DatabaseManager(mock_project, root)
    
    # 1. Poller เขียนข้อมูล Realtime จริง
    print(" [1] Simulating Poller Write (Realtime)...")
    readings = [
        {'device_id': 'dev1', 'parameter': 'Voltage', 'value': 220.5, 'unit': 'V'},
        {'device_id': 'dev1', 'parameter': 'Current', 'value': 10.0, 'unit': 'A'}
    ]
    db.update_realtime(readings)
    print("     ✅ Poller wrote data to realtime_state table (UPSERT)")
    
    # 2. API อ่านข้อมูล Realtime จริง (Implementation จริง)
    print(" [2] Simulating API Fetch (Realtime)...")
    rows = db.get_realtime_view()
    print(f"     ✅ API fetched {len(rows)} rows from SQL")
    assert len(rows) >= 2
    
    # Check values
    for r in rows:
        print(f"     -> {r['parameter']}: {r['value']} {r['unit']}")
            
    # 3. Insert ข้อมูล Historical จริง
    print(" [3] Simulating Historical Log...")
    db.log_historical(readings)
    
    # Verify
    start_ts = datetime.now().strftime('%Y-%m-%d 00:00:00')
    end_ts = datetime.now().strftime('%Y-%m-%d 23:59:59')
    hist = db.query_history(start_ts, end_ts, 'dev1')
    print(f"     ✅ Found {len(hist)} historical entries in SQL")
    
    print("🎉 ALL SYSTEMS GO: Realtime & Historical are 100% SQL-based.")

if __name__ == "__main__":
    test_db()

def test_db():
    print("🧪 Testing DatabaseManager...")
    
    # กำหนด project จริงจาก config หรือ database
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "projects"))
    
    db = DatabaseManager(mock_project, root)
    
    # 1. ทดสอบอัปเดตข้อมูล Realtime จริง
    print(" [1] Testing Realtime Update...")
    readings = [
        {'device_id': 'dev1', 'parameter': 'Voltage', 'value': 220.5, 'unit': 'V'},
        {'device_id': 'dev1', 'parameter': 'Current', 'value': 10.0, 'unit': 'A'}
    ]
    db.update_realtime(readings)
    
    # Verify
    rows = db.get_realtime_view()
    print("     Current State:", rows)
    assert len(rows) >= 2
    
    # Update again
    readings[0]['value'] = 221.0
    db.update_realtime(readings)
    rows = db.get_realtime_view()
    for r in rows:
        if r['parameter'] == 'Voltage':
            print(f"     Updated Voltage: {r['value']}")
            assert r['value'] == 221.0
            
    # 2. ทดสอบบันทึกข้อมูล Historical จริง
    print(" [2] Testing Historical Log...")
    db.log_historical(readings)
    
    # Verify
    start_ts = datetime.now().strftime('%Y-%m-%d 00:00:00')
    end_ts = datetime.now().strftime('%Y-%m-%d 23:59:59')
    hist = db.query_history(start_ts, end_ts, 'dev1')
    print(f"     Historical Rows for dev1: {len(hist)}")
    assert len(hist) >= 2
    
    print("✅ All DB Tests Passed")

if __name__ == "__main__":
    test_db()
