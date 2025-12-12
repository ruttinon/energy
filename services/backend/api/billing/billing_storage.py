import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional

DB_PATH = os.path.join("services", "backend", "data", "billing.db")

def _init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Table: daily_billing
    # Stores daily aggregate usage for each device
    cur.execute("""
        CREATE TABLE IF NOT EXISTS daily_billing (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            date TEXT NOT NULL,  -- YYYY-MM-DD
            energy_used REAL DEFAULT 0,
            cost REAL DEFAULT 0,
            meter_start REAL DEFAULT 0,
            meter_end REAL DEFAULT 0,
            price_per_unit REAL DEFAULT 0,
            last_update TEXT,
            UNIQUE(project_id, device_id, date)
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize on module load
_init_db()

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def upsert_daily_usage(project_id: str, device_id: str, date: str, 
                      energy: float, cost: float, 
                      meter_start: float, meter_end: float, 
                      price: float):
    
    conn = get_db_connection()
    cur = conn.cursor()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        cur.execute("""
            INSERT INTO daily_billing (
                project_id, device_id, date, 
                energy_used, cost, 
                meter_start, meter_end, 
                price_per_unit, last_update
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, device_id, date) DO UPDATE SET
                energy_used = excluded.energy_used,
                cost = excluded.cost,
                meter_start = excluded.meter_start,
                meter_end = excluded.meter_end,
                price_per_unit = excluded.price_per_unit,
                last_update = excluded.last_update
        """, (project_id, device_id, date, energy, cost, meter_start, meter_end, price, timestamp))
        conn.commit()
    except Exception as e:
        print(f"[BillingStorage] Error upserting: {e}")
    finally:
        conn.close()

def get_daily_records(project_id: str, date: str) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    records = []
    try:
        cur.execute("""
            SELECT * FROM daily_billing 
            WHERE project_id = ? AND date = ?
        """, (project_id, date))
        rows = cur.fetchall()
        for row in rows:
            records.append(dict(row))
    finally:
        conn.close()
    return records

def get_monthly_records(project_id: str, month: str) -> List[Dict]:
    # month format: YYYY-MM
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    records = []
    try:
        cur.execute("""
            SELECT device_id, 
                   SUM(energy_used) as total_energy, 
                   SUM(cost) as total_cost,
                   MIN(meter_start) as meter_start_month,
                   MAX(meter_end) as meter_end_month
            FROM daily_billing 
            WHERE project_id = ? AND date LIKE ?
            GROUP BY device_id
        """, (project_id, f"{month}%"))
        rows = cur.fetchall()
        for row in rows:
            records.append(dict(row))
    finally:
        conn.close()
    return records

def get_yearly_records(project_id: str, year: str) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    records = []
    try:
        cur.execute("""
            SELECT strftime('%Y-%m', date) as month,
                   SUM(energy_used) as total_energy, 
                   SUM(cost) as total_cost
            FROM daily_billing 
            WHERE project_id = ? AND date LIKE ?
            GROUP BY month
            ORDER BY month ASC
        """, (project_id, f"{year}%"))
        rows = cur.fetchall()
        for row in rows:
            records.append(dict(row))
    finally:
        conn.close()
    return records

def get_daily_series(project_id: str, month: str) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    records = []
    try:
        cur.execute(
            """
            SELECT date as day_full,
                   SUM(energy_used) as total_energy,
                   SUM(cost) as total_cost
            FROM daily_billing
            WHERE project_id = ? AND date LIKE ?
            GROUP BY date
            ORDER BY date ASC
            """,
            (project_id, f"{month}%"),
        )
        rows = cur.fetchall()
        for row in rows:
            d = dict(row)
            try:
                day = d["day_full"].split("-")[-1]
            except Exception:
                day = d["day_full"]
            records.append({
                "day": day,
                "total_energy": d["total_energy"],
                "total_cost": d["total_cost"],
            })
    finally:
        conn.close()
    return records

def get_weekly_records(project_id: str, year: str) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    out = []
    try:
        cur.execute(
            """
            SELECT strftime('%W', date) as week,
                   device_id,
                   SUM(energy_used) as total_energy,
                   SUM(cost) as total_cost
            FROM daily_billing
            WHERE project_id = ? AND strftime('%Y', date) = ?
            GROUP BY week, device_id
            ORDER BY week ASC
            """,
            (project_id, year),
        )
        rows = cur.fetchall()
        for r in rows:
            out.append(dict(r))
    finally:
        conn.close()
    return out
