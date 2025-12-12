"""
สคริปต์สร้าง Sample Templates สำหรับระบบ Billing
รันคำสั่ง: python create_sample_templates.py
"""

import os
import json

# กำหนด path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "data", "report_templates")

os.makedirs(TEMPLATE_DIR, exist_ok=True)


def save_template(template_id, tpl):
    """บันทึก template ลง JSON file"""
    path = os.path.join(TEMPLATE_DIR, f"{template_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tpl, f, ensure_ascii=False, indent=2)
    print(f"✅ Created: {template_id}.json")


def create_billing_template():
    """สร้าง template สำหรับใบเสร็จรับเงิน"""
    tpl = {
        "template_id": "billing_basic",
        "name": "ใบเสร็จรับเงิน (พื้นฐาน)",
        "desc": "เทมเพลตสำหรับออกใบเสร็จค่าไฟฟ้า",
        "pages": [
            {
                "w": 794,
                "h": 1123,
                "background": None
            }
        ],
        "elements": [
            # Header - ชื่อบริษัท
            {
                "page": 0,
                "type": "text",
                "html": "<h1 style='text-align:center;color:#ff0033;'>ใบเสร็จรับเงิน</h1>",
                "left": 50,
                "top": 40,
                "width": 694,
                "height": 60,
                "style": {
                    "fontSize": "28px",
                    "fontFamily": "Kanit",
                    "color": "#ff0033",
                    "textAlign": "center",
                    "fontWeight": "bold"
                }
            },
            
            # เลขที่ใบเสร็จ
            {
                "page": 0,
                "type": "text",
                "html": "<b>เลขที่:</b> BILL-{{device_id}}-{{date}}",
                "left": 50,
                "top": 120,
                "width": 694,
                "height": 30,
                "style": {
                    "fontSize": "16px",
                    "fontFamily": "Kanit",
                    "color": "#000000"
                }
            },
            
            # วันที่
            {
                "page": 0,
                "type": "text",
                "html": "<b>วันที่:</b> {{date}}",
                "left": 50,
                "top": 160,
                "width": 694,
                "height": 30,
                "style": {
                    "fontSize": "16px",
                    "fontFamily": "Kanit",
                    "color": "#000000"
                }
            },
            
            # ข้อมูลอุปกรณ์
            {
                "page": 0,
                "type": "text",
                "html": """
                <div style='padding:20px; background:#f5f5f5; border-radius:8px;'>
                    <h3 style='color:#333; margin:0 0 10px 0;'>ข้อมูลอุปกรณ์</h3>
                    <p style='margin:5px 0;'><b>รหัสอุปกรณ์:</b> {{device_id}}</p>
                    <p style='margin:5px 0;'><b>ชื่ออุปกรณ์:</b> {{device_name}}</p>
                </div>
                """,
                "left": 50,
                "top": 210,
                "width": 694,
                "height": 120,
                "style": {
                    "fontSize": "14px",
                    "fontFamily": "Kanit",
                    "color": "#000000",
                    "background": "#f5f5f5"
                }
            },
            
            # ตารางรายการ
            {
                "page": 0,
                "type": "table",
                "html": """
                <table border='1' style='width:100%; border-collapse:collapse; margin-top:20px;'>
                    <thead style='background:#ff0033; color:white;'>
                        <tr>
                            <th style='padding:12px; text-align:left;'>รายการ</th>
                            <th style='padding:12px; text-align:right;'>จำนวน</th>
                            <th style='padding:12px; text-align:right;'>หน่วย</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style='padding:10px;'>พลังงานไฟฟ้า</td>
                            <td style='padding:10px; text-align:right;'>{{energy}}</td>
                            <td style='padding:10px; text-align:right;'>kWh</td>
                        </tr>
                        <tr>
                            <td style='padding:10px;'>ราคาต่อหน่วย</td>
                            <td style='padding:10px; text-align:right;'>{{price_per_unit}}</td>
                            <td style='padding:10px; text-align:right;'>บาท/kWh</td>
                        </tr>
                    </tbody>
                </table>
                """,
                "left": 50,
                "top": 360,
                "width": 694,
                "height": 200,
                "style": {
                    "fontSize": "14px",
                    "fontFamily": "Kanit",
                    "color": "#000000"
                }
            },
            
            # ยอดรวม
            {
                "page": 0,
                "type": "text",
                "html": """
                <div style='background:#ff0033; color:white; padding:20px; border-radius:8px; text-align:right;'>
                    <h2 style='margin:0;'>ยอดรวมทั้งสิ้น: {{total_money}} บาท</h2>
                </div>
                """,
                "left": 50,
                "top": 600,
                "width": 694,
                "height": 80,
                "style": {
                    "fontSize": "24px",
                    "fontFamily": "Kanit",
                    "color": "#ffffff",
                    "background": "#ff0033",
                    "fontWeight": "bold"
                }
            },
            
            # Footer
            {
                "page": 0,
                "type": "text",
                "html": "<p style='text-align:center; color:#666;'>ขอบคุณที่ใช้บริการ | AE Energy System</p>",
                "left": 50,
                "top": 1000,
                "width": 694,
                "height": 40,
                "style": {
                    "fontSize": "12px",
                    "fontFamily": "Kanit",
                    "color": "#666666",
                    "textAlign": "center"
                }
            }
        ]
    }
    
    save_template("billing_basic", tpl)


def create_summary_template():
    """สร้าง template สำหรับสรุปรายวัน"""
    tpl = {
        "template_id": "summary",
        "name": "สรุปรายวัน",
        "desc": "เทมเพลตสำหรับสรุปค่าไฟรายวัน",
        "pages": [
            {
                "w": 794,
                "h": 1123,
                "background": None
            }
        ],
        "elements": [
            # Header
            {
                "page": 0,
                "type": "text",
                "html": "<h1 style='text-align:center; color:#ff0033;'>สรุปค่าไฟฟ้า</h1>",
                "left": 50,
                "top": 40,
                "width": 694,
                "height": 60,
                "style": {
                    "fontSize": "28px",
                    "fontFamily": "Kanit",
                    "color": "#ff0033",
                    "textAlign": "center",
                    "fontWeight": "bold"
                }
            },
            
            # วันที่
            {
                "page": 0,
                "type": "text",
                "html": "<p style='text-align:center;'><b>วันที่:</b> {{date}}</p>",
                "left": 50,
                "top": 120,
                "width": 694,
                "height": 30,
                "style": {
                    "fontSize": "16px",
                    "fontFamily": "Kanit",
                    "color": "#000000",
                    "textAlign": "center"
                }
            },
            
            # ยอดรวม
            {
                "page": 0,
                "type": "text",
                "html": """
                <div style='display:flex; gap:20px; justify-content:space-around;'>
                    <div style='background:#4CAF50; color:white; padding:30px; border-radius:12px; flex:1; text-align:center;'>
                        <h3 style='margin:0 0 10px 0;'>พลังงานรวม</h3>
                        <h2 style='margin:0;'>{{total_energy}} kWh</h2>
                    </div>
                    <div style='background:#ff0033; color:white; padding:30px; border-radius:12px; flex:1; text-align:center;'>
                        <h3 style='margin:0 0 10px 0;'>ยอดเงินรวม</h3>
                        <h2 style='margin:0;'>{{total_cost}} บาท</h2>
                    </div>
                </div>
                """,
                "left": 50,
                "top": 180,
                "width": 694,
                "height": 150,
                "style": {
                    "fontSize": "18px",
                    "fontFamily": "Kanit"
                }
            }
        ]
    }
    
    save_template("summary", tpl)


def set_default_template():
    """ตั้งค่า default template"""
    default_file = os.path.join(TEMPLATE_DIR, "default_template.json")
    with open(default_file, "w", encoding="utf-8") as f:
        json.dump({"template_id": "billing_basic"}, f, ensure_ascii=False, indent=2)
    print("✅ Set default template: billing_basic")


if __name__ == "__main__":
    print("🚀 Creating sample templates...")
    print()
    
    create_billing_template()
    create_summary_template()
    set_default_template()
    
    print()
    print("🎉 Sample templates created successfully!")
    print()
    print("📁 Location:", TEMPLATE_DIR)
    print("📄 Templates:")
    print("   - billing_basic.json (ใบเสร็จรับเงิน)")
    print("   - summary.json (สรุปรายวัน)")
    print()
    print("✨ You can now:")
    print("   1. Go to Billing Admin")
    print("   2. Click '🎨 จัดการเทมเพลต'")
    print("   3. Start generating bills!")