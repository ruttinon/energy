"""
User Activity Logging and Audit Trail System
============================================

Tracks all user actions for compliance and debugging:
- Login/Logout events
- Device control actions
- Configuration changes
- User management operations
- Error events
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

class AuditLogger:
    """Centralized audit trail logging system"""
    
    def __init__(self, projects_root: str):
        self.projects_root = projects_root
    
    def _audit_db_path(self, project_id: str) -> str:
        """Get path to audit database for project"""
        project_path = os.path.join(self.projects_root, project_id)
        data_path = os.path.join(project_path, 'data')
        os.makedirs(data_path, exist_ok=True)
        return os.path.join(data_path, 'audit.db')
    
    def _init_audit_table(self, project_id: str):
        """Initialize audit table if not exists"""
        db_path = self._audit_db_path(project_id)
        
        with sqlite3.connect(db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    username TEXT,
                    action TEXT NOT NULL,
                    resource_type TEXT,
                    resource_id TEXT,
                    resource_name TEXT,
                    status TEXT,
                    details TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_username (username),
                    INDEX idx_event_type (event_type)
                )
            ''')
            conn.commit()
    
    def log_event(self, project_id: str, event_type: str, username: Optional[str],
                  action: str, resource_type: Optional[str] = None,
                  resource_id: Optional[str] = None, resource_name: Optional[str] = None,
                  status: str = 'success', details: Optional[Dict] = None,
                  ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        """Log a single audit event"""
        
        self._init_audit_table(project_id)
        db_path = self._audit_db_path(project_id)
        
        timestamp = datetime.now().isoformat()
        details_json = json.dumps(details or {}) if details else None
        
        with sqlite3.connect(db_path) as conn:
            conn.execute('''
                INSERT INTO audit_log 
                (timestamp, event_type, username, action, resource_type, resource_id, 
                 resource_name, status, details, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                timestamp, event_type, username, action, resource_type,
                resource_id, resource_name, status, details_json,
                ip_address, user_agent
            ))
            conn.commit()
    
    def get_activity_log(self, project_id: str, username: Optional[str] = None,
                        event_type: Optional[str] = None, days: int = 30,
                        limit: int = 1000) -> List[Dict[str, Any]]:
        """Retrieve filtered activity logs"""
        
        db_path = self._audit_db_path(project_id)
        
        if not os.path.exists(db_path):
            return []
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        query = '''
            SELECT id, timestamp, event_type, username, action, resource_type,
                   resource_id, resource_name, status, details
            FROM audit_log
            WHERE timestamp >= ?
        '''
        params = [cutoff_date]
        
        if username:
            query += ' AND username = ?'
            params.append(username)
        
        if event_type:
            query += ' AND event_type = ?'
            params.append(event_type)
        
        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            
            logs = []
            for row in cursor.fetchall():
                log_entry = dict(row)
                try:
                    log_entry['details'] = json.loads(log_entry['details']) if log_entry['details'] else {}
                except:
                    log_entry['details'] = {}
                logs.append(log_entry)
            
            return logs
    
    def get_user_activity(self, project_id: str, username: str, days: int = 30) -> Dict[str, Any]:
        """Get summary of user activity"""
        
        logs = self.get_activity_log(project_id, username=username, days=days, limit=10000)
        
        if not logs:
            return {
                "username": username,
                "total_actions": 0,
                "last_activity": None,
                "events": {}
            }
        
        # Count events by type
        events = {}
        for log in logs:
            event_type = log['event_type']
            events[event_type] = events.get(event_type, 0) + 1
        
        return {
            "username": username,
            "total_actions": len(logs),
            "last_activity": logs[0]['timestamp'] if logs else None,
            "events": events
        }
    
    def get_device_activity(self, project_id: str, device_id: str, days: int = 30) -> List[Dict]:
        """Get all actions performed on a device"""
        
        db_path = self._audit_db_path(project_id)
        
        if not os.path.exists(db_path):
            return []
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT timestamp, username, action, status, details
                FROM audit_log
                WHERE resource_type = 'device'
                AND resource_id = ?
                AND timestamp >= ?
                ORDER BY timestamp DESC
                LIMIT 500
            ''', (str(device_id), cutoff_date))
            
            logs = []
            for row in cursor.fetchall():
                log_entry = dict(row)
                try:
                    log_entry['details'] = json.loads(log_entry['details']) if log_entry['details'] else {}
                except:
                    log_entry['details'] = {}
                logs.append(log_entry)
            
            return logs
    
    def cleanup_old_logs(self, project_id: str, days: int = 90):
        """Remove logs older than specified days (for maintenance)"""
        
        db_path = self._audit_db_path(project_id)
        
        if not os.path.exists(db_path):
            return 0
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(
                'DELETE FROM audit_log WHERE timestamp < ?',
                (cutoff_date,)
            )
            conn.commit()
            return cursor.rowcount


# Global audit logger instance
audit_logger = None

def init_audit_logger(projects_root: str):
    """Initialize global audit logger"""
    global audit_logger
    audit_logger = AuditLogger(projects_root)
    return audit_logger

def get_audit_logger() -> AuditLogger:
    """Get global audit logger instance"""
    global audit_logger
    if audit_logger is None:
        raise RuntimeError("Audit logger not initialized. Call init_audit_logger() first.")
    return audit_logger


# Helper functions for common events
def log_login(project_id: str, username: str, success: bool = True, ip_address: str = None):
    """Log user login event"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='LOGIN',
        username=username,
        action='user_login',
        status='success' if success else 'failure',
        ip_address=ip_address
    )

def log_logout(project_id: str, username: str, ip_address: str = None):
    """Log user logout event"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='LOGOUT',
        username=username,
        action='user_logout',
        ip_address=ip_address
    )

def log_device_control(project_id: str, username: str, device_id: str, device_name: str,
                      action: str, status: str = 'success', details: Dict = None,
                      ip_address: str = None):
    """Log device control action (trip, close, etc)"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='DEVICE_CONTROL',
        username=username,
        action=action,
        resource_type='device',
        resource_id=str(device_id),
        resource_name=device_name,
        status=status,
        details=details,
        ip_address=ip_address
    )

def log_config_change(project_id: str, username: str, resource_type: str,
                     resource_id: str, resource_name: str, action: str,
                     old_value: Any = None, new_value: Any = None,
                     status: str = 'success', ip_address: str = None):
    """Log configuration change"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='CONFIG_CHANGE',
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        resource_name=resource_name,
        status=status,
        details={'old_value': old_value, 'new_value': new_value},
        ip_address=ip_address
    )

def log_user_management(project_id: str, admin_username: str, action: str,
                       target_username: str, status: str = 'success',
                       details: Dict = None, ip_address: str = None):
    """Log user management operations (create, edit, delete, role change)"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='USER_MANAGEMENT',
        username=admin_username,
        action=action,
        resource_type='user',
        resource_id=target_username,
        resource_name=target_username,
        status=status,
        details=details,
        ip_address=ip_address
    )

def log_error(project_id: str, username: Optional[str], action: str,
             error_message: str, resource_type: str = None,
             resource_id: str = None, ip_address: str = None):
    """Log error event for debugging"""
    logger = get_audit_logger()
    logger.log_event(
        project_id=project_id,
        event_type='ERROR',
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        status='failure',
        details={'error_message': error_message},
        ip_address=ip_address
    )
