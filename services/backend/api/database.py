import sqlite3
import os
import time
import json
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
from services.backend.api.org_db import get_session_factory, init_org_db, RealtimeState, HistoricalLog

# Use a thread-local storage for connections if needed, 
# but for SQLite in WAL mode, we can genericize.
# For simplicity in this poller (which is threaded), 
# we will open a new connection per operation or use a pooled approach.
# Given the low concurrency of the poller (1s interval per device), 
# opening/closing is fine if WAL is enabled, or we can keep one conn per thread.

class DatabaseManager:
    def __init__(self, project_id: str, projects_root: str):
        self.project_id = project_id
        self.projects_root = projects_root
        self.state_db_path = os.path.join(self.projects_root, self.project_id, "data", "energy_state.db")
        os.makedirs(os.path.dirname(self.state_db_path), exist_ok=True)
        self._org_session_factory = get_session_factory()
        if self._org_session_factory:
            init_org_db()
        self._init_state_db()

    def _get_conn(self, db_path: str):
        conn = sqlite3.connect(f"file:{db_path}?mode=rwc", uri=True, timeout=10.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_state_db(self):
        try:
            conn = self._get_conn(self.state_db_path)
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS realtime_state (
                    device_id TEXT,
                    device_name TEXT,
                    parameter TEXT,
                    value REAL,
                    unit TEXT,
                    last_updated TIMESTAMP,
                    PRIMARY KEY (device_id, parameter)
                )
            """)
            conn.commit()
            conn.close()
            print(f"[DB] Initialized state {self.state_db_path} (WAL Mode)")
        except Exception as e:
            print(f"[DB] Init State Error: {e}")

    def _hist_db_path_for_ts(self, dt: datetime) -> str:
        year_dir = os.path.join(self.projects_root, self.project_id, "data", dt.strftime("%Y"))
        os.makedirs(year_dir, exist_ok=True)
        return os.path.join(year_dir, f"{dt.strftime('%Y_%m')}.db")

    def _init_hist_db(self, db_path: str):
        try:
            conn = self._get_conn(db_path)
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS historical_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME,
                    device_id TEXT,
                    device_name TEXT,
                    parameter TEXT,
                    value REAL,
                    unit TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_hist_ts ON historical_logs(timestamp);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_hist_dev ON historical_logs(device_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_hist_param ON historical_logs(parameter);")
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[DB] Init Hist Error: {e}")

    def update_realtime(self, reading_list: List[Dict]):
        """
        Update current values.
        reading_list: [{'device_id':..., 'device_name':..., 'parameter':..., 'value':..., 'unit':...}]
        """
        if not reading_list:
            return
        if self._org_session_factory:
            session = self._org_session_factory()
            try:
                now_dt = datetime.now()
                for r in reading_list:
                    try:
                        val = float(r['value'])
                    except:
                        continue
                    obj = session.query(RealtimeState).filter_by(device_id=r['device_id'], parameter=r['parameter']).one_or_none()
                    if obj:
                        obj.device_name = r.get('device_name', '')
                        obj.value = val
                        obj.unit = r.get('unit', '')
                        obj.last_updated = now_dt
                    else:
                        obj = RealtimeState(
                            device_id=r['device_id'],
                            parameter=r['parameter'],
                            device_name=r.get('device_name', ''),
                            value=val,
                            unit=r.get('unit', ''),
                            last_updated=now_dt
                        )
                        session.add(obj)
                session.commit()
            except Exception as e:
                try:
                    session.rollback()
                except:
                    pass
                print(f"[DB] Realtime Update Error: {e}")
            finally:
                session.close()
            return

        conn = self._get_conn(self.state_db_path)
        try:
            now = datetime.now().isoformat()
            data = []
            for r in reading_list:
                # Ensure value is float (or null)
                try:
                    val = float(r['value'])
                except:
                    continue # Skip non-numeric
                    
                data.append((
                    r['device_id'], 
                    r.get('device_name', ''), 
                    r['parameter'], 
                    val, 
                    r.get('unit', ''), 
                    now
                ))
            
            # Using INSERT OR REPLACE to update
            conn.executemany("""
                INSERT OR REPLACE INTO realtime_state 
                (device_id, device_name, parameter, value, unit, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            """, data)
            
            conn.commit()
        except Exception as e:
            print(f"[DB] Realtime Update Error: {e}")
        finally:
            conn.close()

    def log_historical(self, reading_list: List[Dict]):
        """
        Append to historical logs.
        """
        if not reading_list:
            return
        if self._org_session_factory:
            session = self._org_session_factory()
            try:
                now_dt = datetime.now()
                objs = []
                for r in reading_list:
                    try:
                        val = float(r['value'])
                    except:
                        continue
                    objs.append(HistoricalLog(
                        timestamp=now_dt,
                        device_id=r['device_id'],
                        device_name=r.get('device_name', ''),
                        parameter=r['parameter'],
                        value=val,
                        unit=r.get('unit', '')
                    ))
                if objs:
                    session.add_all(objs)
                    session.commit()
                    print(f"[DB] Logged {len(objs)} rows to historical.")
            except Exception as e:
                try:
                    session.rollback()
                except:
                    pass
                print(f"[DB] Historical Log Error: {e}")
            finally:
                session.close()
            return

        now_dt = datetime.now()
        hist_path = self._hist_db_path_for_ts(now_dt)
        self._init_hist_db(hist_path)
        conn = self._get_conn(hist_path)
        try:
            now = now_dt
            # Round to nearest minute or 10m? User said "Insert every 10m".
            # The caller controls WHEN this is called. We just timestamp it with 'now'.
            ts_str = now.strftime('%Y-%m-%d %H:%M:%S')
            
            data = []
            for r in reading_list:
                try:
                    val = float(r['value'])
                except:
                    continue
                
                data.append((
                    ts_str,
                    r['device_id'], 
                    r.get('device_name', ''), 
                    r['parameter'], 
                    val, 
                    r.get('unit', '')
                ))

            conn.executemany("""
                INSERT INTO historical_logs
                (timestamp, device_id, device_name, parameter, value, unit)
                VALUES (?, ?, ?, ?, ?, ?)
            """, data)
            
            conn.commit()
            print(f"[DB] Logged {len(data)} rows to historical.")
        except Exception as e:
            print(f"[DB] Historical Log Error: {e}")
        finally:
            conn.close()

    def get_realtime_view(self):
        """Fetch all current states for API"""
        conn = self._get_conn(self.state_db_path)
        try:
            cur = conn.execute("SELECT * FROM realtime_state")
            rows = [dict(row) for row in cur.fetchall()]
            return rows
        finally:
            conn.close()

    def query_history(self, start_ts: str, end_ts: str, device_id: Optional[str] = None, parameter: Optional[str] = None):
        """Query historical data"""
        try:
            from datetime import datetime as _dt
            s = _dt.strptime(start_ts, '%Y-%m-%d %H:%M:%S')
            e = _dt.strptime(end_ts, '%Y-%m-%d %H:%M:%S')
            months = []
            cur_dt = _dt(s.year, s.month, 1)
            while cur_dt <= _dt(e.year, e.month, 1):
                months.append(cur_dt)
                if cur_dt.month == 12:
                    cur_dt = _dt(cur_dt.year + 1, 1, 1)
                else:
                    cur_dt = _dt(cur_dt.year, cur_dt.month + 1, 1)
            result = []
            for m in months:
                dbp = self._hist_db_path_for_ts(m)
                if not os.path.exists(dbp):
                    continue
                conn = self._get_conn(dbp)
                try:
                    sql = "SELECT * FROM historical_logs WHERE timestamp BETWEEN ? AND ?"
                    params = [start_ts, end_ts]
                    if device_id:
                        sql += " AND device_id = ?"
                        params.append(device_id)
                    if parameter:
                        sql += " AND parameter = ?"
                        params.append(parameter)
                    sql += " ORDER BY timestamp ASC"
                    cur = conn.execute(sql, params)
                    result.extend([dict(row) for row in cur.fetchall()])
                finally:
                    conn.close()
            return result
        except Exception as e:
            print(f"[DB] Query History Error: {e}")
            return []
