import os
import sys
import sqlite3
import threading
import queue
import time
import json
import logging
import uuid
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Any, Optional

from services.backend.api.database import DatabaseManager
import os
import sys
# Setup Logging
logging.basicConfig(level=logging.INFO, format='[PERSISTENCE] %(message)s')
logger = logging.getLogger("PERSISTENCE")

# Determine ROOT (same logic as other files)
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

PROJECTS_ROOT = os.path.join(ROOT, 'projects')

# --- SCHEMAS ---

SQL_INIT_SCRIPT = """
CREATE TABLE IF NOT EXISTS readings (
    timestamp DATETIME,
    device_id TEXT,
    device_name TEXT,
    parameter TEXT,
    value REAL,
    unit TEXT,
    PRIMARY KEY (timestamp, device_id, parameter)
);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings (timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_dev ON readings (device_id);

CREATE TABLE IF NOT EXISTS billing_log (
    date TEXT,
    device_id TEXT,
    energy_used REAL,
    cost REAL,
    currency TEXT DEFAULT 'THB',
    PRIMARY KEY (date, device_id)
);
"""

# --- WORKER CLASS ---

class PersistenceEngine:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PersistenceEngine, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, 'queue'): return
        self.queue = queue.Queue()
        self.running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True, name="PersistenceWorker")
        self._excel_lock = threading.RLock()
        self.start()
    
    def start(self):
        if not self.thread.is_alive():
            self.thread.start()
            logger.info("Engine Started")

    def stop(self):
        self.running = False
        self.thread.join()

    def push_reading(self, project_id: str, device_id: str, device_name: str, 
                    values: Dict[str, Any], meta: Dict[str, Dict] = None, timestamp: datetime = None):
        """
        Push a reading set to the queue.
        values: {'voltage': 220.5, 'current': 10.1}
        meta: {'voltage': {'unit': 'V'}, ...}
        """
        if not timestamp:
            timestamp = datetime.now()
            
        item = {
            'type': 'reading',
            'project_id': project_id,
            'timestamp': timestamp,
            'device_id': str(device_id),
            'device_name': device_name,
            'values': values,
            'meta': meta or {}
        }
        self.queue.put(item)
    
    def _worker_loop(self):
        while self.running:
            batch = []
            try:
                # Block briefly for the first item
                item = self.queue.get(timeout=1.0)
                batch.append(item)
                
                # Drain queue to batch up to 500 items
                count = 0
                while count < 500:
                    try:
                        batch.append(self.queue.get_nowait())
                        count += 1
                    except queue.Empty:
                        break
            except queue.Empty:
                continue
            
            if batch:
                self._process_batch(batch)

    def _process_batch(self, batch: List[Dict]):
        # Group by project
        by_project = defaultdict(list)
        for item in batch:
            by_project[item['project_id']].append(item)
            
        for pid, items in by_project.items():
            try:
                # 1. SQL Write
                self._write_sql(pid, items)
                # 2. Excel Write
                self._write_excel(pid, items)
            except Exception as e:
                logger.error(f"Batch failed for {pid}: {e}")

    # --- SQL HANDLER ---
    
    def _get_db_path(self, project_id):
        # projects/PID/data/project_data.db
        d = os.path.join(PROJECTS_ROOT, project_id, 'data')
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, 'project_data.db')

    def _init_sql(self, db_path):
        conn = sqlite3.connect(db_path)
        try:
            conn.executescript(SQL_INIT_SCRIPT)
            conn.commit()
        finally:
            conn.close()

    def _write_sql(self, project_id, items):
        try:
            if getattr(sys, 'frozen', False):
                base_dir = os.path.dirname(sys.executable)
            else:
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
            projects_root = os.path.join(base_dir, 'projects')
            db = DatabaseManager(project_id, projects_root)
            reading_list = []
            for item in items:
                if item['type'] != 'reading':
                    continue
                did = item['device_id']
                dname = item['device_name']
                for key, val in (item['values'] or {}).items():
                    unit = (item['meta'] or {}).get(key, {}).get('unit', '')
                    try:
                        fval = float(val)
                    except:
                        continue
                    reading_list.append({
                        'device_id': did,
                        'device_name': dname,
                        'parameter': key,
                        'value': fval,
                        'unit': unit
                    })
            if reading_list:
                db.update_realtime(reading_list)
        except Exception as e:
            logger.error(f"SQL Write Error {project_id}: {e}")

    # --- EXCEL HANDLER ---

    def _write_excel(self, project_id, items):
        return

    def _append_to_excel(self, filepath, items):
        # Deprecated in favor of inline logic in _write_excel using shared lock
        pass

# Global Instance
engine = PersistenceEngine()
