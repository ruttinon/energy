#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# report_manager.py

"""
📊 Report Manager (Local Mode)
------------------------------------------
- สรุปรายงานจาก SQLite (modbus_log.db)
- สร้างรายงานรายวัน / รายสัปดาห์ / รายเดือน / รายปี
- บันทึกลงตาราง reports (ใช้ร่วมกับ API Server)
- Export CSV / PDF
- ลบข้อมูล readings เก่าทุกวัน
"""

import sqlite3
import json
import csv
from datetime import datetime, timedelta
import os
import statistics
import sys
import time
import traceback

# ===========================================================
# ✅ Utility: Path setup
# ===========================================================
def resource_path(relative_path):
    """ใช้เพื่อให้หา path ได้ถูกต้องทั้งตอนรันปกติและตอน pack ด้วย PyInstaller"""
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# ===========================================================
# ✅ CONFIG
# ===========================================================
LOCAL_DB = resource_path("modbus_data/modbus_log.db")
CSV_DIR = resource_path("reports_csv")

os.makedirs(os.path.dirname(LOCAL_DB), exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)

# ===========================================================
# ✅ Helper Functions
# ===========================================================
def get_data_for_period(start_date, end_date):
    """ดึงข้อมูลจาก SQLite ในช่วงเวลาที่กำหนด"""
    try:
        conn = sqlite3.connect(LOCAL_DB, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT device_id, timestamp, data_json FROM readings WHERE timestamp BETWEEN ? AND ?",
            (start_date.isoformat(), end_date.isoformat())
        )
        rows = cursor.fetchall()
        conn.close()
        return rows
    except Exception as e:
        print(f"⚠️ Error reading from SQLite: {e}")
        traceback.print_exc()
        return []


def summarize_data(rows):
    """สรุปค่าเฉลี่ย / สูงสุด / ต่ำสุด จาก readings"""
    summary = {}
    for device_id, timestamp, data_json in rows:
        try:
            data = json.loads(data_json)
        except Exception:
            continue
        dev = summary.setdefault(device_id, {"count": 0})
        dev["count"] += 1

        for key, val in data.items():
            if isinstance(val, (int, float)):
                dev.setdefault(key, []).append(val)

    # คำนวณ avg/max/min
    for device_id, values in summary.items():
        for key, arr in list(values.items()):
            if isinstance(arr, list) and arr:
                summary[device_id][key] = {
                    "avg": round(statistics.mean(arr), 2),
                    "max": round(max(arr), 2),
                    "min": round(min(arr), 2)
                }

    return summary


def init_report_table():
    """สร้างตาราง reports ถ้ายังไม่มี"""
    conn = sqlite3.connect(LOCAL_DB)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            period_type TEXT,
            report_date TEXT,
            data_json TEXT,
            approved INTEGER DEFAULT 0,
            approved_by TEXT,
            approved_at TEXT
        )
    """)
    conn.commit()
    conn.close()
    print("✅ reports table ready.")


def save_report_local(period_type, report_date, summary):
    """บันทึกรายงานลง SQLite"""
    try:
        init_report_table()
        conn = sqlite3.connect(LOCAL_DB, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO reports (period_type, report_date, data_json) VALUES (?, ?, ?)",
            (period_type, report_date, json.dumps(summary, ensure_ascii=False))
        )
        conn.commit()
        conn.close()
        print(f"💾 Saved {period_type} report for {report_date} to SQLite ({len(summary)} devices)")
    except Exception as e:
        print(f"⚠️ Error saving report to SQLite: {e}")
        traceback.print_exc()


def export_report_csv(period_type, report_date, summary):
    """Export รายงานแบบละเอียดเป็น CSV ไฟล์"""
    try:
        filename = os.path.join(CSV_DIR, f"{period_type}_{report_date}.csv")
        with open(filename, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["Device ID", "Parameter", "Average", "Max", "Min", "Count"])

            for device_id, data in summary.items():
                count = data.get("count", 0)
                for key, stats in data.items():
                    if isinstance(stats, dict) and "avg" in stats:
                        writer.writerow([
                            device_id,
                            key,
                            stats.get("avg", ""),
                            stats.get("max", ""),
                            stats.get("min", ""),
                            count
                        ])
        print(f"📑 Exported {period_type} report for {report_date} → {filename}")
    except Exception as e:
        print(f"⚠️ Error exporting CSV: {e}")
        traceback.print_exc()


# ===========================================================
# ✅ Export Simple (ใช้กับ API /api/report/export)
# ===========================================================
def export_report_csv_simple(data):
    """ใช้โดย API — แปลง dict → CSV text"""
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Key", "Value"])
    for k, v in data.items():
        if isinstance(v, dict):
            writer.writerow([k, json.dumps(v, ensure_ascii=False)])
        else:
            writer.writerow([k, v])
    return output.getvalue()


def export_report_pdf_simple(data):
    """ใช้โดย API — แปลง dict → PDF bytes"""
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="Device Report Summary", ln=True, align="C")
    for k, v in data.items():
        if isinstance(v, dict):
            v = json.dumps(v, ensure_ascii=False)
        pdf.cell(200, 8, txt=f"{k}: {v}", ln=True)
    return pdf.output(dest="S").encode("latin-1")


# ===========================================================
# ✅ Cleanup old data
# ===========================================================
def cleanup_old_data(days_to_keep=2):
    """ลบข้อมูล readings เก่า (เก็บไว้ไม่เกิน N วัน)"""
    try:
        conn = sqlite3.connect(LOCAL_DB, check_same_thread=False)
        cursor = conn.cursor()
        cutoff = datetime.now() - timedelta(days=days_to_keep)
        cursor.execute("DELETE FROM readings WHERE timestamp < ?", (cutoff.isoformat(),))
        conn.commit()
        conn.close()
        print(f"🧹 Deleted old data before {cutoff.strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"⚠️ Error cleanup_old_data: {e}")
        traceback.print_exc()


# ===========================================================
# ✅ MAIN Function (ทำงานจริง)
# ===========================================================
def main_once():
    now = datetime.now()
    end_day = now

    print(f"🕒 Running report generation at {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # ===== รายวัน =====
    start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = get_data_for_period(start_day, end_day)
    if rows:
        daily_summary = summarize_data(rows)
        report_date_day = start_day.strftime("%Y-%m-%d")
        save_report_local("daily", report_date_day, daily_summary)
        export_report_csv("daily", report_date_day, daily_summary)

    # ===== รายสัปดาห์ =====
    start_week = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = get_data_for_period(start_week, end_day)
    if rows:
        weekly_summary = summarize_data(rows)
        week_num = now.isocalendar()[1]
        report_date_week = f"{now.strftime('%Y')}-W{week_num:02d}"
        save_report_local("weekly", report_date_week, weekly_summary)
        export_report_csv("weekly", report_date_week, weekly_summary)

    # ===== รายเดือน =====
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = get_data_for_period(start_month, end_day)
    if rows:
        monthly_summary = summarize_data(rows)
        report_date_month = now.strftime("%Y-%m")
        save_report_local("monthly", report_date_month, monthly_summary)
        export_report_csv("monthly", report_date_month, monthly_summary)

    # ===== รายปี =====
    start_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = get_data_for_period(start_year, end_day)
    if rows:
        yearly_summary = summarize_data(rows)
        report_date_year = now.strftime("%Y")
        save_report_local("yearly", report_date_year, yearly_summary)
        export_report_csv("yearly", report_date_year, yearly_summary)

    # ===== ลบข้อมูลเก่า =====
    cleanup_old_data(days_to_keep=2)


# ===========================================================
# ✅ start() สำหรับ main_launcher.py
# ===========================================================
def start():
    print("📊 Report Manager started — generating reports every 15 minutes")

    pid_file = "report_manager.pid"
    if os.path.exists(pid_file):
        print("⚠️ Another report_manager process already running.")
        sys.exit(0)

    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))

    try:
        while True:
            try:
                main_once()
            except Exception as e:
                print("🔥 Error during report generation:", e)
                traceback.print_exc()
            print("⏳ Waiting 15 minutes before next report...")
            time.sleep(900)
    except KeyboardInterrupt:
        print("🛑 Report Manager stopped by KeyboardInterrupt")
    finally:
        if os.path.exists(pid_file):
            os.remove(pid_file)

# ===========================================================
# ✅ Wrapper สำหรับ API Server
# ===========================================================
def export_report_pdf(data):
    """
    ✅ ฟังก์ชัน wrapper สำหรับ api_server.py
    แปลงข้อมูล report (dict) → PDF bytes
    """
    try:
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)

        pdf.cell(200, 10, txt="Device Report Summary", ln=True, align="C")
        pdf.ln(5)

        for device_id, values in data.items():
            pdf.set_font("Arial", "B", 11)
            pdf.cell(200, 8, txt=f"Device: {device_id}", ln=True)
            pdf.set_font("Arial", size=10)

            if isinstance(values, dict):
                for key, val in values.items():
                    if isinstance(val, dict):
                        avg = val.get("avg", "")
                        mx = val.get("max", "")
                        mn = val.get("min", "")
                        pdf.cell(200, 8, txt=f"{key} → Avg:{avg} | Max:{mx} | Min:{mn}", ln=True)
                    else:
                        pdf.cell(200, 8, txt=f"{key}: {val}", ln=True)
            pdf.ln(5)

        return pdf.output(dest="S").encode("latin-1")

    except Exception as e:
        print("⚠️ Error generating PDF:", e)
        import traceback; traceback.print_exc()
        return b""

# ===========================================================
# ✅ Run standalone
# ===========================================================
if __name__ == "__main__":
    start()
