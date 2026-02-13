import os
from .database import DatabaseManager
from typing import List, Dict

def query_history(project_id: str, device: str, key: str, start_ts: str, end_ts: str, sqlite_path: str, sqlite_enabled: bool, device_name: str = None) -> List[Dict]:
    """
    Query history from DatabaseManager (SQL).
    Ignores sqlite_path/sqlite_enabled legacy args as DatabaseManager handles location.
    """
    try:
        # We need projects_root. Assuming standard relative path if not provided
        # backend/api/history_api.py -> backend/../.. -> projects?
        # Better to rely on what DatabaseManager expects.
        # But wait, DatabaseManager needs projects_root.
        
        # Let's dynamically find projects root similar to other files
        import sys
        if getattr(sys, "frozen", False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

        projects_root = os.path.join(base_dir, 'projects')
        
        db = DatabaseManager(project_id, projects_root)
        rows = db.query_history(start_ts, end_ts, device_id=str(device), parameter=str(key))
        
        # Filter by key (parameter) - redundant if DB handles it but good for safety
        result = []
        for r in rows:
            if r['parameter'] == key:
                 result.append({'timestamp': r['timestamp'], 'value': r['value']})
        return result

    except Exception as e:
        print(f"History Query Error: {e}")
        return []
