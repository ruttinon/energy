## สรุปปัญหา

* โค้ดฝั่งเว็บเรียก API แบบ relative ใช้งานได้กับ public IP อยู่แล้ว ยกเว้นหน้า `login` ที่มี fallback ไป `http://127.0.0.1:8000` ทำให้การล็อกอินบน public IP ล้มเหลว (`frontend/login.html:66–69`).

* ค่า IP ที่เป็น `192.168.x.x` พบในไฟล์คอนฟิกโปรเจ็กต์ (ข้อมูลผู้ใช้) ไม่ใช่ค่าฮาร์ดโค้ดในตัวโปรแกรม (`projects/*/ConfigDevice.json`).

* เทมเพลตโปรโตคอลตั้งค่า `default_host` เป็น `0.0.0.0` อยู่แล้ว จึงไม่ได้บังคับเป็นเครือข่าย private.

* แบ็กเอนด์รองรับการฟังที่ `0.0.0.0:8300` และเปิด CORS แบบกว้าง สามารถให้บริการผ่าน public IP/โดเมนได้ หากระบบเครือข่ายอนุญาต (ไฟร์วอลล์/NAT).

## สิ่งที่จะเปลี่ยน

* ลบการฮาร์ดโค้ด `127.0.0.1` ออกจากหน้า `login` และใช้ `window.location.origin` แทน เพื่อให้ชี้ไปยังโฮสต์/โดเมนปัจจุบันโดยอัตโนมัติ.

* เพิ่มทางเลือกกำหนด `apiBase` ฝั่ง frontend ผ่านตัวแปร `window.__CONFIG__` เพื่อรองรับกรณี reverse-proxy หรือโดเมนแยก โดยไม่เปลี่ยนโค้ดหน้าอื่น.

* คงค่า `default_host` ของโปรโตคอลเป็น `0.0.0.0` (หรือปล่อยว่างใน UI) เพื่อให้ผู้ใช้กรอก IP สาธารณะได้โดยตรง.

* ไม่แก้ฝั่ง backend API; เพียงยืนยันการรันบน `--host 0.0.0.0` และพอร์ตที่เปิดสู่ public.

## รายละเอียดการแก้ไขไฟล์

* แก้ `c:\Users\promb\Desktop\energylink\frontend\login.html`

  * แทนที่บล็อก fallback ที่เรียก `http://127.0.0.1:8000/api/login` ด้วยการสร้าง URL จาก `window.location.origin` เช่น `fetch(window.location.origin + '/api/login', ...)`.

  * อ้างอิงตำแหน่ง: `frontend/login.html:66–69`.

* เพิ่มไฟล์คอนฟิก frontend โหลดก่อนทุกหน้า เช่น `frontend/config.js`

  * กำหนด `window.__CONFIG__ = { apiBase: '' }` (ค่าเว้นว่าง = ใช้ origin เดียวกัน). เมื่อดีพลอย สามารถเติมเป็น `https://<public-ip-or-domain>:8300` ได้.

* ปรับตัวช่วยเรียก API (ถ้าต้องการ):

  * สร้างตัวช่วย `getApiBase()` คืนค่า `window.__CONFIG__?.apiBase || ''` และประกอบ URL เวลาเรียก `fetch`.

  * ตัวอย่างอ้างอิงในหน้าอีดิท: `frontend/edit/add_device.js:7–15, 52–63, 267–273` ที่เรียก `fetch('/api/...')` สามารถคงรูปแบบเดิม (relative) หรือรองรับ `apiBase` โดยไม่กระทบการใช้งาน LAN.

* ไม่ต้องแก้ `services/backend/protocol/*.json` เนื่องจาก `default_host` เป็น `0.0.0.0` แล้ว.

## การทดสอบและตรวจสอบ

* รันแบ็กเอนด์ด้วย `uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 8300`.

* เปิดพอร์ต 8300 บนไฟร์วอลล์/คลาวด์และทดสอบเข้าจากเครื่องภายนอกด้วย `http://<public-ip>:8300/frontend/login.html`.

* ทดสอบล็อกอิน: หน้า `login` ควรเรียก `POST <origin>/api/login` สำเร็จโดยไม่มีการ fallback.

* ทดสอบหน้า Edit/Add Device: เรียก `GET <origin>/api/templates/...` และ `POST <origin>/api/projects/.../config` ได้ตามปกติ.

## หมายเหตุการใช้งานบน Public IP

* หากวางหลัง reverse proxy/โดเมนอื่น ใช้ `frontend/config.js` ตั้งค่า `window.__CONFIG__.apiBase` ให้ชี้ไปยังแบ็กเอนด์.

* ฝั่ง ingest ของเอเจนต์ภายนอก ให้ระบุ `--backend https://<your-public-domain>` ตามที่ตัวอย่างใน `services/agent/modbus_push.py` ระบุ.

* โปรเจ็กต์ที่มีค่า `192.168.x.x` ใน `ConfigDevice.json` เป็นข้อมูลอุปกรณ์ของผู้ใช้ สามารถแก้บน UI เป็น public IP ได้ทันที โดยไม่ต้องแก้โค้ด.

