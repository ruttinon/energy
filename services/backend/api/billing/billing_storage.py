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
    
    # Table: payments (monthly invoices)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            month TEXT NOT NULL,
            scope TEXT NOT NULL,
            target_id TEXT NOT NULL,
            target_name TEXT,
            amount REAL DEFAULT 0,
            status TEXT DEFAULT 'due',
            due_date TEXT,
            paid_at TEXT,
            ref TEXT,
            UNIQUE(project_id, month, scope, target_id)
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


def upsert_payment(project_id: str, month: str, scope: str, target_id: str, target_name: str, amount: float, status: str, due_date: str, paid_at: Optional[str] = None, ref: Optional[str] = None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO payments (project_id, month, scope, target_id, target_name, amount, status, due_date, paid_at, ref)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, month, scope, target_id) DO UPDATE SET
                target_name = excluded.target_name,
                amount = excluded.amount,
                status = excluded.status,
                due_date = excluded.due_date,
                paid_at = excluded.paid_at,
                ref = excluded.ref
        """, (project_id, month, scope, target_id, target_name, float(amount or 0), status, due_date, paid_at, ref))
        conn.commit()
    except Exception as e:
        print(f"[BillingStorage] upsert_payment error: {e}")
    finally:
        conn.close()


def list_payments(project_id: str, month: Optional[str] = None) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        if month:
            cur.execute("SELECT * FROM payments WHERE project_id=? AND month=? ORDER BY scope, target_id", (project_id, month))
        else:
            cur.execute("SELECT * FROM payments WHERE project_id=? ORDER BY month DESC, scope, target_id", (project_id,))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[BillingStorage] list_payments error: {e}")
        return []
    finally:
        conn.close()


def list_overdue(project_id: str) -> List[Dict]:
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        cur.execute("""
            SELECT * FROM payments 
            WHERE project_id=? AND status!='paid' AND due_date < ?
            ORDER BY month DESC
        """, (project_id, today))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[BillingStorage] list_overdue error: {e}")
        return []
    finally:
        conn.close()


def mark_paid(project_id: str, month: str, scope: str, target_id: str, ref: Optional[str] = None):
    conn = get_db_connection()
    cur = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        cur.execute("""
            UPDATE payments 
            SET status='paid', paid_at=?, ref=COALESCE(?, ref)
            WHERE project_id=? AND month=? AND scope=? AND target_id=?
        """, (now, ref, project_id, month, scope, target_id))
        conn.commit()
    except Exception as e:
        print(f"[BillingStorage] mark_paid error: {e}")
    finally:
        conn.close()
