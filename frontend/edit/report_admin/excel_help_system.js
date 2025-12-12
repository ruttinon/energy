/**
 * 💡 Excel Template Help System
 * =======================================
 * ระบบช่วยเหลือแบบ Interactive สำหรับผู้ใช้
 * - คำแนะนำทีละขั้นตอน
 * - ตัวอย่างการใช้งาน
 * - Video Tutorial
 * - FAQ
 */

"use strict";

(function () {
    console.log("💡 Excel Help System Loaded");

    const TUTORIALS = {
        upload: {
            title: "วิธีอัปโหลดเทมเพลต",
            steps: [
                {
                    text: "คลิกปุ่ม '⬆️ Upload Template'",
                    image: null,
                    tip: "ปุ่มอยู่ที่มุมขวาบนของหน้า"
                },
                {
                    text: "เลือกไฟล์ .xlsx จากเครื่องของคุณ",
                    image: null,
                    tip: "รองรับเฉพาะ Excel 2007 ขึ้นไป (.xlsx)"
                },
                {
                    text: "คลิก 'Upload' และรอสักครู่",
                    image: null,
                    tip: "ระบบจะตรวจสอบและบันทึกไฟล์อัตโนมัติ"
                },
                {
                    text: "เทมเพลตของคุณพร้อมใช้งานแล้ว!",
                    image: null,
                    tip: "คุณจะเห็นเทมเพลตในรายการ"
                }
            ]
        },
        edit: {
            title: "วิธีแก้ไขเทมเพลต",
            steps: [
                {
                    text: "คลิกปุ่ม '✏️ Edit' ในการ์ดเทมเพลต",
                    image: null,
                    tip: "จะเปิดหน้า Editor ขึ้นมา"
                },
                {
                    text: "เลือกตัวแปรจากด้านซ้าย",
                    image: null,
                    tip: "ลากตัวแปรไปวางในตารางได้เลย"
                },
                {
                    text: "แก้ไขข้อความในเซลล์ได้ทันที",
                    image: null,
                    tip: "คลิกที่เซลล์และพิมพ์ได้เลย"
                },
                {
                    text: "ดู Preview ด้านขวา",
                    image: null,
                    tip: "ระบบจะแสดงผลลัพธ์แบบ Real-time"
                },
                {
                    text: "คลิก '💾 Save Changes' เมื่อเสร็จ",
                    image: null,
                    tip: "การเปลี่ยนแปลงจะถูกบันทึกทันที"
                }
            ]
        },
        variables: {
            title: "วิธีใช้ตัวแปร",
            steps: [
                {
                    text: "ตัวแปรคือข้อมูลที่เปลี่ยนได้",
                    image: null,
                    tip: "เช่น ชื่ออุปกรณ์, ยอดเงิน, วันที่"
                },
                {
                    text: "เขียนตัวแปรด้วยรูปแบบ {{ชื่อตัวแปร}}",
                    image: null,
                    tip: "ต้องมีวงเล็บปีกกาคู่ 2 อัน"
                },
                {
                    text: "ตัวอย่าง: {{device_name}}",
                    image: null,
                    tip: "จะถูกแทนที่ด้วยชื่ออุปกรณ์จริง"
                },
                {
                    text: "สามารถใช้ตัวแปรซ้ำได้หลายที่",
                    image: null,
                    tip: "ระบบจะแทนค่าให้อัตโนมัติ"
                }
            ]
        },
        formulas: {
            title: "วิธีใช้สูตร Excel",
            steps: [
                {
                    text: "สามารถใช้สูตร Excel ได้ตามปกติ",
                    image: null,
                    tip: "เช่น =SUM(), =AVERAGE(), =IF()"
                },
                {
                    text: "ใส่ตัวแปรในเซลล์แยก",
                    image: null,
                    tip: "อย่าใส่ตัวแปรในสูตร"
                },
                {
                    text: "ตัวอย่าง: A1={{used}}, B1=A1*5",
                    image: null,
                    tip: "วิธีนี้จะทำงานได้ถูกต้อง"
                },
                {
                    text: "❌ อย่าทำ: =SUM({{used}})",
                    image: null,
                    tip: "สูตรจะไม่ทำงาน"
                }
            ]
        },
        preview: {
            title: "วิธี Preview ผลลัพธ์",
            steps: [
                {
                    text: "คลิกปุ่ม '👁️ Preview'",
                    image: null,
                    tip: "อยู่ในส่วน Editor"
                },
                {
                    text: "ระบบจะสร้างไฟล์ตัวอย่าง",
                    image: null,
                    tip: "ใช้ข้อมูล Sample"
                },
                {
                    text: "ดาวน์โหลดและเปิดด้วย Excel",
                    image: null,
                    tip: "ตรวจสอบว่าถูกต้องหรือไม่"
                },
                {
                    text: "ถ้าไม่ถูกต้อง กลับไปแก้ไข",
                    image: null,
                    tip: "ทำซ้ำจนกว่าจะพอใจ"
                }
            ]
        }
    };

    const FAQ = [
        {
            q: "รองรับไฟล์ Excel เวอร์ชั่นไหนบ้าง?",
            a: "รองรับ .xlsx (Excel 2007 ขึ้นไป) เท่านั้น ไม่รองรับ .xls (Excel 2003)"
        },
        {
            q: "สามารถใช้สูตร Excel ได้หรือไม่?",
            a: "ได้! แต่อย่าใส่ตัวแปรภายในสูตร ให้แยกเป็นเซลล์คนละอัน"
        },
        {
            q: "ตัวแปรใช้ภาษาไทยได้ไหม?",
            a: "ไม่ได้ ตัวแปรต้องเป็นภาษาอังกฤษเท่านั้น เช่น {{device_name}}"
        },
        {
            q: "ทำไมตัวแปรไม่ถูกแทนที่?",
            a: "ตรวจสอบว่าใช้รูปแบบ {{ชื่อตัวแปร}} และไม่มีช่องว่าง"
        },
        {
            q: "สามารถลบเทมเพลตได้หรือไม่?",
            a: "ได้ คลิกปุ่ม 🗑️ ในการ์ดเทมเพลต"
        },
        {
            q: "แก้ไขเทมเพลตแล้วต้อง Upload ใหม่ไหม?",
            a: "ใช่ ต้อง Download แก้ไขใน Excel แล้ว Upload กลับมาใหม่"
        },
        {
            q: "Quick Editor แตกต่างจาก Excel อย่างไร?",
            a: "Quick Editor ใช้งานง่ายกว่า แต่ฟีเจอร์น้อยกว่า Excel แท้"
        },
        {
            q: "สามารถใช้รูปภาพในรายงานได้ไหม?",
            a: "ได้ ใส่รูปใน Excel ตามปกติ ก่อน Upload"
        },
        {
            q: "ข้อมูลจะอัปเดตอัตโนมัติหรือไม่?",
            a: "ใช่ เมื่อสร้างรายงานใหม่ ตัวแปรจะถูกแทนด้วยข้อมูลล่าสุด"
        },
        {
            q: "สามารถแชร์เทมเพลตให้คนอื่นได้ไหม?",
            a: "ได้ ใช้ฟังก์ชัน Download แล้วส่งไฟล์ให้"
        }
    ];

    // ============================================
    // INIT HELP SYSTEM
    // ============================================
    function initHelpSystem() {
        addHelpButton();
        addHelpModal();
    }

    // ============================================
    // ADD HELP BUTTON
    // ============================================
    function addHelpButton() {
        // Add floating help button
        if (document.getElementById("helpFloatingBtn")) return;

        const btn = document.createElement("button");
        btn.id = "helpFloatingBtn";
        btn.innerHTML = "❓";
        btn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            font-size: 28px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.5);
            z-index: 9999;
            transition: all 0.3s ease;
        `;

        btn.onmouseover = () => {
            btn.style.transform = "scale(1.1) rotate(15deg)";
        };
        btn.onmouseout = () => {
            btn.style.transform = "scale(1) rotate(0deg)";
        };

        btn.onclick = () => {
            document.getElementById("helpModal").style.display = "flex";
        };

        document.body.appendChild(btn);
    }

    // ============================================
    // ADD HELP MODAL
    // ============================================
    function addHelpModal() {
        if (document.getElementById("helpModal")) return;

        const modal = document.createElement("div");
        modal.id = "helpModal";
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; max-width: 900px; width: 90%; max-height: 90vh; overflow: auto; padding: 0;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 25px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 24px;">💡 ศูนย์ช่วยเหลือ</h2>
                    <button id="closeHelpBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%;">✖️</button>
                </div>

                <!-- Content -->
                <div style="padding: 30px;">
                    
                    <!-- Tabs -->
                    <div style="display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 15px;">
                        <button class="help-tab active" data-tab="tutorials">📚 คู่มือ</button>
                        <button class="help-tab" data-tab="faq">❓ FAQ</button>
                        <button class="help-tab" data-tab="examples">💡 ตัวอย่าง</button>
                        <button class="help-tab" data-tab="contact">📞 ติดต่อ</button>
                    </div>

                    <!-- Tab Content -->
                    <div id="helpTabContent">
                        ${renderTutorialsTab()}
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        document.getElementById("closeHelpBtn").onclick = () => {
            modal.style.display = "none";
        };

        document.querySelectorAll(".help-tab").forEach(tab => {
            tab.onclick = function () {
                document.querySelectorAll(".help-tab").forEach(t => t.classList.remove("active"));
                this.classList.add("active");

                const tabName = this.dataset.tab;
                const content = document.getElementById("helpTabContent");

                if (tabName === "tutorials") content.innerHTML = renderTutorialsTab();
                else if (tabName === "faq") content.innerHTML = renderFAQTab();
                else if (tabName === "examples") content.innerHTML = renderExamplesTab();
                else if (tabName === "contact") content.innerHTML = renderContactTab();
            };
        });

        // Add styles
        addHelpStyles();
    }

    // ============================================
    // RENDER TABS
    // ============================================
    function renderTutorialsTab() {
        let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">`;

        for (const [key, tutorial] of Object.entries(TUTORIALS)) {
            html += `
                <div class="tutorial-card" onclick="showTutorial('${key}')">
                    <h3 style="color: #667eea; margin-top: 0;">${tutorial.title}</h3>
                    <p style="color: #666; font-size: 14px;">${tutorial.steps.length} ขั้นตอน</p>
                    <button style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; width: 100%;">
                        เริ่มเรียนรู้ →
                    </button>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    function renderFAQTab() {
        let html = `<div style="max-width: 700px; margin: 0 auto;">`;

        FAQ.forEach((item, idx) => {
            html += `
                <div style="margin-bottom: 20px; border-bottom: 1px solid #e0e0e0; padding-bottom: 20px;">
                    <h4 style="color: #333; margin-bottom: 10px;">
                        ${idx + 1}. ${item.q}
                    </h4>
                    <p style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
                        ${item.a}
                    </p>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    function renderExamplesTab() {
        return `
            <div style="max-width: 800px; margin: 0 auto;">
                <h3 style="color: #667eea;">ตัวอย่างการใช้งาน</h3>

                <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h4 style="color: #333;">1. รายงานรายวัน (Daily Report)</h4>
                    <pre style="background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 13px;">
วันที่: {{date}}
อุปกรณ์: {{device_name}}
พลังงานที่ใช้: {{used}} kWh
ค่าไฟ: {{money}} บาท
                    </pre>
                </div>

                <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h4 style="color: #333;">2. สรุปรายเดือน (Monthly Summary)</h4>
                    <pre style="background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 13px;">
เดือน: {{date}}
พลังงานรวม: {{month_total_units}} kWh
ยอดเงินรวม: {{month_total_money}} บาท
จำนวนอุปกรณ์: {{devices.length}} ตัว
                    </pre>
                </div>

                <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h4 style="color: #333;">3. ตารางรายละเอียด (Detail Table)</h4>
                    <pre style="background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 13px;">
| อุปกรณ์ | พลังงาน | ค่าไฟ |
| {{devices.0.device_name}} | {{devices.0.used}} | {{devices.0.money}} |
| {{devices.1.device_name}} | {{devices.1.used}} | {{devices.1.money}} |
| {{devices.2.device_name}} | {{devices.2.used}} | {{devices.2.money}} |
                    </pre>
                </div>
            </div>
        `;
    }

    function renderContactTab() {
        return `
            <div style="max-width: 600px; margin: 0 auto; text-align: center; padding: 40px 0;">
                <h3 style="color: #667eea;">ต้องการความช่วยเหลือเพิ่มเติม?</h3>
                <p style="color: #666; line-height: 1.8; margin: 20px 0;">
                    หากคุณพบปัญหาหรือมีคำถาม<br>
                    สามารถติดต่อทีมสนับสนุนได้ตามช่องทางด้านล่าง
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 40px;">
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 12px;">
                        <div style="font-size: 36px; margin-bottom: 10px;">📧</div>
                        <h4 style="color: #333; margin: 10px 0;">Email</h4>
                        <p style="color: #666; font-size: 14px;">support@example.com</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 12px;">
                        <div style="font-size: 36px; margin-bottom: 10px;">📞</div>
                        <h4 style="color: #333; margin: 10px 0;">โทรศัพท์</h4>
                        <p style="color: #666; font-size: 14px;">02-XXX-XXXX</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 12px;">
                        <div style="font-size: 36px; margin-bottom: 10px;">💬</div>
                        <h4 style="color: #333; margin: 10px 0;">Line</h4>
                        <p style="color: #666; font-size: 14px;">@support</p>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // SHOW TUTORIAL
    // ============================================
    window.showTutorial = function (tutorialKey) {
        const tutorial = TUTORIALS[tutorialKey];
        if (!tutorial) return;

        const content = document.getElementById("helpTabContent");
        let html = `
            <div style="max-width: 700px; margin: 0 auto;">
                <button onclick="document.getElementById('helpTabContent').innerHTML = renderTutorialsTab()" 
                        style="background: #e0e0e0; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-bottom: 20px;">
                    ← กลับ
                </button>
                <h2 style="color: #667eea; margin-bottom: 30px;">${tutorial.title}</h2>
        `;

        tutorial.steps.forEach((step, idx) => {
            html += `
                <div style="background: ${idx % 2 === 0 ? '#f8f9fa' : '#fff'}; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 15px; border-radius: 8px;">
                    <div style="display: flex; gap: 15px; align-items: start;">
                        <div style="background: #667eea; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${idx + 1}
                        </div>
                        <div style="flex: 1;">
                            <h4 style="color: #333; margin: 0 0 8px 0;">${step.text}</h4>
                            <p style="color: #666; font-size: 14px; margin: 0;">
                                💡 ${step.tip}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        content.innerHTML = html;
    };

    // ============================================
    // ADD STYLES
    // ============================================
    function addHelpStyles() {
        if (document.getElementById("help-system-styles")) return;

        const style = document.createElement("style");
        style.id = "help-system-styles";
        style.textContent = `
            .help-tab {
                background: #f8f9fa;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                color: #666;
                transition: all 0.2s ease;
            }
            .help-tab:hover {
                background: #e9ecef;
            }
            .help-tab.active {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .tutorial-card {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            .tutorial-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
                border-color: #667eea;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // EXPORT
    // ============================================
    window.renderTutorialsTab = renderTutorialsTab; // For back button

    // Auto-init
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initHelpSystem);
    } else {
        initHelpSystem();
    }

})();