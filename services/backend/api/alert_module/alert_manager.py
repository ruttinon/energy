# ============================================================
# ✅ ระบบจัดการการแจ้งเตือน (Alert System Manager)
# ============================================================

import sqlite3, os
from datetime import datetime

# ------------------------------------------------------------
# 📦 Path ของฐานข้อมูล (ใช้ฐานเดียวกับ readings)
# ------------------------------------------------------------
DB_PATH = os.path.join("modbus_data", "modbus_log.db")


# ------------------------------------------------------------
# 🧩 ฟังก์ชันสร้างตาราง alerts (ถ้ายังไม่มี)
# ------------------------------------------------------------
def init_alert_db():

    """สร้างตาราง alerts ถ้ายังไม่มี"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
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
    print("✅ Alert table ready.")


# ------------------------------------------------------------
# 🚨 ฟังก์ชันเพิ่มการแจ้งเตือนใหม่
# ------------------------------------------------------------
def add_alert(device_id, alert_type, message):
    """เพิ่มแจ้งเตือนใหม่เข้า DB"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        # 🧠 ป้องกันการแจ้งเตือนซ้ำ (ถ้ายัง unresolved)
        cur.execute("""
            SELECT COUNT(*) FROM alerts 
            WHERE device_id=? AND alert_type=? AND resolved=0
        """, (device_id, alert_type))
        exists = cur.fetchone()[0]

        if exists:
            print(f"⚠️ ALERT ซ้ำ ถูกข้าม: {device_id} ({alert_type})")
            conn.close()
            return

        # ✅ เพิ่มแจ้งเตือนใหม่
        cur.execute("""
            INSERT INTO alerts (device_id, alert_type, message)
            VALUES (?, ?, ?)
        """, (device_id, alert_type, message))
        conn.commit()
        conn.close()

        print(f"🚨 ALERT [{alert_type}] {device_id}: {message}")

    except Exception as e:
        print(f"⚠️ add_alert error: {e}")


# ------------------------------------------------------------
# 📋 ฟังก์ชันอ่านแจ้งเตือนล่าสุด
# ------------------------------------------------------------
def get_alerts(limit=50):
    """อ่านแจ้งเตือนล่าสุดที่ยังไม่ถูกแก้ไข"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM alerts
        WHERE resolved=0
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ------------------------------------------------------------
# 🟢 ฟังก์ชันปิดสถานะแจ้งเตือน (Mark Resolved)
# ------------------------------------------------------------
def resolve_alert(alert_id):
    """ปิดสถานะการแจ้งเตือน (resolved=1)"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE alerts SET resolved=1 WHERE id=?", (alert_id,))
    conn.commit()
    conn.close()
    print(f"✅ Resolved alert #{alert_id}")


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
init_alert_db()
