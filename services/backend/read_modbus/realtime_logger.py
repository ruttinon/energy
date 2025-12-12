import os, json, time
from datetime import datetime
from utils.device_manager import load_readings

# ============================================================
# ✅ ชี้ path ไปที่ data/ ในโฟลเดอร์หลักของโปรเจกต์
# ============================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

REALTIME_FILE = os.path.join(DATA_DIR, "realtime_data.json")

# ============================================================
# 🕒 ฟังก์ชันหลักสำหรับบันทึกข้อมูล Realtime
# ============================================================
def append_realtime():
    """เก็บข้อมูลล่าสุดทุก 1 นาที (เขียนทับของเก่าทั้งหมด)"""
    print(f"📁 Realtime logger started — saving to {REALTIME_FILE}")

    while True:
        try:
            readings = load_readings()  # โหลด readings ปัจจุบันทั้งหมด
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # ✅ สร้าง dict ใหม่ที่มี timestamp ทุก device
            data = {}
            for device_id, values in readings.items():
                entry = {"timestamp": timestamp}
                entry.update(values)
                data[device_id] = entry  # 🔹 เขียนทับของเก่าทันที

            # ✅ เขียนใหม่ทั้งไฟล์ (ไม่ append)
            with open(REALTIME_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            print(f"🕒 Updated realtime_data.json at {timestamp} ({len(data)} devices)")

        except Exception as e:
            print("🔥 Realtime Logger Error:", e)

        # เก็บทุก 1 นาที
        time.sleep(60)
