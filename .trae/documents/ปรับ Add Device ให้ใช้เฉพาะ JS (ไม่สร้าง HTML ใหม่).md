## แนวทาง

* ไม่สร้างไฟล์ HTML ใหม่สำหรับ Add Device และไม่แก้ไขโครงสร้างไฟล์ HTML เดิมด้วยมือ

* ใช้ไฟล์ `frontend/edit/add_device.js` เพียงไฟล์เดียวในการ:

  * แทรกปุ่มเมนู “⚙️ Add Device” เข้า Sidebar แบบ runtime

  * ขยายฟังก์ชัน `showPage('add_device')` แบบ runtime โดยไม่แก้โค้ดใน `index.html`

  * สร้าง UI สองฝั่งและ popup ทั้งหมดด้วยการสร้าง DOM ผ่าน JS

* ใช้ API backend ที่มีอยู่ (`/api/templates/devices`, `/api/templates/protocols`, `/api/projects/{pid}/config`) เพื่อโหลด/บันทึกข้อมูลต่อโปรเจค

## รายละเอียดการทำงาน JS

* Bootstrap เมื่อหน้า `index.html` โหลด:

  1. ตรวจ `active project` ด้วย `GET /api/active` เพื่อระบุโปรเจคปัจจุบัน
  2. โหลดรายการโปรโตคอลและเทมเพลตอุปกรณ์
  3. โหลด/normalize `ConfigDevice.json` ของโปรเจคให้มีคีย์ `converters`
  4. แทรกปุ่มเมนู “⚙️ Add Device” เข้า `<div.sidebar-section> PROJECT` และ bind กับ `showPage('add_device')`

* เพิ่มตัวจัดการหน้า:

  * สร้าง `window.__originalShowPage = showPage` ถ้ามี แล้วห่อด้วยฟังก์ชันใหม่ที่รองรับคีย์ `'add_device'` โดยไม่แก้ไฟล์เดิม

  * เรียก `renderAddDevicePage()` เมื่อเปิดหน้า

* ฟังก์ชัน renderAddDevicePage():

  * สร้างโครง HTML ฝั่งซ้าย/ขวาแบบ inline ลงใน `#content-area` (ไม่แตะไฟล์ HTML)

  * ฝั่งซ้าย: dropdown โปรโตคอล, ปุ่ม “+ Add Converter”, รายการ converters + ปุ่ม Edit ต่อ item

  * ฝั่งขวา: ค้นหา/กรองผู้ผลิต และรายชื่อ template พร้อมปุ่ม “Add to Converter”

* Popup Converter:

  * สร้าง `<div class="popup-overlay">` และฟอร์มภายในด้วย JS แล้ว append เข้า `document.body`

  * กรอก/แก้ไข Name, Description, Converter address (host), Port โดยดึง default จากเทมเพลตโปรโตคอล

* Persistence:

  * `POST /api/projects/{pid}/config` บันทึก `{converters:[...]}` แยกต่อโปรเจค

  * อุปกรณ์ที่เพิ่มบันทึกเป็น `{manufacturer, model, name, template_ref}`

## การจัดสไตล์

* ใช้คลาสที่มีอยู่ใน `edit.css` ให้มากที่สุด (เช่น `.popup`, `.popup-buttons`)

* ถ้าจำเป็น เพิ่มสไตล์เล็กน้อยแบบ inline ผ่าน `<style>` สร้างโดย JS เท่านั้น (ไม่แก้ไฟล์ CSS)

## การลบไฟล์ที่ไม่ใช้

* ลบ `frontend/edit/add_device.html` เพื่อให้โครงสร้างตรงตามข้อกำหนด “เขียนแค่ JS พอ”

## การทดสอบ

1. รันเซิร์ฟเวอร์และล็อกอิน
2. เห็นปุ่ม “⚙️ Add Device” โผล่ใน Sidebar โดยไม่แก้ไฟล์ HTML
3. เปิดหน้า Add Device → สร้าง/แก้ไข Converter และเพิ่ม Device/Meter ได้
4. ตรวจ `projects/<pid>/ConfigDevice.json` มีอัปเดตคีย์ `converters` ตามการแก้ไข

