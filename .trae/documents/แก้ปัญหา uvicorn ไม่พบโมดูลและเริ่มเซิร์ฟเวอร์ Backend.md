## สาเหตุ
- คำสั่งใช้ Python ระบบที่ไม่มีแพ็กเกจ `uvicorn` ติดตั้ง จึงขึ้น `No module named uvicorn`.
- มี `.venv/` อยู่แล้วและมี `requirements.txt` ระบุ `fastapi`, `uvicorn`, `pydantic` แต่ยังไม่ได้ติดตั้งใน venv หรือเรียกใช้ venv ไม่ถูกต้อง.
- บน Windows บางครั้ง `--reload` จะ re-spawn ด้วย path Python ที่ผิด ถ้าไม่เรียกผ่าน venv ที่ถูกต้อง.

## ขั้นตอนแก้ไข
1. เปิดใช้ venv
- PowerShell: `\.venv\Scripts\activate`
- ตรวจสอบ: `pip --version` และ `python --version` ให้ชี้ไปใน venv

2. ติดตั้ง dependencies
- `pip install -r services/backend/requirements.txt`
- ถ้าเครื่องออฟไลน์และมี wheel ในเครื่อง ให้ใช้รูปแบบคอมเมนต์ในไฟล์:  
  `pip install --no-index --find-links=../vendor_wheels -r services/backend/requirements.txt`

3. เริ่มเซิร์ฟเวอร์ (เลือกอย่างใดอย่างหนึ่ง)
- ทางตรงด้วย venv Python:  
  `python -m uvicorn services.backend.fastapi_app:app --reload --port 8000`
- หรือเรียกตัว `uvicorn.exe` ใน venv เพื่อลดปัญหา path:  
  `\.venv\Scripts\uvicorn.exe services.backend.fastapi_app:app --reload --port 8000`
- ถ้า `--reload` ยังฟ้อง path Python ไม่ถูก ให้เริ่มชั่วคราวแบบไม่ reload:  
  `\.venv\Scripts\uvicorn.exe services.backend.fastapi_app:app --port 8000`

## การตรวจสอบ
- เปิด `http://localhost:8000/frontend/login.html` และล็อกอิน.
- เรียกทดสอบ API:
  - `GET /api/templates/protocols` ควรได้รายการโปรโตคอลจาก `services/backend/protocol/`.
  - `GET /api/templates/devices` ควรได้รายการเทมเพลตจาก `services/backend/device_templates/`.
  - `GET /api/projects/list` และ `GET /api/active` ตรวจสถานะโปรเจค.
- เปิด `http://localhost:8000/frontend/edit/add_device.html` ตรวจฝั่งซ้าย/ขวาและ popup เพิ่ม/แก้ไข converter.

## ทางเลือก/หมายเหตุ
- ถ้ายังขึ้น `No module named uvicorn` ให้ติดตั้งเฉพาะแพ็กเกจใน venv:  
  `pip install uvicorn fastapi pydantic`
- ตรวจให้แน่ใจว่าคำสั่งทั้งหมดรันหลัง `activate` venv (ชื่อ prompt ควรขึ้นตาม venv).