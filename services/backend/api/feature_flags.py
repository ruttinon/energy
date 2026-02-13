"""
Feature Flags Management System
ระบบจัดการสวิตช์เปิด/ปิดฟีเจอร์
"""

import sqlite3
import logging
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

logger = logging.getLogger("FEATURE_FLAGS")

class FeatureScope(str, Enum):
    """ขอบเขตของฟีเจอร์"""
    GLOBAL = "global"              # ทั้งระบบ
    PROJECT = "project"             # ระดับ Project
    USER = "user"                   # ระดับ User
    GROUP = "group"                 # ระดับกลุ่ม

class FeatureCategory(str, Enum):
    """หมวดหมู่ของฟีเจอร์"""
    MONITORING = "monitoring"        # ตรวจสอบ
    REPORTING = "reporting"          # สร้างรายงาน
    TRENDING = "trending"            # วิเคราะห์แนวโน้ม
    CONTROL = "control"              # ควบคุม
    ALARMING = "alarming"            # แจ้งเตือน
    PHOTOVIEW = "photoview"          # PhotoView SCADA
    ADMIN = "admin"                  # Admin Dashboard
    BACKUP = "backup"                # Backup & Recovery
    SECURITY = "security"            # Security & RBAC

class FeatureFlagManager:
    """จัดการ Feature Flags"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.initialize_tables()
    
    def initialize_tables(self):
        """สร้างตารางสำหรับ Feature Flags"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Main features table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feature_flags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_key TEXT UNIQUE NOT NULL,
                feature_name TEXT NOT NULL,
                description TEXT,
                category TEXT DEFAULT 'general',
                enabled_by_default BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Feature flag overrides per scope
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feature_flag_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_key TEXT NOT NULL,
                scope TEXT NOT NULL,  -- 'global', 'project', 'user', 'group'
                scope_id TEXT NOT NULL,  -- project_id, user_id, group_id
                enabled BOOLEAN NOT NULL,
                reason TEXT,
                set_by_user TEXT,
                set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (feature_key) REFERENCES feature_flags(feature_key),
                UNIQUE(feature_key, scope, scope_id)
            )
        """)
        
        # Feature dependencies (for hierarchical features)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feature_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_feature TEXT NOT NULL,
                child_feature TEXT NOT NULL,
                FOREIGN KEY (parent_feature) REFERENCES feature_flags(feature_key),
                FOREIGN KEY (child_feature) REFERENCES feature_flags(feature_key),
                UNIQUE(parent_feature, child_feature)
            )
        """)
        
        # Feature usage audit log
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feature_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_key TEXT NOT NULL,
                user_id TEXT,
                project_id TEXT,
                action TEXT,  -- 'enabled', 'disabled', 'viewed'
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (feature_key) REFERENCES feature_flags(feature_key)
            )
        """)
        
        conn.commit()
        conn.close()
        
        logger.info("Feature flags tables initialized")
    
    def initialize_default_features(self):
        """สร้างฟีเจอร์เริ่มต้น"""
        default_features = [
            # Monitoring
            ("monitoring_devices", "Device Monitoring", "Monitor connected devices", FeatureCategory.MONITORING.value),
            ("monitoring_realtime", "Real-time Data", "Real-time data display", FeatureCategory.MONITORING.value),
            ("monitoring_history", "Historical Data", "Historical data viewing", FeatureCategory.MONITORING.value),
            
            # Reporting
            ("reporting_pdf", "PDF Reports", "Generate PDF reports", FeatureCategory.REPORTING.value),
            ("reporting_excel", "Excel Reports", "Generate Excel reports", FeatureCategory.REPORTING.value),
            ("reporting_schedule", "Scheduled Reports", "Automatic scheduled reports", FeatureCategory.REPORTING.value),
            ("reporting_email", "Email Reports", "Send reports via email", FeatureCategory.REPORTING.value),
            
            # Trending
            ("trending_charts", "Trend Charts", "Display trend analysis charts", FeatureCategory.TRENDING.value),
            ("trending_prediction", "Prediction", "Predict future trends", FeatureCategory.TRENDING.value),
            ("trending_comparison", "Comparison", "Compare multiple trends", FeatureCategory.TRENDING.value),
            
            # Control
            ("control_manual", "Manual Control", "Manual device control", FeatureCategory.CONTROL.value),
            ("control_automation", "Automation", "Automated control sequences", FeatureCategory.CONTROL.value),
            ("control_scheduling", "Scheduling", "Scheduled control actions", FeatureCategory.CONTROL.value),
            
            # Alarming
            ("alarming_email", "Email Alerts", "Email alarm notifications", FeatureCategory.ALARMING.value),
            ("alarming_line", "LINE Alerts", "LINE alarm notifications", FeatureCategory.ALARMING.value),
            ("alarming_custom", "Custom Rules", "Custom alarm rules", FeatureCategory.ALARMING.value),
            
            # PhotoView
            ("photoview_scada", "PhotoView SCADA", "SCADA with mimic diagram", FeatureCategory.PHOTOVIEW.value),
            ("photoview_interactive", "Interactive View", "Interactive device control", FeatureCategory.PHOTOVIEW.value),
            
            # Admin
            ("admin_users", "User Management", "Manage users", FeatureCategory.ADMIN.value),
            ("admin_devices", "Device Management", "Manage devices", FeatureCategory.ADMIN.value),
            ("admin_settings", "System Settings", "Modify system settings", FeatureCategory.ADMIN.value),
            ("admin_logs", "View Audit Logs", "View audit logs", FeatureCategory.ADMIN.value),
            
            # Backup
            ("backup_create", "Create Backup", "Create database backup", FeatureCategory.BACKUP.value),
            ("backup_restore", "Restore Backup", "Restore from backup", FeatureCategory.BACKUP.value),
            ("backup_schedule", "Scheduled Backup", "Automatic backups", FeatureCategory.BACKUP.value),
            
            # Security
            ("security_2fa", "Two-Factor Auth", "Two-factor authentication", FeatureCategory.SECURITY.value),
            ("security_apikey", "API Keys", "API key management", FeatureCategory.SECURITY.value),
            ("security_audit", "Audit Logging", "Detailed audit logging", FeatureCategory.SECURITY.value),
        ]
        
        for feature_key, feature_name, description, category in default_features:
            self.add_feature(feature_key, feature_name, description, category)
        
        logger.info(f"Initialized {len(default_features)} default features")
    
    def add_feature(self, feature_key: str, feature_name: str, description: str = "", category: str = "general"):
        """เพิ่มฟีเจอร์ใหม่"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR IGNORE INTO feature_flags 
                (feature_key, feature_name, description, category)
                VALUES (?, ?, ?, ?)
            """, (feature_key, feature_name, description, category))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Added feature: {feature_key}")
            return True
        except Exception as e:
            logger.error(f"Error adding feature: {str(e)}")
            return False
    
    def set_feature_enabled(self, 
                           feature_key: str, 
                           enabled: bool,
                           scope: FeatureScope = FeatureScope.GLOBAL,
                           scope_id: str = "default",
                           set_by_user: str = "system",
                           reason: str = ""):
        """ตั้งค่าเปิด/ปิดฟีเจอร์"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if override exists
            cursor.execute("""
                SELECT id FROM feature_flag_overrides 
                WHERE feature_key = ? AND scope = ? AND scope_id = ?
            """, (feature_key, scope.value, scope_id))
            
            if cursor.fetchone():
                # Update existing override
                cursor.execute("""
                    UPDATE feature_flag_overrides 
                    SET enabled = ?, reason = ?, set_by_user = ?, set_at = CURRENT_TIMESTAMP
                    WHERE feature_key = ? AND scope = ? AND scope_id = ?
                """, (enabled, reason, set_by_user, feature_key, scope.value, scope_id))
            else:
                # Create new override
                cursor.execute("""
                    INSERT INTO feature_flag_overrides 
                    (feature_key, scope, scope_id, enabled, reason, set_by_user)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (feature_key, scope.value, scope_id, enabled, reason, set_by_user))
            
            # Audit log
            cursor.execute("""
                INSERT INTO feature_audit_log 
                (feature_key, action)
                VALUES (?, ?)
            """, (feature_key, "enabled" if enabled else "disabled"))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Set {feature_key} to {enabled} for {scope.value}:{scope_id}")
            return True
        except Exception as e:
            logger.error(f"Error setting feature: {str(e)}")
            return False
    
    def is_feature_enabled(self, 
                          feature_key: str,
                          user_id: str = None,
                          project_id: str = None,
                          group_id: str = None) -> bool:
        """ตรวจสอบว่าฟีเจอร์เปิดใช้งานหรือไม่"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check for user-level override first (most specific)
            if user_id:
                cursor.execute("""
                    SELECT enabled FROM feature_flag_overrides 
                    WHERE feature_key = ? AND scope = ? AND scope_id = ?
                """, (feature_key, FeatureScope.USER.value, user_id))
                result = cursor.fetchone()
                if result:
                    conn.close()
                    return bool(result[0])
            
            # Check for project-level override
            if project_id:
                cursor.execute("""
                    SELECT enabled FROM feature_flag_overrides 
                    WHERE feature_key = ? AND scope = ? AND scope_id = ?
                """, (feature_key, FeatureScope.PROJECT.value, project_id))
                result = cursor.fetchone()
                if result:
                    conn.close()
                    return bool(result[0])
            
            # Check for group-level override
            if group_id:
                cursor.execute("""
                    SELECT enabled FROM feature_flag_overrides 
                    WHERE feature_key = ? AND scope = ? AND scope_id = ?
                """, (feature_key, FeatureScope.GROUP.value, group_id))
                result = cursor.fetchone()
                if result:
                    conn.close()
                    return bool(result[0])
            
            # Check for global override
            cursor.execute("""
                SELECT enabled FROM feature_flag_overrides 
                WHERE feature_key = ? AND scope = ? AND scope_id = ?
            """, (feature_key, FeatureScope.GLOBAL.value, "default"))
            result = cursor.fetchone()
            if result:
                conn.close()
                return bool(result[0])
            
            # Fall back to default
            cursor.execute("""
                SELECT enabled_by_default FROM feature_flags 
                WHERE feature_key = ?
            """, (feature_key,))
            result = cursor.fetchone()
            
            conn.close()
            
            return bool(result[0]) if result else False
        except Exception as e:
            logger.error(f"Error checking feature: {str(e)}")
            return False
    
    def get_all_features(self) -> List[Dict]:
        """ดึงฟีเจอร์ทั้งหมด"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, feature_key, feature_name, description, category, enabled_by_default, created_at
                FROM feature_flags
                ORDER BY category, feature_name
            """)
            
            features = []
            for row in cursor.fetchall():
                features.append({
                    "id": row[0],
                    "feature_key": row[1],
                    "feature_name": row[2],
                    "description": row[3],
                    "category": row[4],
                    "enabled_by_default": bool(row[5]),
                    "created_at": row[6]
                })
            
            conn.close()
            return features
        except Exception as e:
            logger.error(f"Error getting features: {str(e)}")
            return []
    
    def get_features_by_category(self, category: str) -> List[Dict]:
        """ดึงฟีเจอร์ตามหมวดหมู่"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, feature_key, feature_name, description, enabled_by_default
                FROM feature_flags
                WHERE category = ?
                ORDER BY feature_name
            """, (category,))
            
            features = []
            for row in cursor.fetchall():
                features.append({
                    "id": row[0],
                    "feature_key": row[1],
                    "feature_name": row[2],
                    "description": row[3],
                    "enabled_by_default": bool(row[4])
                })
            
            conn.close()
            return features
        except Exception as e:
            logger.error(f"Error getting features by category: {str(e)}")
            return []
    
    def get_feature_status(self, feature_key: str) -> Dict:
        """ดึงสถานะฟีเจอร์พร้อมข้อมูลทั้งหมด"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get feature info
            cursor.execute("""
                SELECT feature_name, description, category, enabled_by_default
                FROM feature_flags
                WHERE feature_key = ?
            """, (feature_key,))
            
            feature = cursor.fetchone()
            if not feature:
                conn.close()
                return {"status": "not_found"}
            
            # Get overrides
            cursor.execute("""
                SELECT scope, scope_id, enabled, reason, set_at
                FROM feature_flag_overrides
                WHERE feature_key = ?
                ORDER BY set_at DESC
            """, (feature_key,))
            
            overrides = []
            for row in cursor.fetchall():
                overrides.append({
                    "scope": row[0],
                    "scope_id": row[1],
                    "enabled": bool(row[2]),
                    "reason": row[3],
                    "set_at": row[4]
                })
            
            conn.close()
            
            return {
                "status": "found",
                "feature_key": feature_key,
                "feature_name": feature[0],
                "description": feature[1],
                "category": feature[2],
                "enabled_by_default": bool(feature[3]),
                "overrides": overrides
            }
        except Exception as e:
            logger.error(f"Error getting feature status: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def add_feature_dependency(self, parent_feature: str, child_feature: str):
        """เพิ่มความสัมพันธ์ระหว่างฟีเจอร์ (parent-child)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR IGNORE INTO feature_dependencies 
                (parent_feature, child_feature)
                VALUES (?, ?)
            """, (parent_feature, child_feature))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Added dependency: {parent_feature} -> {child_feature}")
            return True
        except Exception as e:
            logger.error(f"Error adding dependency: {str(e)}")
            return False
    
    def get_feature_tree(self) -> Dict:
        """ดึงโครงสร้างฟีเจอร์แบบ Hierarchical Tree"""
        try:
            features = self.get_all_features()
            categories = {}
            
            for feature in features:
                category = feature.get("category", "general")
                if category not in categories:
                    categories[category] = {
                        "category": category,
                        "features": []
                    }
                
                categories[category]["features"].append(feature)
            
            return {
                "status": "success",
                "total_features": len(features),
                "categories": list(categories.values())
            }
        except Exception as e:
            logger.error(f"Error getting feature tree: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def get_project_features(self, project_id: str) -> Dict:
        """ดึงฟีเจอร์สำหรับ Project เฉพาะ"""
        try:
            features = self.get_all_features()
            project_features = {}
            
            for feature in features:
                category = feature.get("category", "general")
                if category not in project_features:
                    project_features[category] = {
                        "category": category,
                        "features": []
                    }
                
                # Check if enabled for this project
                enabled = self.is_feature_enabled(
                    feature["feature_key"],
                    project_id=project_id
                )
                
                project_features[category]["features"].append({
                    **feature,
                    "enabled_for_project": enabled
                })
            
            return {
                "status": "success",
                "project_id": project_id,
                "categories": list(project_features.values())
            }
        except Exception as e:
            logger.error(f"Error getting project features: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def get_user_features(self, user_id: str) -> Dict:
        """ดึงฟีเจอร์สำหรับ User เฉพาะ"""
        try:
            features = self.get_all_features()
            user_features = {}
            
            for feature in features:
                category = feature.get("category", "general")
                if category not in user_features:
                    user_features[category] = {
                        "category": category,
                        "features": []
                    }
                
                # Check if enabled for this user
                enabled = self.is_feature_enabled(
                    feature["feature_key"],
                    user_id=user_id
                )
                
                user_features[category]["features"].append({
                    **feature,
                    "enabled_for_user": enabled
                })
            
            return {
                "status": "success",
                "user_id": user_id,
                "categories": list(user_features.values())
            }
        except Exception as e:
            logger.error(f"Error getting user features: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def toggle_category(self, category: str, enabled: bool, scope: str = "global", scope_id: str = "default"):
        """เปิด/ปิดทั้งหมดในหมวดหมู่"""
        try:
            features = self.get_features_by_category(category)
            count = 0
            
            for feature in features:
                if self.set_feature_enabled(
                    feature["feature_key"],
                    enabled,
                    FeatureScope(scope),
                    scope_id,
                    "system",
                    f"Category toggle: {category}"
                ):
                    count += 1
            
            logger.info(f"Toggled {count} features in category {category}")
            return {"status": "success", "toggled_count": count}
        except Exception as e:
            logger.error(f"Error toggling category: {str(e)}")
            return {"status": "error", "message": str(e)}


# Initialize on import
_manager = None

def get_feature_manager(db_path: str = "data/energylink.db") -> FeatureFlagManager:
    """ดึง Feature Flag Manager singleton instance"""
    global _manager
    if _manager is None:
        _manager = FeatureFlagManager(db_path)
    return _manager
