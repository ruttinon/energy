# LINE Webhook Setup (ไม่ต้องติดตั้งบนเครื่องเซิร์ฟเวอร์)

## Webhook URL
- เส้นทางในระบบ: `/api/line/webhook`
- รูปแบบเต็ม: `https://YOUR_DOMAIN/api/line/webhook`

## ตั้งค่า Cloudflare DNS Proxy (Flexible SSL)
- เพิ่ม DNS Record ชนิด A ให้ชี้ไปยัง IP เซิร์ฟเวอร์ของคุณ
- เปิด Proxy (ไอคอนเมฆเป็นสีส้ม)
- ไปที่ SSL/TLS ตั้งเป็น Flexible
- ตรวจสอบว่าเข้า `https://YOUR_DOMAIN/api/line/status` ได้

## ตั้งค่าใน LINE Developers
- เปิด Use Webhook
- Webhook URL: `https://YOUR_DOMAIN/api/line/webhook`
- กด Verify ให้ขึ้น Success
- ตั้ง Channel access token และ Channel secret ลงไฟล์ `.env`

## .env ที่ต้องมี
- `LINE_CHANNEL_ACCESS_TOKEN=...`
- `LINE_CHANNEL_SECRET=...`

## ทดสอบการทำงาน
- สถานะบอท: GET `https://YOUR_DOMAIN/api/line/status`
- อีเวนต์จำลอง: POST `https://YOUR_DOMAIN/api/line/webhook` ด้วย JSON ของ LINE
- สร้างลิงก์เพิ่มเพื่อน/QR: GET `https://YOUR_DOMAIN/api/line/link_info?project_id=YOUR_PROJECT_ID`
