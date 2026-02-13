"""
LINE Bot Scheduled Alerts - Send alerts at scheduled times
"""
import schedule
import time
import logging
from datetime import datetime
from typing import Callable, List
from .line_service import LineBotService
from .alert_manager import AlertManager

logger = logging.getLogger(__name__)

class ScheduledAlertManager:
    """Manage scheduled alerts for LINE Bot"""
    
    def __init__(self, line_service: LineBotService):
        self.line_service = line_service
        self.alert_manager = AlertManager(line_service)
        self.scheduled_jobs: List[schedule.Job] = []
    
    def schedule_daily_energy_report(self, time_str: str = "08:00", project_id: str = None):
        """
        Schedule daily energy report
        
        Args:
            time_str: Time in HH:MM format (default: 08:00)
            project_id: Project ID to send report for
        """
        def send_report():
            try:
                logger.info(f"Sending daily energy report for project {project_id}")
                # Get energy data from shared state
                from services.backend.shared_state import get_device_data, get_active_project
                
                proj = project_id or get_active_project()
                device_data = get_device_data(proj)
                
                if device_data:
                    total_power = sum(float(d.get('power', 0) or 0) for d in device_data.values() if d)
                    online_count = sum(1 for d in device_data.values() if d and d.get('online', False))
                    
                    message = f"""📊 รายงานพลังงานประจำวัน [{proj}]
                    
⚡ กำลังใช้เฉลี่ย: {total_power:.1f} kW
📱 อุปกรณ์ออนไลน์: {online_count} เครื่อง
🕐 เวลา: {datetime.now().strftime('%d/%m/%Y %H:%M')}

💡 คำแนะนำ: เลือกช่วงเวลาที่ใช้พลังงานมากที่สุด"""
                    
                    self.alert_manager.send_alert_to_project_users(proj, message)
            except Exception as e:
                logger.error(f"Error sending daily report: {e}")
        
        job = schedule.every().day.at(time_str).do(send_report)
        self.scheduled_jobs.append(job)
        logger.info(f"Scheduled daily energy report at {time_str}")
        return job
    
    def schedule_hourly_alert(self, project_id: str = None):
        """Schedule hourly energy status check"""
        def check_status():
            try:
                logger.info(f"Hourly check for project {project_id}")
                from services.backend.shared_state import get_device_data, get_active_project
                
                proj = project_id or get_active_project()
                device_data = get_device_data(proj)
                
                if device_data:
                    offline_devices = [d for d in device_data.values() if d and not d.get('online', False)]
                    
                    if offline_devices:
                        message = f"""🚨 อุปกรณ์ออฟไลน์ [{proj}]

จำนวน: {len(offline_devices)} เครื่อง
วิธีแก้ไข:
1. ตรวจสอบการเชื่อมต่อ
2. รีสตาร์ท modem/router
3. ติดต่อทีมสนับสนุน"""
                        
                        self.alert_manager.send_alert_to_project_users(proj, message)
            except Exception as e:
                logger.error(f"Error in hourly check: {e}")
        
        job = schedule.every().hour.do(check_status)
        self.scheduled_jobs.append(job)
        logger.info(f"Scheduled hourly status check for project {project_id}")
        return job
    
    def schedule_billing_reminder(self, day_of_month: int = 25, time_str: str = "09:00", project_id: str = None):
        """
        Schedule billing reminder
        
        Args:
            day_of_month: Day of month to send reminder (default: 25th)
            time_str: Time in HH:MM format (default: 09:00)
            project_id: Project ID
        """
        def send_reminder():
            try:
                logger.info(f"Sending billing reminder for project {project_id}")
                message = f"""💰 แจ้งเตือนบิลค่าไฟฟ้า [{project_id}]

📅 บิลจะออกเร็วๆ นี้ 
💡 ตรวจสอบข้อมูลการใช้พลังงาน
📊 ดูรายงานโดยพิมพ์ "ค่าไฟ"

ต้องการข้อมูลอื่นใดไหม?"""
                
                self.alert_manager.send_alert_to_project_users(project_id, message)
            except Exception as e:
                logger.error(f"Error sending billing reminder: {e}")
        
        # Schedule on specific day of month
        job = schedule.every().day.at(time_str).do(send_reminder)
        self.scheduled_jobs.append(job)
        logger.info(f"Scheduled billing reminder on day {day_of_month} at {time_str}")
        return job
    
    def run(self):
        """Run the scheduler (call this in a separate thread)"""
        logger.info("Starting scheduled alerts manager")
        while True:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(60)
    
    def cancel_all(self):
        """Cancel all scheduled jobs"""
        for job in self.scheduled_jobs:
            schedule.cancel_job(job)
        self.scheduled_jobs.clear()
        logger.info("Cancelled all scheduled jobs")
    
    def get_scheduled_jobs_info(self) -> List[dict]:
        """Get information about all scheduled jobs"""
        jobs_info = []
        for job in self.scheduled_jobs:
            jobs_info.append({
                "next_run": str(job.next_run),
                "interval": str(job.interval),
                "job_func": str(job.job_func)
            })
        return jobs_info
