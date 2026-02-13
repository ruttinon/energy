"""
Performance Monitoring & Load Testing Tools
ระบบตรวจสอบประสิทธิภาพและการทดสอบโหลด
"""

import time
import psutil
import threading
from collections import deque
from datetime import datetime
import logging
from typing import Dict, List
import json

logger = logging.getLogger("PERFORMANCE_MONITOR")

class PerformanceMonitor:
    """ตรวจสอบประสิทธิภาพของระบบ"""
    
    def __init__(self, history_size: int = 1000):
        self.history_size = history_size
        self.metrics_history = deque(maxlen=history_size)
        self.is_running = False
        self.monitor_thread = None
    
    def start(self):
        """เริ่มต้นการตรวจสอบประสิทธิภาพ"""
        if self.is_running:
            return
        
        self.is_running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("Performance monitor started")
    
    def stop(self):
        """หยุดการตรวจสอบประสิทธิภาพ"""
        self.is_running = False
        logger.info("Performance monitor stopped")
    
    def _monitor_loop(self):
        """Loop สำหรับการตรวจสอบประสิทธิภาพเป็นระยะ"""
        while self.is_running:
            try:
                metrics = self.collect_metrics()
                self.metrics_history.append(metrics)
                time.sleep(5)  # Collect every 5 seconds
            except Exception as e:
                logger.error(f"Error in monitor loop: {str(e)}")
                time.sleep(5)
    
    def collect_metrics(self) -> Dict:
        """เก็บรวบรวมเมตริกประสิทธิภาพ"""
        process = psutil.Process()
        
        try:
            cpu_percent = process.cpu_percent(interval=0.1)
            memory_info = process.memory_info()
            memory_percent = process.memory_percent()
            
            # System-wide metrics
            system_cpu = psutil.cpu_percent(interval=0.1)
            system_memory = psutil.virtual_memory()
            
            return {
                "timestamp": datetime.now().isoformat(),
                "process": {
                    "cpu_percent": cpu_percent,
                    "memory_mb": memory_info.rss / (1024 * 1024),
                    "memory_percent": memory_percent,
                    "num_threads": process.num_threads(),
                    "num_fds": process.num_fds() if hasattr(process, 'num_fds') else None
                },
                "system": {
                    "cpu_percent": system_cpu,
                    "memory_used_mb": system_memory.used / (1024 * 1024),
                    "memory_total_mb": system_memory.total / (1024 * 1024),
                    "memory_percent": system_memory.percent,
                    "disk_percent": psutil.disk_usage('/').percent
                }
            }
        except Exception as e:
            logger.error(f"Error collecting metrics: {str(e)}")
            return {"error": str(e)}
    
    def get_current_metrics(self) -> Dict:
        """ดึงเมตริกปัจจุบัน"""
        return self.collect_metrics()
    
    def get_average_metrics(self, last_n: int = 100) -> Dict:
        """ดึงค่าเฉลี่ยของเมตริก"""
        if not self.metrics_history:
            return {}
        
        recent_metrics = list(self.metrics_history)[-last_n:]
        
        if not recent_metrics:
            return {}
        
        # Calculate averages
        avg_cpu = sum(m["process"]["cpu_percent"] for m in recent_metrics if "process" in m) / len(recent_metrics)
        avg_memory = sum(m["process"]["memory_mb"] for m in recent_metrics if "process" in m) / len(recent_metrics)
        
        return {
            "sample_count": len(recent_metrics),
            "average": {
                "cpu_percent": avg_cpu,
                "memory_mb": avg_memory
            },
            "peak": {
                "cpu_percent": max(m["process"]["cpu_percent"] for m in recent_metrics if "process" in m),
                "memory_mb": max(m["process"]["memory_mb"] for m in recent_metrics if "process" in m)
            },
            "period": f"Last {last_n} samples (~{last_n * 5 / 60:.1f} minutes)"
        }
    
    def get_health_report(self) -> Dict:
        """รายงานสภาพโรค (Health Report)"""
        current = self.get_current_metrics()
        average = self.get_average_metrics(100)
        
        # Determine health status
        cpu = current.get("process", {}).get("cpu_percent", 0)
        memory = current.get("process", {}).get("memory_percent", 0)
        
        if cpu > 80 or memory > 80:
            status = "warning"
        elif cpu > 90 or memory > 90:
            status = "critical"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "current_metrics": current,
            "average_metrics": average,
            "recommendations": self._get_recommendations(cpu, memory)
        }
    
    def _get_recommendations(self, cpu: float, memory: float) -> List[str]:
        """แนวแนะสำหรับปรับปรุงประสิทธิภาพ"""
        recommendations = []
        
        if cpu > 80:
            recommendations.append("CPU usage is high. Consider optimizing queries or increasing resources.")
        
        if memory > 80:
            recommendations.append("Memory usage is high. Consider increasing RAM or optimizing data structures.")
        
        if cpu > 90 or memory > 90:
            recommendations.append("CRITICAL: System resources are critically low. Immediate action required.")
        
        if not recommendations:
            recommendations.append("System is running smoothly. No immediate action needed.")
        
        return recommendations


class LoadTester:
    """ตัวทดสอบโหลด (Load Testing)"""
    
    def __init__(self, api_base_url: str = "http://localhost:5000"):
        self.api_base_url = api_base_url
        self.results = []
    
    def simulate_concurrent_requests(self, endpoint: str, num_requests: int = 100, num_workers: int = 10) -> Dict:
        """จำลองคำขอพร้อมกัน (Concurrent requests)"""
        import asyncio
        import aiohttp
        
        async def make_request(session, url):
            start_time = time.time()
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    elapsed = time.time() - start_time
                    return {
                        "status": response.status,
                        "elapsed": elapsed,
                        "success": response.status == 200
                    }
            except Exception as e:
                return {
                    "status": 0,
                    "elapsed": time.time() - start_time,
                    "success": False,
                    "error": str(e)
                }
        
        async def run_test():
            url = f"{self.api_base_url}{endpoint}"
            async with aiohttp.ClientSession() as session:
                tasks = [make_request(session, url) for _ in range(num_requests)]
                return await asyncio.gather(*tasks)
        
        try:
            # Run async load test
            results = asyncio.run(run_test())
            
            successful = sum(1 for r in results if r["success"])
            failed = num_requests - successful
            elapsed_times = [r["elapsed"] for r in results]
            
            return {
                "status": "completed",
                "endpoint": endpoint,
                "total_requests": num_requests,
                "successful": successful,
                "failed": failed,
                "success_rate": f"{(successful/num_requests)*100:.1f}%",
                "min_response_time": f"{min(elapsed_times):.3f}s",
                "max_response_time": f"{max(elapsed_times):.3f}s",
                "avg_response_time": f"{sum(elapsed_times)/len(elapsed_times):.3f}s",
                "requests_per_second": f"{num_requests/sum(elapsed_times):.1f}",
                "results": results
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    def simulate_device_load(self, num_devices: int = 100, readings_per_device: int = 10) -> Dict:
        """จำลองการส่งข้อมูลจากอุปกรณ์ (Device data simulation)"""
        import random
        
        start_time = time.time()
        total_readings = num_devices * readings_per_device
        
        # Simulate data generation
        for device_id in range(num_devices):
            for _ in range(readings_per_device):
                # Simulate reading generation
                reading = {
                    "device_id": f"device_{device_id}",
                    "voltage": round(random.uniform(200, 250), 2),
                    "current": round(random.uniform(0, 50), 2),
                    "power": round(random.uniform(0, 12000), 2),
                    "timestamp": datetime.now().isoformat()
                }
                # Process reading...
        
        elapsed = time.time() - start_time
        
        return {
            "status": "completed",
            "num_devices": num_devices,
            "readings_per_device": readings_per_device,
            "total_readings": total_readings,
            "elapsed_seconds": f"{elapsed:.2f}",
            "readings_per_second": f"{total_readings/elapsed:.1f}",
            "throughput_mbps": f"{(total_readings * 0.0001) / elapsed:.2f}"
        }
    
    def stress_test(self, duration_seconds: int = 60, requests_per_second: int = 100) -> Dict:
        """ทดสอบความต้านทาน (Stress testing)"""
        import asyncio
        import aiohttp
        
        async def make_request(session, url):
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    return response.status == 200
            except:
                return False
        
        async def run_stress_test():
            url = f"{self.api_base_url}/devices"
            successful = 0
            total = 0
            
            async with aiohttp.ClientSession() as session:
                end_time = time.time() + duration_seconds
                
                while time.time() < end_time:
                    tasks = [make_request(session, url) for _ in range(requests_per_second)]
                    results = await asyncio.gather(*tasks)
                    
                    successful += sum(results)
                    total += len(results)
                    
                    await asyncio.sleep(1)
            
            return successful, total
        
        try:
            successful, total = asyncio.run(run_stress_test())
            
            return {
                "status": "completed",
                "duration_seconds": duration_seconds,
                "total_requests": total,
                "successful_requests": successful,
                "failed_requests": total - successful,
                "success_rate": f"{(successful/total)*100:.1f}%",
                "avg_rps": f"{total/duration_seconds:.1f}"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }


# Database Query Performance Analyzer
class QueryPerformanceAnalyzer:
    """วิเคราะห์ประสิทธิภาพของ Database queries"""
    
    def __init__(self):
        self.query_stats = {}
    
    def record_query(self, query: str, execution_time_ms: float, row_count: int = 0):
        """บันทึก Query performance"""
        if query not in self.query_stats:
            self.query_stats[query] = {
                "count": 0,
                "total_time": 0,
                "avg_time": 0,
                "min_time": float('inf'),
                "max_time": 0
            }
        
        stats = self.query_stats[query]
        stats["count"] += 1
        stats["total_time"] += execution_time_ms
        stats["avg_time"] = stats["total_time"] / stats["count"]
        stats["min_time"] = min(stats["min_time"], execution_time_ms)
        stats["max_time"] = max(stats["max_time"], execution_time_ms)
    
    def get_slowest_queries(self, top_n: int = 10) -> List[Dict]:
        """ดึง Queries ที่ช้าที่สุด"""
        sorted_queries = sorted(
            self.query_stats.items(),
            key=lambda x: x[1]["max_time"],
            reverse=True
        )
        
        return [
            {
                "query": query,
                "avg_time_ms": round(stats["avg_time"], 2),
                "max_time_ms": round(stats["max_time"], 2),
                "execution_count": stats["count"]
            }
            for query, stats in sorted_queries[:top_n]
        ]
    
    def get_performance_report(self) -> Dict:
        """รายงานประสิทธิภาพ Query"""
        if not self.query_stats:
            return {"status": "no_data"}
        
        total_queries = sum(s["count"] for s in self.query_stats.values())
        total_time = sum(s["total_time"] for s in self.query_stats.values())
        
        return {
            "total_queries": total_queries,
            "unique_queries": len(self.query_stats),
            "total_execution_time_ms": round(total_time, 2),
            "average_query_time_ms": round(total_time / total_queries, 2),
            "slowest_queries": self.get_slowest_queries()
        }
