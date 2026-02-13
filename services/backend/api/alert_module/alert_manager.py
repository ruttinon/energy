# ============================================================
# ✅ ระบบจัดการการแจ้งเตือน (Alert System Manager)
# ============================================================

import sqlite3, os
from datetime import datetime
from services.backend.api.billing.database import get_project_db_path

# ------------------------------------------------------------
# 🧩 ฟังก์ชันสร้างตาราง alerts (ถ้ายังไม่มี)
# ------------------------------------------------------------
def init_alert_table(project_id):
    """สร้างตาราง alerts ใน Project DB ถ้ายังไม่มี"""
    db_path = get_project_db_path(project_id)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            alert_type TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

# ------------------------------------------------------------
# 🚨 ฟังก์ชันเพิ่มการแจ้งเตือนใหม่
# ------------------------------------------------------------
def add_alert(device_id, alert_type, message, project_id=None):
    """เพิ่มแจ้งเตือนใหม่เข้า DB ของ Project"""
    if not project_id:
        # Fallback requires active project ID, but for now log error or skip
        print(f"⚠️ Cannot save alert: No project_id provided for {device_id}")
        return

    try:
        init_alert_table(project_id) # Ensure table exists
        db_path = get_project_db_path(project_id)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # 🧠 ป้องกันการแจ้งเตือนซ้ำ (ถ้ายัง unresolved)
        cur.execute("""
            SELECT COUNT(*) FROM alerts 
            WHERE device_id=? AND alert_type=? AND resolved=0
        """, (str(device_id), alert_type))
        exists = cur.fetchone()[0]

        if exists:
            print(f"⚠️ ALERT ซ้ำ ถูกข้าม: {device_id} ({alert_type})")
            conn.close()
            return

        # ✅ เพิ่มแจ้งเตือนใหม่
        cur.execute("""
            INSERT INTO alerts (device_id, alert_type, message)
            VALUES (?, ?, ?)
        """, (str(device_id), alert_type, message))
        conn.commit()
        conn.close()

        print(f"🚨 ALERT Saved to DB [{project_id}]: {message}")

    except Exception as e:
        print(f"⚠️ add_alert error: {e}")


# ------------------------------------------------------------
# 📋 ฟังก์ชันอ่านแจ้งเตือนล่าสุด
# ------------------------------------------------------------
def get_alerts(project_id, limit=50):
    """อ่านแจ้งเตือนล่าสุดที่ยังไม่ถูกแก้ไข"""
    if not project_id: return []
    try:
        db_path = get_project_db_path(project_id)
        if not os.path.exists(db_path): return []
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        # Check if table exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts'")
        if not cur.fetchone():
             conn.close()
             return []

        cur.execute("""
            SELECT * FROM alerts
            WHERE resolved=0
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        print(f"Error getting alerts: {e}")
        return []


# ------------------------------------------------------------
# 🟢 ฟังก์ชันปิดสถานะแจ้งเตือน (Mark Resolved)
# ------------------------------------------------------------
def resolve_alert(project_id, alert_id):
    """ปิดสถานะการแจ้งเตือน (resolved=1)"""
    if not project_id: return
    try:
        db_path = get_project_db_path(project_id)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("UPDATE alerts SET resolved=1 WHERE id=?", (alert_id,))
        conn.commit()
        conn.close()
        print(f"✅ Resolved alert #{alert_id}")
    except Exception as e:
        print(f"Error resolving alert: {e}")


# ------------------------------------------------------------
# 🔍 ฟังก์ชันอ่านแจ้งเตือนทั้งหมด (รวม resolved)
# ------------------------------------------------------------
def get_all_alerts(limit=200):
    """อ่านแจ้งเตือนทั้งหมด"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM alerts
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ------------------------------------------------------------
# 🚀 เรียกตอน import เพื่อแน่ใจว่ามีตาราง
# ------------------------------------------------------------
# Removed init_alert_db call (Dynamic per project now)
