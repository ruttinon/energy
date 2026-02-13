"""
Database & Configuration Backup Service
ระบบสำรองข้อมูลอัตโนมัติของระบบ EnergyLink
"""

import os
import shutil
import sqlite3
import gzip
import json
from datetime import datetime, timedelta
from pathlib import Path
import logging

logger = logging.getLogger("BACKUP_SERVICE")

class BackupService:
    """แบบแผนการสำรองข้อมูลอัตโนมัติ"""
    
    def __init__(self, db_path: str, backup_dir: str = None, max_backups: int = 30):
        """
        Args:
            db_path: Path to main database
            backup_dir: Directory to store backups (default: ./backups)
            max_backups: Maximum number of backups to keep (default: 30 days)
        """
        self.db_path = db_path
        self.backup_dir = backup_dir or os.path.join(os.path.dirname(db_path), "backups")
        self.max_backups = max_backups
        
        # Create backup directory if not exists
        Path(self.backup_dir).mkdir(parents=True, exist_ok=True)
        logger.info(f"BackupService initialized: {self.backup_dir}")
    
    def create_full_backup(self) -> dict:
        """สร้างสำรองข้อมูลแบบเต็ม (Database + Config)"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"backup_full_{timestamp}.sqlite3.gz"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # Backup database with compression
            with open(self.db_path, 'rb') as f_in:
                with gzip.open(backup_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            file_size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
            logger.info(f"Full backup created: {backup_filename} ({file_size:.2f} MB)")
            
            return {
                "status": "success",
                "type": "full",
                "filename": backup_filename,
                "path": backup_path,
                "size_mb": file_size,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error(f"Failed to create full backup: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def create_incremental_backup(self) -> dict:
        """สร้างสำรองข้อมูลเพิ่มเติม (Incremental)"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"backup_incr_{timestamp}.sqlite3"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # Simple incremental - copy current state
            shutil.copy2(self.db_path, backup_path)
            
            file_size = os.path.getsize(backup_path) / (1024 * 1024)
            logger.info(f"Incremental backup created: {backup_filename} ({file_size:.2f} MB)")
            
            return {
                "status": "success",
                "type": "incremental",
                "filename": backup_filename,
                "path": backup_path,
                "size_mb": file_size,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error(f"Failed to create incremental backup: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def backup_configurations(self, config_paths: list) -> dict:
        """สำรองไฟล์ Config สำคัญ"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            config_filename = f"backup_config_{timestamp}.tar.gz"
            config_path = os.path.join(self.backup_dir, config_filename)
            
            # Create tar with gzip compression
            with tarfile.open(config_path, "w:gz") as tar:
                for cfg_path in config_paths:
                    if os.path.exists(cfg_path):
                        tar.add(cfg_path, arcname=os.path.basename(cfg_path))
            
            file_size = os.path.getsize(config_path) / (1024 * 1024)
            logger.info(f"Config backup created: {config_filename} ({file_size:.2f} MB)")
            
            return {
                "status": "success",
                "type": "config",
                "filename": config_filename,
                "path": config_path,
                "size_mb": file_size,
                "timestamp": timestamp,
                "files_backed": len(config_paths)
            }
        except Exception as e:
            logger.error(f"Failed to backup configurations: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def restore_backup(self, backup_filename: str) -> dict:
        """คืนค่าจากสำรองข้อมูล"""
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            if not os.path.exists(backup_path):
                return {"status": "error", "message": f"Backup not found: {backup_filename}"}
            
            # Create backup of current state before restore
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            current_backup = f"backup_before_restore_{timestamp}.sqlite3"
            shutil.copy2(self.db_path, os.path.join(self.backup_dir, current_backup))
            
            # Restore from backup
            if backup_filename.endswith('.gz'):
                with gzip.open(backup_path, 'rb') as f_in:
                    with open(self.db_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                shutil.copy2(backup_path, self.db_path)
            
            logger.info(f"Database restored from: {backup_filename}")
            
            return {
                "status": "success",
                "message": "Database restored successfully",
                "restored_from": backup_filename,
                "backup_created": current_backup
            }
        except Exception as e:
            logger.error(f"Failed to restore backup: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def cleanup_old_backups(self) -> dict:
        """ลบสำรองข้อมูลเก่าโดยอัตโนมัติ"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.max_backups)
            deleted_files = []
            
            for filename in os.listdir(self.backup_dir):
                filepath = os.path.join(self.backup_dir, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                
                if file_time < cutoff_date:
                    os.remove(filepath)
                    deleted_files.append(filename)
                    logger.info(f"Deleted old backup: {filename}")
            
            return {
                "status": "success",
                "deleted_count": len(deleted_files),
                "deleted_files": deleted_files,
                "cutoff_date": cutoff_date.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def list_backups(self) -> dict:
        """แสดงรายการสำรองข้อมูล"""
        try:
            backups = []
            for filename in sorted(os.listdir(self.backup_dir), reverse=True):
                filepath = os.path.join(self.backup_dir, filename)
                file_size = os.path.getsize(filepath) / (1024 * 1024)
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                
                backups.append({
                    "filename": filename,
                    "size_mb": f"{file_size:.2f}",
                    "created": file_time.isoformat(),
                    "type": "full" if "full" in filename else "config" if "config" in filename else "incremental"
                })
            
            return {
                "status": "success",
                "total_backups": len(backups),
                "backups": backups,
                "backup_dir": self.backup_dir
            }
        except Exception as e:
            logger.error(f"Failed to list backups: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def get_backup_stats(self) -> dict:
        """สถิติการใช้พื้นที่สำรองข้อมูล"""
        try:
            total_size = 0
            file_count = 0
            oldest_backup = None
            newest_backup = None
            
            for filename in os.listdir(self.backup_dir):
                filepath = os.path.join(self.backup_dir, filename)
                total_size += os.path.getsize(filepath)
                file_count += 1
                
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                if oldest_backup is None or file_time < oldest_backup:
                    oldest_backup = file_time
                if newest_backup is None or file_time > newest_backup:
                    newest_backup = file_time
            
            return {
                "status": "success",
                "total_files": file_count,
                "total_size_mb": f"{total_size / (1024 * 1024):.2f}",
                "total_size_gb": f"{total_size / (1024 * 1024 * 1024):.4f}",
                "oldest_backup": oldest_backup.isoformat() if oldest_backup else None,
                "newest_backup": newest_backup.isoformat() if newest_backup else None
            }
        except Exception as e:
            logger.error(f"Failed to get backup stats: {str(e)}")
            return {"status": "error", "message": str(e)}


# Scheduled backup manager
import threading
import time

class ScheduledBackupManager:
    """ตัวจัดการสำรองข้อมูลตามตารางเวลา"""
    
    def __init__(self, backup_service: BackupService, schedule_interval_hours: int = 6):
        self.backup_service = backup_service
        self.schedule_interval = schedule_interval_hours * 3600  # Convert to seconds
        self.is_running = False
        self.thread = None
    
    def start(self):
        """เริ่มต้นการสำรองข้อมูลอัตโนมัติ"""
        if self.is_running:
            logger.warning("Backup scheduler already running")
            return
        
        self.is_running = True
        self.thread = threading.Thread(target=self._backup_loop, daemon=True)
        self.thread.start()
        logger.info(f"Backup scheduler started (interval: {self.schedule_interval}s)")
    
    def stop(self):
        """หยุดการสำรองข้อมูลอัตโนมัติ"""
        self.is_running = False
        logger.info("Backup scheduler stopped")
    
    def _backup_loop(self):
        """Loop สำรองข้อมูลเป็นระยะ"""
        while self.is_running:
            try:
                logger.info("Running scheduled backup...")
                result = self.backup_service.create_full_backup()
                
                if result["status"] == "success":
                    # Cleanup old backups
                    self.backup_service.cleanup_old_backups()
                    logger.info("Scheduled backup completed successfully")
                else:
                    logger.error(f"Scheduled backup failed: {result.get('message')}")
                
                # Sleep for scheduled interval
                time.sleep(self.schedule_interval)
            except Exception as e:
                logger.error(f"Error in backup loop: {str(e)}")
                time.sleep(60)  # Try again after 1 minute
