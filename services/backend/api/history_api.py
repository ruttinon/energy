import os
import sqlite3
from datetime import datetime
from typing import List, Dict
from .xlsx_storage import read_history_from_excel

def query_history(project_id: str, device: str, key: str, start_ts: str, end_ts: str, sqlite_path: str, sqlite_enabled: bool, device_name: str = None) -> List[Dict]:
    hist = []
    if sqlite_enabled and sqlite_path and os.path.exists(sqlite_path):
        try:
            conn = sqlite3.connect(sqlite_path)
            cur = conn.cursor()
            cur.execute('SELECT timestamp, value FROM readings WHERE project_id=? AND device_id=? AND parameter=? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC', (project_id, str(device), str(key), start_ts, end_ts))
            for ts, val in cur.fetchall():
                hist.append({"timestamp": ts, "value": val})
            conn.close()
        except Exception:
            pass
    if not hist:
        try:
            hist = read_history_from_excel(project_id, str(device), str(key), start_ts, end_ts, device_name=device_name)
        except Exception:
            hist = []
    return hist
