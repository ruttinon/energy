/**
 * 🎨 Excel Quick Editor - แก้ไขเทมเพลตแบบง่ายๆ ไม่ต้องเข้าใจ Excel
 * ========================================================================
 * Version 2.0 - Optimized & Stable
 */

"use strict";

(function () {
    console.log("🎨 Excel Quick Editor v2.0 Loaded");

    const SAMPLE_DATA = {
        device_id: "DEVICE001",
        device_name: "เครื่องวัดไฟฟ้า A",
        convertor_name: "Convertor 1",
        date: "2025-11-21",
        meter_prev: "1000.00",
        meter_now: "1123.45",
        used: "123.45",
        price_per_unit: "5.00",
        money: "617.25",
        total_money: "617.25",
        total_used: "123.45",
        month_total_units: "3456.78",
        month_total_money: "17283.90"
    };

    let currentSheet = null;
    let isDirty = false;
    let currentTemplateId = null;

    // ============================================
    // INIT QUICK EDITOR
    // ============================================
    async function initQuickEditor(templateId) {
        const editorArea = document.getElementById("excelPreview");
        if (!editorArea) {
            console.error("❌ excelPreview container not found");
            return;
        }

        currentTemplateId = templateId;
        console.log("🔄 Loading template:", templateId);

        editorArea.innerHTML = `
            <div style="text-align:center; padding:50px; color:#666;">
                <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                <p>กำลังโหลดเทมเพลต...</p>
            </div>
        `;

        try {
            const url = `/api/report/excel/template/${templateId}/content`;
            console.log("📡 Fetching:", url);

            const res = await fetch(url);
            console.log("📥 Response status:", res.status);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const json = await res.json();
            console.log("📦 Received:", json);

            if (json.status !== "ok") {
                throw new Error(json.msg || "Unknown error");
            }

            // Initialize sheet data
            if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
                console.warn("⚠️ Empty data, creating new sheet");
                currentSheet = createEmptySheet(20, 10);
            } else {
                currentSheet = normalizeSheet(json.data);
            }

            console.log(`✅ Loaded: ${currentSheet.length} rows x ${currentSheet[0].length} cols`);

            // Render Editor
            renderEditorUI(editorArea);
            bindAllEvents();
            updateLivePreview();

        } catch (err) {
            console.error("❌ Error:", err);
            editorArea.innerHTML = `
                <div style="text-align:center; padding:50px; color:#ff6b6b;">
                    <h3>❌ เกิดข้อผิดพลาด</h3>
                    <p>${err.message}</p>
                    <button onclick="location.reload()" style="padding:10px 20px; background:#007bff; color:white; border:none; border-radius:6px; cursor:pointer; margin-top:20px;">
                        🔄 ลองใหม่อีกครั้ง
                    </button>
                </div>
            `;
        }
    }

    // ============================================
    // CREATE EMPTY SHEET
    // ============================================
    function createEmptySheet(rows, cols) {
        const sheet = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push("");
            }
            sheet.push(row);
        }
        return sheet;
    }

    // ============================================
    // NORMALIZE SHEET DATA
    // ============================================
    function normalizeSheet(data) {
        if (!Array.isArray(data)) return createEmptySheet(20, 10);

        // Find max columns
        let maxCols = 0;
        for (let row of data) {
            if (Array.isArray(row) && row.length > maxCols) {
                maxCols = row.length;
            }
        }

        // Ensure minimum size
        maxCols = Math.max(maxCols, 10);
        const minRows = Math.max(data.length, 20);

        // Normalize all rows
        const normalized = [];
        for (let r = 0; r < minRows; r++) {
            const row = [];
            const sourceRow = data[r];

            for (let c = 0; c < maxCols; c++) {
                if (sourceRow && Array.isArray(sourceRow) && c < sourceRow.length) {
                    row.push(sourceRow[c] || "");
                } else {
                    row.push("");
                }
            }
            normalized.push(row);
        }

        return normalized;
    }

    // ============================================
    // RENDER EDITOR UI
    // ============================================
    function renderEditorUI(container) {
        container.innerHTML = `
            <div style="display: flex; height: 600px; gap: 15px;">
                
                <!-- Left Panel: Variables -->
                <div style="width: 250px; background: #f8f9fa; border-radius: 8px; padding: 15px; overflow-y: auto;">
                    <h4 style="color: #333; margin-top: 0; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                        🏷️ Variables
                    </h4>
                    <p style="color: #666; font-size: 12px; margin-bottom: 15px;">
                        คลิกเพื่อคัดลอก หรือลากไปวางในตาราง
                    </p>
                    <div id="variablePalette">
                        ${renderVariablePalette()}
                    </div>
                </div>

                <!-- Center: Spreadsheet View -->
                <div style="flex: 1; background: white; border-radius: 8px; padding: 15px; overflow: auto; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0;">
                        <div>
                            <h4 style="color: #333; margin: 0;">📊 Template Grid</h4>
                            <small style="color: #666;">แถว: <span id="rowCount">0</span> | คอลัมน์: <span id="colCount">0</span></small>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="addRowBtn" class="btn-sm btn-primary">➕ แถว</button>
                            <button id="addColBtn" class="btn-sm btn-primary">➕ คอลัมน์</button>
                            <button id="clearGridBtn" class="btn-sm btn-secondary">🗑️ ล้าง</button>
                        </div>
                    </div>
                    <div id="spreadsheetContainer" style="flex: 1; overflow: auto; border: 1px solid #dee2e6; border-radius: 6px;">
                        <!-- Grid will be rendered here -->
                    </div>
                </div>

                <!-- Right Panel: Preview -->
                <div style="width: 300px; background: #f8f9fa; border-radius: 8px; padding: 15px; overflow-y: auto; display: flex; flex-direction: column;">
                    <h4 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
                        👁️ Live Preview
                    </h4>
                    <div id="livePreview" style="flex: 1; background: white; border-radius: 6px; padding: 12px; margin-top: 10px; font-size: 11px; font-family: monospace; overflow: auto;">
                        <div style="color: #999;">เริ่มต้นแก้ไขเพื่อดู Preview</div>
                    </div>
                    <div style="margin-top: 15px; flex-shrink: 0;">
                        <button id="applyChangesBtn" class="btn-primary" style="width: 100%;">
                            💾 บันทึกการเปลี่ยนแปลง
                        </button>
                    </div>
                </div>

            </div>

            <style>
                .loading-spinner {
                    display: inline-block;
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(0,123,255,0.2);
                    border-top-color: #007bff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .btn-sm {
                    padding: 8px 14px;
                    font-size: 13px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: 600;
                }
                .btn-primary {
                    background: #007bff;
                    color: white;
                }
                .btn-primary:hover {
                    background: #0056b3;
                    transform: translateY(-1px);
                }
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                .btn-secondary:hover {
                    background: #545b62;
                }
                .var-chip {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 10px 14px;
                    margin: 5px 0;
                    border-radius: 8px;
                    font-size: 12px;
                    font-family: monospace;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: block;
                    user-select: none;
                    text-align: center;
                }
                .var-chip:hover {
                    transform: translateX(5px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                .var-chip:active {
                    transform: scale(0.95);
                }
                .grid-cell {
                    border: 1px solid #dee2e6;
                    padding: 4px 8px;
                    min-width: 120px;
                    height: 32px;
                    text-align: left;
                    cursor: text;
                    font-size: 13px;
                    white-space: pre;
                    overflow: hidden;
                    outline: none;
                    background: white;
                }
                .grid-cell:hover {
                    background: #e3f2fd;
                }
                .grid-cell:focus {
                    background: white;
                    border: 2px solid #007bff;
                    box-shadow: 0 0 0 2px rgba(0,123,255,0.1);
                }
                .grid-cell.has-variable {
                    background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
                    font-weight: 600;
                    color: #1b5e20;
                }
                .grid-header {
                    background: #f8f9fa;
                    font-weight: 600;
                    color: #495057;
                    text-align: center;
                    padding: 6px;
                    border: 1px solid #dee2e6;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                #spreadsheetContainer table {
                    border-collapse: collapse;
                    width: auto;
                }
            </style>
            
            <div style="margin-top:10px; padding:12px; background:#fff3cd; border:1px solid #ffeeba; color:#856404; font-size:12px; border-radius:6px;">
                ⚠️ <strong>คำแนะนำ:</strong> ใช้ Editor นี้สำหรับวางตัวแปรเท่านั้น สำหรับการจัดรูปแบบ (สี, ฟอนต์) ควรทำใน Excel ก่อน Upload
            </div>
        `;

        // Render the grid
        renderGrid();
        updateStats();
    }

    // ============================================
    // RENDER VARIABLE PALETTE
    // ============================================
    function renderVariablePalette() {
        const categories = {
            "📊 Basic Info": ["device_id", "device_name", "convertor_name", "date"],
            "📈 Meter Readings": ["meter_prev", "meter_now", "used"],
            "💰 Billing": ["price_per_unit", "money", "total_money"],
            "📅 Summary": ["total_used", "month_total_units", "month_total_money"]
        };

        let html = "";
        for (const [category, vars] of Object.entries(categories)) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h5 style="color: #495057; font-size: 13px; margin-bottom: 10px; font-weight: 600;">${category}</h5>
                    ${vars.map(v => `
                        <div class="var-chip" draggable="true" data-variable="${v}" title="คลิกเพื่อคัดลอก หรือลากไปวาง">
                            {{${v}}}
                        </div>
                    `).join("")}
                </div>
            `;
        }
        return html;
    }

    // ============================================
    // RENDER GRID
    // ============================================
    function renderGrid() {
        const container = document.getElementById("spreadsheetContainer");
        if (!container || !currentSheet) return;

        const colHeaders = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        const rows = currentSheet.length;
        const cols = currentSheet[0].length;

        console.log(`📊 Rendering: ${rows} rows x ${cols} cols`);

        let html = `<table>`;

        // Header Row
        html += "<tr><th class='grid-header' style='width: 50px;'></th>";
        for (let c = 0; c < cols; c++) {
            const header = c < 26 ? colHeaders[c] : `A${colHeaders[c - 26]}`;
            html += `<th class='grid-header'>${header}</th>`;
        }
        html += "</tr>";

        // Data Rows
        for (let r = 0; r < rows; r++) {
            html += `<tr><th class='grid-header'>${r + 1}</th>`;
            for (let c = 0; c < cols; c++) {
                const value = currentSheet[r][c] || "";
                const hasVar = value.includes("{{");
                const escaped = escapeHtml(value);
                html += `
                    <td class='grid-cell ${hasVar ? "has-variable" : ""}'
                        data-row='${r}'
                        data-col='${c}'
                        contenteditable='true'>${escaped}</td>
                `;
            }
            html += "</tr>";
        }

        html += "</table>";
        container.innerHTML = html;
    }

    // ============================================
    // BIND ALL EVENTS
    // ============================================
    function bindAllEvents() {
        bindVariableEvents();
        bindGridEvents();
        bindButtonEvents();
    }

    function bindVariableEvents() {
        document.querySelectorAll(".var-chip").forEach(chip => {
            // Drag start
            chip.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", e.target.dataset.variable);
                e.target.style.opacity = "0.5";
            });

            chip.addEventListener("dragend", (e) => {
                e.target.style.opacity = "1";
            });

            // Click to copy
            chip.addEventListener("click", (e) => {
                const variable = e.target.dataset.variable;
                const text = `{{${variable}}}`;
                navigator.clipboard.writeText(text).then(() => {
                    const original = e.target.textContent;
                    e.target.textContent = "✓ คัดลอกแล้ว!";
                    e.target.style.background = "#28a745";
                    setTimeout(() => {
                        e.target.textContent = original;
                        e.target.style.background = "";
                    }, 1000);
                });
            });
        });
    }

    function bindGridEvents() {
        const container = document.getElementById("spreadsheetContainer");
        if (!container) return;

        // Drag over
        container.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        });

        // Drop
        container.addEventListener("drop", (e) => {
            e.preventDefault();
            const target = e.target.closest(".grid-cell");
            if (!target) return;

            const variable = e.dataTransfer.getData("text/plain");
            if (!variable) return;

            const row = parseInt(target.dataset.row);
            const col = parseInt(target.dataset.col);

            const newValue = `{{${variable}}}`;
            currentSheet[row][col] = newValue;
            target.textContent = newValue;
            target.classList.add("has-variable");

            isDirty = true;
            updateLivePreview();
            console.log(`✅ Variable '${variable}' added to [${row},${col}]`);
        });

        // Cell edit
        container.addEventListener("input", (e) => {
            const target = e.target.closest(".grid-cell");
            if (!target) return;

            const row = parseInt(target.dataset.row);
            const col = parseInt(target.dataset.col);
            const newValue = target.textContent;

            currentSheet[row][col] = newValue;

            // Update styling
            if (newValue.includes("{{")) {
                target.classList.add("has-variable");
            } else {
                target.classList.remove("has-variable");
            }

            isDirty = true;
            updateLivePreview();
        });
    }

    function bindButtonEvents() {
        // Add Row
        const addRowBtn = document.getElementById("addRowBtn");
        if (addRowBtn) {
            addRowBtn.addEventListener("click", () => {
                if (!currentSheet) {
                    currentSheet = createEmptySheet(1, 10);
                } else {
                    const cols = currentSheet[0].length;
                    const newRow = [];
                    for (let i = 0; i < cols; i++) {
                        newRow.push("");
                    }
                    currentSheet.push(newRow);
                }

                console.log(`✅ Added row. Total: ${currentSheet.length} rows`);
                isDirty = true;
                renderGrid();
                bindGridEvents();
                updateStats();
                updateLivePreview();
            });
        }

        // Add Column
        const addColBtn = document.getElementById("addColBtn");
        if (addColBtn) {
            addColBtn.addEventListener("click", () => {
                if (!currentSheet || currentSheet.length === 0) {
                    currentSheet = createEmptySheet(20, 1);
                } else {
                    for (let row of currentSheet) {
                        row.push("");
                    }
                }

                console.log(`✅ Added column. Total: ${currentSheet[0].length} cols`);
                isDirty = true;
                renderGrid();
                bindGridEvents();
                updateStats();
                updateLivePreview();
            });
        }

        // Clear Grid
        const clearBtn = document.getElementById("clearGridBtn");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                if (!confirm("⚠️ ล้างข้อมูลทั้งหมดใช่หรือไม่?")) return;

                if (currentSheet) {
                    for (let r = 0; r < currentSheet.length; r++) {
                        for (let c = 0; c < currentSheet[r].length; c++) {
                            currentSheet[r][c] = "";
                        }
                    }
                }

                isDirty = true;
                renderGrid();
                bindGridEvents();
                updateLivePreview();
                console.log("🗑️ Grid cleared");
            });
        }

        // Save
        const saveBtn = document.getElementById("applyChangesBtn");
        if (saveBtn) {
            saveBtn.addEventListener("click", saveChanges);
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================
    function updateStats() {
        const rowCountEl = document.getElementById("rowCount");
        const colCountEl = document.getElementById("colCount");

        if (rowCountEl && currentSheet) {
            rowCountEl.textContent = currentSheet.length;
        }
        if (colCountEl && currentSheet && currentSheet[0]) {
            colCountEl.textContent = currentSheet[0].length;
        }
    }

    // ============================================
    // UPDATE LIVE PREVIEW
    // ============================================
    function updateLivePreview() {
        const preview = document.getElementById("livePreview");
        if (!preview || !currentSheet) return;

        let html = "<table style='width: 100%; border-collapse: collapse;'>";

        const maxPreviewRows = Math.min(currentSheet.length, 50);

        for (let r = 0; r < maxPreviewRows; r++) {
            const row = currentSheet[r];
            html += "<tr>";

            for (let c = 0; c < row.length; c++) {
                let cell = row[c] || "";
                let displayValue = cell;

                // Replace variables with sample data
                for (const [key, value] of Object.entries(SAMPLE_DATA)) {
                    if (displayValue.includes(`{{${key}}}`)) {
                        displayValue = displayValue.replace(`{{${key}}}`, `<strong style='color: #28a745;'>${value}</strong>`);
                    }
                }

                const style = cell.includes("{{") ? "background: #e8f5e9;" : "";
                html += `<td style='border: 1px solid #dee2e6; padding: 4px; font-size: 10px; ${style}'>${displayValue || "&nbsp;"}</td>`;
            }
            html += "</tr>";
        }

        if (currentSheet.length > maxPreviewRows) {
            html += `<tr><td colspan="100" style="text-align:center; padding:10px; color:#666; font-style:italic;">... และอีก ${currentSheet.length - maxPreviewRows} แถว</td></tr>`;
        }

        html += "</table>";
        preview.innerHTML = html;
    }

    // ============================================
    // SAVE CHANGES
    // ============================================
    async function saveChanges() {
        if (!isDirty) {
            alert("ℹ️ ไม่มีการเปลี่ยนแปลง");
            return;
        }

        if (!currentTemplateId) {
            alert("❌ ไม่พบ Template ID");
            return;
        }

        const btn = document.getElementById("applyChangesBtn");
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ กำลังบันทึก...";
        btn.disabled = true;

        try {
            const url = `/api/report/excel/template/${currentTemplateId}/save`;
            console.log("💾 Saving to:", url);

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: currentSheet })
            });

            const json = await res.json();
            console.log("📥 Save response:", json);

            if (res.ok && json.status === "ok") {
                alert("✅ บันทึกสำเร็จ!");
                isDirty = false;
                btn.innerHTML = "✅ บันทึกแล้ว";
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            } else {
                throw new Error(json.msg || "Save failed");
            }
        } catch (err) {
            console.error("❌ Save error:", err);
            alert("❌ บันทึกล้มเหลว: " + err.message);
            btn.innerHTML = originalText;
        } finally {
            btn.disabled = false;
        }
    }

    // ============================================
    // UTILS
    // ============================================
    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // EXPORT
    // ============================================
    window.initQuickEditor = initQuickEditor;

    console.log("✅ Excel Quick Editor ready");

})();