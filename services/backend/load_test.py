#!/usr/bin/env python3
"""
Load Testing & Performance Benchmark
สคริปต์ทดสอบโหลดและวัดประสิทธิภาพ
"""

import asyncio
import aiohttp
import time
import json
import sys
from datetime import datetime
from typing import Dict, List
import argparse

class LoadTester:
    """ตัวทดสอบโหลด"""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.results = []
    
    async def single_request(self, session: aiohttp.ClientSession, url: str, method: str = "GET") -> Dict:
        """ส่งคำขอเพียงครั้งเดียว"""
        start_time = time.time()
        try:
            async with session.request(method, url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                elapsed = time.time() - start_time
                return {
                    "status": response.status,
                    "elapsed_ms": elapsed * 1000,
                    "success": 200 <= response.status < 300
                }
        except asyncio.TimeoutError:
            return {
                "status": 0,
                "elapsed_ms": (time.time() - start_time) * 1000,
                "success": False,
                "error": "Timeout"
            }
        except Exception as e:
            return {
                "status": 0,
                "elapsed_ms": (time.time() - start_time) * 1000,
                "success": False,
                "error": str(e)
            }
    
    async def load_test(self, endpoint: str, num_requests: int, concurrency: int) -> Dict:
        """ทดสอบโหลดด้วยจำนวนคำขอพร้อมกัน"""
        url = f"{self.base_url}{endpoint}"
        
        print(f"\n📊 Load Test: {endpoint}")
        print(f"   Total Requests: {num_requests}")
        print(f"   Concurrency: {concurrency}")
        print(f"   URL: {url}\n")
        
        results = []
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            # Create chunks for concurrent requests
            for i in range(0, num_requests, concurrency):
                chunk_size = min(concurrency, num_requests - i)
                chunk = [
                    self.single_request(session, url)
                    for _ in range(chunk_size)
                ]
                
                chunk_results = await asyncio.gather(*chunk)
                results.extend(chunk_results)
                
                # Progress indicator
                progress = min(i + concurrency, num_requests)
                print(f"   Progress: {progress}/{num_requests} ({(progress/num_requests*100):.0f}%)", end='\r')
                
                # Small delay between chunks
                if i + concurrency < num_requests:
                    await asyncio.sleep(0.1)
        
        total_time = time.time() - start_time
        
        # Analyze results
        successful = sum(1 for r in results if r["success"])
        failed = num_requests - successful
        elapsed_times = [r["elapsed_ms"] for r in results]
        
        report = {
            "endpoint": endpoint,
            "timestamp": datetime.now().isoformat(),
            "test_parameters": {
                "total_requests": num_requests,
                "concurrency": concurrency,
                "total_time_seconds": round(total_time, 2)
            },
            "results": {
                "successful": successful,
                "failed": failed,
                "success_rate": f"{(successful/num_requests)*100:.1f}%"
            },
            "response_times": {
                "min_ms": round(min(elapsed_times), 2),
                "max_ms": round(max(elapsed_times), 2),
                "avg_ms": round(sum(elapsed_times)/len(elapsed_times), 2),
                "median_ms": round(sorted(elapsed_times)[len(elapsed_times)//2], 2)
            },
            "throughput": {
                "requests_per_second": round(num_requests / total_time, 2),
                "total_time_seconds": round(total_time, 2)
            }
        }
        
        return report
    
    async def stress_test(self, endpoint: str, duration_seconds: int, rps: int) -> Dict:
        """ทดสอบความต้านทาน"""
        url = f"{self.base_url}{endpoint}"
        
        print(f"\n⚡ Stress Test: {endpoint}")
        print(f"   Duration: {duration_seconds} seconds")
        print(f"   Target RPS: {rps}\n")
        
        results = []
        start_time = time.time()
        requests_made = 0
        
        async with aiohttp.ClientSession() as session:
            end_time = start_time + duration_seconds
            
            while time.time() < end_time:
                # Calculate how many requests to make in this second
                elapsed = time.time() - start_time
                target_requests = int((elapsed + 1) * rps)
                requests_to_make = target_requests - requests_made
                
                # Make requests concurrently
                if requests_to_make > 0:
                    tasks = [
                        self.single_request(session, url)
                        for _ in range(min(requests_to_make, rps))
                    ]
                    chunk_results = await asyncio.gather(*tasks)
                    results.extend(chunk_results)
                    requests_made += len(chunk_results)
                
                # Progress indicator
                elapsed_so_far = time.time() - start_time
                print(f"   Progress: {elapsed_so_far:.1f}s / {duration_seconds}s ({requests_made} requests)", end='\r')
                
                await asyncio.sleep(0.01)  # Small delay
        
        total_time = time.time() - start_time
        
        successful = sum(1 for r in results if r["success"])
        failed = len(results) - successful
        
        return {
            "endpoint": endpoint,
            "timestamp": datetime.now().isoformat(),
            "test_parameters": {
                "duration_seconds": duration_seconds,
                "target_rps": rps,
                "actual_rps": round(len(results) / total_time, 2)
            },
            "results": {
                "total_requests": len(results),
                "successful": successful,
                "failed": failed,
                "success_rate": f"{(successful/len(results)*100):.1f}%" if results else "0%"
            },
            "throughput": {
                "requests_per_second": round(len(results) / total_time, 2)
            }
        }
    
    async def endurance_test(self, endpoint: str, duration_minutes: int, rps: int) -> Dict:
        """ทดสอบความเสถียรระยะยาว (Endurance test)"""
        duration_seconds = duration_minutes * 60
        
        print(f"\n🔄 Endurance Test: {endpoint}")
        print(f"   Duration: {duration_minutes} minutes ({duration_seconds} seconds)")
        print(f"   RPS: {rps}\n")
        
        # Run stress test for extended period
        return await self.stress_test(endpoint, duration_seconds, rps)


def print_report(report: Dict):
    """พิมพ์รายงาน"""
    print("\n" + "="*60)
    print(f"📋 Report: {report.get('endpoint', 'Unknown')}")
    print(f"⏰ Time: {report.get('timestamp', 'N/A')}")
    print("="*60)
    
    if "test_parameters" in report:
        print("\n📊 Test Parameters:")
        for key, value in report["test_parameters"].items():
            print(f"   {key}: {value}")
    
    if "results" in report:
        print("\n✅ Results:")
        for key, value in report["results"].items():
            print(f"   {key}: {value}")
    
    if "response_times" in report:
        print("\n⏱️  Response Times:")
        for key, value in report["response_times"].items():
            print(f"   {key}: {value}")
    
    if "throughput" in report:
        print("\n📈 Throughput:")
        for key, value in report["throughput"].items():
            print(f"   {key}: {value}")
    
    print("\n" + "="*60 + "\n")


async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Load Testing Tool")
    parser.add_argument("--url", default="http://localhost:5000", help="API base URL")
    parser.add_argument("--endpoint", default="/devices", help="Endpoint to test")
    parser.add_argument("--test", choices=["load", "stress", "endurance"], default="load", help="Test type")
    parser.add_argument("--requests", type=int, default=1000, help="Number of requests (for load test)")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent requests")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--rps", type=int, default=100, help="Requests per second")
    parser.add_argument("--minutes", type=int, default=5, help="Duration in minutes (for endurance test)")
    
    args = parser.parse_args()
    
    tester = LoadTester(args.url)
    
    try:
        if args.test == "load":
            report = await tester.load_test(args.endpoint, args.requests, args.concurrency)
        elif args.test == "stress":
            report = await tester.stress_test(args.endpoint, args.duration, args.rps)
        elif args.test == "endurance":
            report = await tester.endurance_test(args.endpoint, args.minutes, args.rps)
        else:
            report = await tester.load_test(args.endpoint, args.requests, args.concurrency)
        
        # Print report
        print_report(report)
        
        # Save report
        report_file = f"load_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)
        print(f"✅ Report saved to: {report_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
