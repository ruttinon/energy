# คำสั่งสำหรับ Restart Backend และทดสอบ Virtual Device

## ขั้นตอนที่ 1: Stop Backend Server

กด `Ctrl+C` ที่ terminal ที่รัน backend

## ขั้นตอนที่ 2: Start Backend ใหม่

```bash
python -m uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 5000
```

## ขั้นตอนที่ 3: ทดสอบ Virtual Device

เปิด terminal ใหม่แล้วรัน:

```bash
python test_control_debug.py
```

## ผลลัพธ์ที่คาดหวัง

```json
{
  "status": "success",
  "error_message": "Virtual Device: Output is ON (Hardware offline)"
}
```

และสถานะจะเปลี่ยนจาก UNKNOWN เป็น ON/OFF

## ถ้ายังไม่ได้

ตรวจสอบ backend logs ว่ามีข้อความนี้หรือไม่:

```
[CONTROL] Hardware unreachable. Using VIRTUAL DEVICE for 25
[VIRTUAL] Device 25 Address 17 = 1
[CONTROL] ✓ Virtual write successful: Device 25 Address 17 = 1
```

## หมายเหตุ

- Virtual Device จะเก็บสถานะใน memory
- สถานะจะหายเมื่อ restart backend
- ใช้สำหรับทดสอบเท่านั้น ไม่ควบคุม device จริง
