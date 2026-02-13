# RESTART BACKEND - ขั้นตอนที่ถูกต้อง

## ⚠️ สำคัญมาก!

Backend ต้อง restart **อย่างถูกต้อง** เพื่อให้ load โค้ดใหม่

## ขั้นตอน

### 1. ลบ Python Cache ทั้งหมด

```powershell
Get-ChildItem -Path services -Include __pycache__,*.pyc -Recurse -Force | Remove-Item -Recurse -Force
```

### 2. Stop Backend

กด `Ctrl+C` ที่ terminal ที่รัน backend

**รอให้แสดง:**
```
INFO:     Shutting down
INFO:     Finished server process [xxxxx]
```

### 3. Start Backend ใหม่

```bash
python -m uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 5000
```

**รอให้แสดง:**
```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 4. ทดสอบ

```bash
python test_api_control.py
```

### 5. ตรวจสอบ Backend Logs

**ต้องเห็น logs เหล่านี้:**

```
[CONTROL] Writing Modbus: 192.168.1.59:10001 Slave=5 Addr=17 Val=65280 Func=5 Proto=tcp
[CONTROL] Using RTU over TCP protocol
[CONTROL] Payload: 05050011ff00
[CONTROL] Frame with CRC: 05050011ff00ddbb
[CONTROL] Connecting to 192.168.1.59:10001...
[CONTROL] Connected, sending 8 bytes...
[CONTROL] Waiting for response...
[CONTROL] Received 8 bytes: 05050011ff00ddbb
[CONTROL] Response slave=5, func=5
[CONTROL] ✓ RTU Write SUCCESS
```

**ถ้าไม่เห็น logs = โค้ดยังไม่ reload!**

## Troubleshooting

### ถ้ายังไม่เห็น Logs

1. ตรวจสอบว่า `service.py` ถูก save แล้ว
2. ลบ cache อีกครั้ง
3. Restart backend อีกครั้ง
4. ลอง kill process ทั้งหมด:
   ```powershell
   Get-Process python | Stop-Process -Force
   ```
   แล้ว start ใหม่

### ถ้ายังใช้ Virtual Device

ตรวจสอบว่า backend logs แสดง:
- `[CONTROL] Using RTU over TCP protocol` ← ถ้าไม่มี = โค้ดเก่า
- `[CONTROL] ✓ RTU Write SUCCESS` ← ถ้าไม่มี = ไม่ได้เชื่อมต่อ

## Expected Result

### API Response

```json
{
  "status": "success",
  "error_message": "Verified: Output is ON"
}
```

### Control Center

- กดปุ่มทำงานได้
- ค่าอัพเดทตาม Modbus polling (3 วินาที)
- Audit log ไม่แสดง "Virtual Device"
