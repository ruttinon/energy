"""
Database Maintenance & Optimization Tools
ระบบบำรุงรักษาและปรับปรุงประสิทธิภาพฐานข้อมูล
"""

import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import json

logger = logging.getLogger("DB_MAINTENANCE")

class DatabaseMaintenance:
    """บำรุงรักษาฐานข้อมูล SQLite"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def vacuum_database(self) -> Dict:
        """ทำความสะอาดฐานข้อมูล (Remove fragmentation)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get size before
            initial_size = Path(self.db_path).stat().st_size
            
            # Run VACUUM
            cursor.execute("VACUUM")
            conn.commit()
            
            # Get size after
            final_size = Path(self.db_path).stat().st_size
            
            conn.close()
            
            reduction_mb = (initial_size - final_size) / (1024 * 1024)
            
            logger.info(f"Database vacuumed. Reduced by {reduction_mb:.2f} MB")
            
            return {
                "status": "success",
                "initial_size_mb": round(initial_size / (1024 * 1024), 2),
                "final_size_mb": round(final_size / (1024 * 1024), 2),
                "space_freed_mb": round(reduction_mb, 2)
            }
        except Exception as e:
            logger.error(f"Vacuum error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def analyze_database(self) -> Dict:
        """วิเคราะห์ฐานข้อมูล (Gather statistics for optimization)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Run ANALYZE
            cursor.execute("ANALYZE")
            conn.commit()
            
            logger.info("Database analyzed")
            
            return {
                "status": "success",
                "message": "Database statistics analyzed. Query planner will use this for optimization."
            }
        except Exception as e:
            logger.error(f"Analyze error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def optimize_indexes(self) -> Dict:
        """สร้างและปรับปรุง Indexes"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            optimizations = []
            
            # For each table, create indexes on commonly queried columns
            for table in tables:
                # Get columns
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [row[1] for row in cursor.fetchall()]
                
                # Create indexes on common query columns
                for col in columns:
                    if any(keyword in col.lower() for keyword in ['id', 'device', 'timestamp', 'status']):
                        index_name = f"idx_{table}_{col}"
                        try:
                            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({col})")
                            optimizations.append(f"Created index on {table}.{col}")
                        except sqlite3.Error:
                            pass
            
            conn.commit()
            conn.close()
            
            logger.info(f"Created {len(optimizations)} indexes")
            
            return {
                "status": "success",
                "indexes_created": len(optimizations),
                "optimizations": optimizations
            }
        except Exception as e:
            logger.error(f"Index optimization error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def check_integrity(self) -> Dict:
        """ตรวจสอบความสมบูรณ์ของฐานข้อมูล"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Run PRAGMA integrity_check
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()[0]
            
            is_ok = result == "ok"
            
            conn.close()
            
            logger.info(f"Integrity check: {result}")
            
            return {
                "status": "success",
                "integrity": result,
                "is_healthy": is_ok
            }
        except Exception as e:
            logger.error(f"Integrity check error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def get_database_stats(self) -> Dict:
        """ดึงสถิติฐานข้อมูล"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get table information
            cursor.execute("""
                SELECT name, type 
                FROM sqlite_master 
                WHERE type IN ('table', 'index') 
                ORDER BY name
            """)
            objects = cursor.fetchall()
            
            tables = [obj[0] for obj in objects if obj[1] == 'table']
            
            stats = {
                "file_size_mb": round(Path(self.db_path).stat().st_size / (1024 * 1024), 2),
                "tables": [],
                "total_rows": 0
            }
            
            # Get stats for each table
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                row_count = cursor.fetchone()[0]
                
                # Get table size
                cursor.execute(f"SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
                table_size = cursor.fetchone()
                table_size_mb = table_size[0] / (1024 * 1024) if table_size else 0
                
                stats["tables"].append({
                    "name": table,
                    "rows": row_count,
                    "size_mb": round(table_size_mb, 2)
                })
                
                stats["total_rows"] += row_count
            
            conn.close()
            
            return {
                "status": "success",
                "statistics": stats
            }
        except Exception as e:
            logger.error(f"Stats error: {str(e)}")
            return {"status": "error", "message": str(e)}


class DataArchival:
    """บำรุงรักษาข้อมูลเก่า (Archive old data)"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def archive_old_records(self, table_name: str, days_old: int = 90) -> Dict:
        """เก็บบันทึกเก่า (Archive records older than specified days)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Calculate cutoff date
            cutoff_date = (datetime.now() - timedelta(days=days_old)).isoformat()
            
            # Find timestamp column
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            
            timestamp_col = None
            for col in columns:
                if 'timestamp' in col.lower() or 'created' in col.lower() or 'date' in col.lower():
                    timestamp_col = col
                    break
            
            if not timestamp_col:
                return {"status": "error", "message": "No timestamp column found"}
            
            # Count records to archive
            cursor.execute(f"""
                SELECT COUNT(*) FROM {table_name} 
                WHERE {timestamp_col} < ?
            """, (cutoff_date,))
            
            count = cursor.fetchone()[0]
            
            # Archive to separate table
            archive_table = f"{table_name}_archive_{days_old}d"
            
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {archive_table} AS
                SELECT * FROM {table_name}
                WHERE {timestamp_col} < ?
            """, (cutoff_date,))
            
            # Delete from main table
            cursor.execute(f"""
                DELETE FROM {table_name}
                WHERE {timestamp_col} < ?
            """, (cutoff_date,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Archived {count} records from {table_name}")
            
            return {
                "status": "success",
                "records_archived": count,
                "archive_table": archive_table,
                "cutoff_date": cutoff_date
            }
        except Exception as e:
            logger.error(f"Archive error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def cleanup_old_archives(self, days_retention: int = 365) -> Dict:
        """ลบเก็บถาวรเก่า (Delete old archives)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Find archive tables
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name LIKE '%_archive_%'
            """)
            
            archive_tables = [row[0] for row in cursor.fetchall()]
            
            deleted_count = 0
            
            for table in archive_tables:
                # Check if archive is older than retention period
                # Extract days from table name (e.g., "table_archive_90d")
                parts = table.split('_archive_')
                if len(parts) == 2:
                    try:
                        days_str = parts[1].replace('d', '')
                        archive_days = int(days_str)
                        
                        if archive_days > days_retention:
                            cursor.execute(f"DROP TABLE {table}")
                            deleted_count += 1
                            logger.info(f"Dropped archive table {table}")
                    except ValueError:
                        pass
            
            conn.commit()
            conn.close()
            
            return {
                "status": "success",
                "tables_deleted": deleted_count,
                "retention_days": days_retention
            }
        except Exception as e:
            logger.error(f"Cleanup error: {str(e)}")
            return {"status": "error", "message": str(e)}


class QueryOptimizer:
    """ปรับปรุง Query optimization"""
    
    @staticmethod
    def analyze_query_plan(db_path: str, query: str) -> Dict:
        """วิเคราะห์ Query execution plan"""
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get EXPLAIN QUERY PLAN
            cursor.execute(f"EXPLAIN QUERY PLAN {query}")
            plan = cursor.fetchall()
            
            conn.close()
            
            return {
                "status": "success",
                "query": query,
                "plan": [p[3] for p in plan]  # Get the detail column
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    @staticmethod
    def get_slow_queries_recommendations(db_path: str) -> List[str]:
        """ข้อแนะนำสำหรับ Slow queries"""
        recommendations = []
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check for tables without indexes
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            
            tables = [row[0] for row in cursor.fetchall()]
            
            for table in tables:
                # Get indexes for table
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?", (table,))
                indexes = cursor.fetchall()
                
                if not indexes:
                    recommendations.append(f"Table '{table}' has no indexes. Consider creating indexes on frequently queried columns.")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error analyzing slow queries: {str(e)}")
        
        if not recommendations:
            recommendations.append("Database indexes look good. Monitor performance metrics.")
        
        return recommendations


class MaintenanceScheduler:
    """ตัวตั้งเวลา Maintenance (Maintenance scheduler)"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.maintenance = DatabaseMaintenance(db_path)
    
    def run_full_maintenance(self) -> Dict:
        """รัน Full maintenance"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "operations": []
        }
        
        # 1. Integrity check
        integrity = self.maintenance.check_integrity()
        results["operations"].append({"name": "integrity_check", "result": integrity})
        
        if not integrity.get("is_healthy"):
            logger.error("Database integrity check failed!")
            results["status"] = "aborted"
            return results
        
        # 2. Analyze
        analyze = self.maintenance.analyze_database()
        results["operations"].append({"name": "analyze", "result": analyze})
        
        # 3. Optimize indexes
        optimize = self.maintenance.optimize_indexes()
        results["operations"].append({"name": "optimize_indexes", "result": optimize})
        
        # 4. Vacuum
        vacuum = self.maintenance.vacuum_database()
        results["operations"].append({"name": "vacuum", "result": vacuum})
        
        # 5. Get stats
        stats = self.maintenance.get_database_stats()
        results["operations"].append({"name": "get_stats", "result": stats})
        
        results["status"] = "completed"
        
        logger.info("Full maintenance completed successfully")
        
        return results
    
    def get_maintenance_report(self) -> Dict:
        """รายงาน Maintenance"""
        return {
            "timestamp": datetime.now().isoformat(),
            "last_maintenance": self.db_path,
            "recommended_actions": [
                "Run VACUUM daily to prevent fragmentation",
                "Run ANALYZE weekly to keep statistics updated",
                "Archive data older than 90 days",
                "Cleanup archives older than 1 year",
                "Monitor database size growth"
            ],
            "next_recommended_maintenance": (datetime.now() + timedelta(days=7)).isoformat()
        }
