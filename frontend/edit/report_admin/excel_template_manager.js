/**
 * 📊 Excel Template Manager - ระบบจัดการเทมเพลต Excel Report
 * ============================================================
 * Features:
 * - อัปโหลดไฟล์ .xlsx
 * - ดูรายการเทมเพลตทั้งหมด
 * - แก้ไขเทมเพลตแบบ Interactive
 * - Preview ผลลัพธ์ก่อนใช้งานจริง
 * - ดาวน์โหลดเทมเพลตที่แก้ไขแล้ว
 */

"use strict";

(function () {
    console.log("📊 Excel Template Manager Loaded");

    const API_BASE = "/api/report/excel"; // Adjusted to match backend router prefix if needed, or keep generic /api/excel if strictly following backend 
    // Backend router in excel_router.py starts with router = APIRouter(). 
    // It is likely mounted at /api/report or /api/excel. 
    // Looking at add_report.js: /api/report/excel/templates
    // So API_BASE should be /api/report/excel

    let currentTemplateId = null;
    let templates = [];

    // ============================================
    // RENDER: แสดงผลใน Container ที่กำหนด
    // ============================================
    async function renderTemplateManager(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div style="padding: 20px;">
                
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                    <div>
                        <h2 style="margin: 0; color: #63d1ff; font-size: 24px;">📊 Report Templates</h2>
                        <p style="margin: 5px 0 0 0; color: #9bd0e8; font-size: 14px;">จัดการเทมเพลต Excel สำหรับรายงานต่างๆ</p>
                    </div>
                    <button id="uploadTemplateBtn" class="btn-primary">
                        ⬆️ Upload Template
                    </button>
                </div>

                <!-- Template List Section -->
                <div style="background: #0d1f2f; border: 1px solid #29465c; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #63d1ff; margin-top: 0;">📁 รายการเทมเพลต</h3>
                    <div id="templateList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
                        <div style="text-align: center; padding: 40px; color: #666;">
                            กำลังโหลด...
                        </div>
                    </div>
                </div>

                <!-- Editor Section (Hidden by default) -->
                <div id="editorSection" style="display: none;">
                    
                    <!-- Editor Header -->
                    <div style="background: #0d1f2f; border: 1px solid #29465c; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="color: #63d1ff; margin: 0;">✏️ แก้ไขเทมเพลต: <span id="editorTitle">-</span></h3>
                            <div style="display: flex; gap: 10px;">
                                <button id="previewTemplateBtn" class="btn-secondary">👁️ Preview</button>
                                <button id="downloadTemplateBtn" class="btn-secondary">⬇️ Download</button>
                                <button id="closeEditorBtn" class="btn-danger">✖️ Close</button>
                            </div>
                        </div>
                    </div>

                    <!-- Variable Helper -->
                    <div style="background: #0d1f2f; border: 1px solid #29465c; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h4 style="color: #9bd0e8; margin-top: 0;">🏷️ ตัวแปรที่ใช้ได้ (ลากไปใส่ในตารางได้)</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;" id="variableList">
                            <div style="color: #666;">กำลังโหลด...</div>
                        </div>
                    </div>

                    <!-- Excel Preview/Editor -->
                    <div style="background: #0d1f2f; border: 1px solid #29465c; border-radius: 12px; padding: 20px;">
                        <h4 style="color: #9bd0e8; margin-top: 0;">📋 Template Editor</h4>
                        <div id="excelPreview" style="background: white; border-radius: 8px; padding: 20px; min-height: 400px; overflow: auto; color:black;">
                            <p style="text-align: center; color: #999;">เลือกเทมเพลตเพื่อเริ่มแก้ไข</p>
                        </div>
                    </div>
                </div>

                <!-- Upload Modal -->
                <div id="uploadModal" class="modal" style="display: none;">
                    <div class="modal-content" style="max-width: 500px;">
                        <h3 style="color: #63d1ff; margin-top: 0;">⬆️ Upload Excel Template</h3>
                        <div style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 10px; color: #9bd0e8;">เลือกไฟล์ .xlsx:</label>
                            <input type="file" id="fileInput" accept=".xlsx" style="width: 100%; padding: 10px; background: #0f2232; border: 1px solid #355e75; border-radius: 6px; color: white;">
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button id="cancelUploadBtn" class="btn-secondary">Cancel</button>
                            <button id="confirmUploadBtn" class="btn-primary">Upload</button>
                        </div>
                    </div>
                </div>

                <!-- Preview Modal -->
                <div id="previewModal" class="modal" style="display: none;">
                    <div class="modal-content" style="max-width: 90%; max-height: 90vh; overflow: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #63d1ff; margin: 0;">👁️ Preview: <span id="previewTitle">-</span></h3>
                            <button id="closePreviewBtn" class="btn-danger">✖️</button>
                        </div>
                        <div id="previewContent" style="background: white; border-radius: 8px; padding: 20px; min-height: 500px; color:black;">
                            กำลังโหลด...
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Add Styles
        addStyles();

        // Bind Events
        bindEvents();

        // Load Templates
        await loadTemplates();
    }

    // ============================================
    // STYLES
    // ============================================
    function addStyles() {
        if (document.getElementById("excel-template-styles")) return;

        const style = document.createElement("style");
        style.id = "excel-template-styles";
        style.textContent = `
            .btn-primary {
                background: linear-gradient(135deg, #007bff, #0056b3);
                border: none;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 123, 255, 0.4);
            }
            .btn-secondary {
                background: #355e75;
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .btn-secondary:hover {
                background: #4a7a94;
            }
            .btn-danger {
                background: #a33;
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .btn-danger:hover {
                background: #c44;
            }
            .template-card {
                background: #113246;
                border: 1px solid #2c6b8a;
                border-radius: 12px;
                padding: 20px;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .template-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 20px rgba(0, 123, 255, 0.3);
                border-color: #007bff;
            }
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            .modal-content {
                background: #0d1f2f;
                border: 1px solid #63d1ff;
                border-radius: 12px;
                padding: 30px;
            }
            .variable-tag {
                background: rgba(0, 123, 255, 0.2);
                border: 1px solid #007bff;
                padding: 8px 12px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 13px;
                color: #63d1ff;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .variable-tag:hover {
                background: rgba(0, 123, 255, 0.4);
                transform: scale(1.05);
            }
            code {
                font-family: 'Courier New', monospace;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // EVENT BINDING
    // ============================================
    function bindEvents() {
        // Upload Button
        document.getElementById("uploadTemplateBtn")?.addEventListener("click", () => {
            document.getElementById("uploadModal").style.display = "flex";
        });

        // Cancel Upload
        document.getElementById("cancelUploadBtn")?.addEventListener("click", () => {
            document.getElementById("uploadModal").style.display = "none";
        });

        // Confirm Upload
        document.getElementById("confirmUploadBtn")?.addEventListener("click", uploadTemplate);

        // Close Editor
        document.getElementById("closeEditorBtn")?.addEventListener("click", () => {
            document.getElementById("editorSection").style.display = "none";
            currentTemplateId = null;
        });

        // Preview
        document.getElementById("previewTemplateBtn")?.addEventListener("click", previewTemplate);

        // Close Preview
        document.getElementById("closePreviewBtn")?.addEventListener("click", () => {
            document.getElementById("previewModal").style.display = "none";
        });

        // Download
        document.getElementById("downloadTemplateBtn")?.addEventListener("click", downloadTemplate);

        // Variable Tag Click (Copy to clipboard)
        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("variable-tag")) {
                const text = e.target.textContent;
                navigator.clipboard.writeText(`{{${text}}}`);

                // Show feedback
                const original = e.target.textContent;
                e.target.textContent = "✓ Copied!";
                setTimeout(() => {
                    e.target.textContent = original;
                }, 1000);
            }
        });
    }

    // ============================================
    // LOAD TEMPLATES
    // ============================================
    async function loadTemplates() {
        try {
            const res = await fetch(`${API_BASE}/templates`); // Corrected URL
            const data = await res.json();

            if (data.templates) {
                templates = data.templates;
                renderTemplateList();
            } else {
                showError("Failed to load templates");
            }
        } catch (err) {
            console.error("Load templates error:", err);
            showError("Network error: " + err.message);
        }
    }

    // ============================================
    // RENDER TEMPLATE LIST
    // ============================================
    function renderTemplateList() {
        const container = document.getElementById("templateList");
        if (!container) return;

        if (templates.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">
                    ยังไม่มีเทมเพลต<br>
                    <small>คลิก "Upload Template" เพื่อเพิ่มเทมเพลต</small>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map(tpl => `
            <div class="template-card" data-id="${tpl.id}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <h4 style="color: #63d1ff; margin: 0 0 8px 0; font-size: 16px;">📄 ${escapeHtml(tpl.filename)}</h4>
                        <p style="margin: 0; color: #9bd0e8; font-size: 12px;">
                            Size: ${formatFileSize(tpl.size)}<br>
                            Modified: ${formatDate(tpl.modified)}
                        </p>
                    </div>
                    <button class="btn-danger" onclick="deleteTemplate('${tpl.id}')" style="padding: 6px 12px; font-size: 12px;">
                        🗑️
                    </button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" onclick="editTemplate('${tpl.id}')" style="flex: 1; padding: 8px; font-size: 13px;">
                        ✏️ Edit
                    </button>
                    <button class="btn-secondary" onclick="downloadTemplateById('${tpl.id}')" style="flex: 1; padding: 8px; font-size: 13px;">
                        ⬇️ Download
                    </button>
                </div>
            </div>
        `).join("");
    }

    // ============================================
    // UPLOAD TEMPLATE
    // ============================================
    async function uploadTemplate() {
        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("กรุณาเลือกไฟล์");
            return;
        }

        if (!file.name.endsWith(".xlsx")) {
            alert("รองรับเฉพาะไฟล์ .xlsx เท่านั้น");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE}/template/upload`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (data.status === "ok") {
                alert("✅ Upload สำเร็จ!");
                document.getElementById("uploadModal").style.display = "none";
                fileInput.value = "";
                await loadTemplates();
            } else {
                alert("❌ Upload ล้มเหลว: " + data.msg);
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("❌ เกิดข้อผิดพลาด");
        }
    }

    // ============================================
    // EDIT TEMPLATE
    // ============================================
    window.editTemplate = async function (templateId) {
        currentTemplateId = templateId;

        document.getElementById("editorSection").style.display = "block";
        document.getElementById("editorTitle").textContent = templateId;

        // Render variables
        renderVariables([
            "device_id", "device_name", "date",
            "meter_prev", "meter_now", "used", "money",
            "total_used", "total_money", "price_per_unit"
        ]);

        // Init Quick Editor
        if (window.initQuickEditor) {
            window.initQuickEditor(templateId);
        } else {
            console.error("Quick Editor not loaded");
            document.getElementById("excelPreview").innerHTML = "Quick Editor module not loaded correctly.";
        }

        // Scroll to editor
        document.getElementById("editorSection").scrollIntoView({ behavior: "smooth" });
    };

    // ============================================
    // LOAD VARIABLES
    // ============================================
    function renderVariables(variables) {
        const container = document.getElementById("variableList");
        if (!container) return;

        if (variables.length === 0) {
            container.innerHTML = `<div style="color: #666;">ไม่พบตัวแปรในเทมเพลต</div>`;
            return;
        }

        container.innerHTML = variables.map(v =>
            `<div class="variable-tag" title="Click to copy">${escapeHtml(v)}</div>`
        ).join("");
    }

    // ============================================
    // PREVIEW TEMPLATE
    // ============================================
    async function previewTemplate() {
        if (!currentTemplateId) return;

        document.getElementById("previewModal").style.display = "flex";
        document.getElementById("previewTitle").textContent = currentTemplateId;
        document.getElementById("previewContent").innerHTML = "กำลังโหลด...";

        // Generate preview with sample data
        const sampleData = {
            device_id: "SAMPLE001",
            device_name: "ตัวอย่างอุปกรณ์",
            date: new Date().toLocaleDateString("th-TH"),
            total_used: 123.45,
            total_money: 617.25,
            price_per_unit: 5.00,
            devices: [
                { device_id: "D1", device_name: "Device 1", used: 45.2, money: 226.00, meter_now: 1234.5 },
                { device_id: "D2", device_name: "Device 2", used: 78.25, money: 391.25, meter_now: 5678.9 }
            ]
        };

        try {
            const res = await fetch(`${API_BASE}/render/excel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    template_id: currentTemplateId,
                    data: sampleData
                })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                // Show download link
                document.getElementById("previewContent").innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h3 style="color: black;">✅ Preview สำเร็จ</h3>
                        <p style="color: #666; margin: 20px 0;">
                            ไฟล์ถูกสร้างเรียบร้อยแล้ว<br>
                            คลิกปุ่มด้านล่างเพื่อดาวน์โหลด
                        </p>
                        <a href="${url}" download="preview_${currentTemplateId}.xlsx" class="btn-primary" style="display: inline-block; text-decoration: none;">
                            ⬇️ Download Preview
                        </a>
                    </div>
                `;
            } else {
                throw new Error("Preview failed");
            }
        } catch (err) {
            console.error("Preview error:", err);
            document.getElementById("previewContent").innerHTML = `
                <div style="text-align: center; padding: 40px; color: #a33;">
                    ❌ เกิดข้อผิดพลาดในการสร้าง Preview
                </div>
            `;
        }
    }

    // ============================================
    // DOWNLOAD TEMPLATE
    // ============================================
    async function downloadTemplate() {
        // window.open(`${API_BASE}/template/download/${currentTemplateId}`, '_blank');
        // Since we don't have download endpoint yet, we skip or impl later.
        // Actually, we can use the same path if backend exposes static files.
        // But let's just alert for now or try generic.
        alert("Feature Download ยังไม่เปิดใช้งานใน Backend");
    }

    window.downloadTemplateById = function (templateId) {
        // window.open(`${API_BASE}/template/download/${templateId}`, '_blank');
        alert("Feature Download ยังไม่เปิดใช้งานใน Backend");
    };

    // ============================================
    // DELETE TEMPLATE
    // ============================================
    window.deleteTemplate = async function (templateId) {
        if (!confirm(`ต้องการลบเทมเพลต "${templateId}" หรือไม่?`)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/template/${templateId}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (data.status === "ok") {
                alert("✅ ลบสำเร็จ");
                await loadTemplates();

                if (currentTemplateId === templateId) {
                    document.getElementById("editorSection").style.display = "none";
                    currentTemplateId = null;
                }
            } else {
                alert("❌ ลบล้มเหลว");
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("❌ เกิดข้อผิดพลาด");
        }
    };

    // ============================================
    // UTILS
    // ============================================
    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (!bytes) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function formatDate(timestamp) {
        if (!timestamp) return "-";
        const date = new Date(timestamp * 1000);
        return date.toLocaleString("th-TH");
    }

    function showError(msg) {
        const container = document.getElementById("templateList");
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #a33; grid-column: 1 / -1;">
                    ❌ ${escapeHtml(msg)}
                </div>
            `;
        }
    }

    // ============================================
    // EXPORT
    // ============================================
    window.renderTemplateManager = renderTemplateManager;

})();