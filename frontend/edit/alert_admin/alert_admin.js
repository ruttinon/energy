
const API = "/api/alert";

// ============================================================
// DOM Elements
// ============================================================
const ruleTableEl = document.getElementById("ruleTable");
const liveAlertListEl = document.getElementById("liveAlertList");
const sumCriticalEl = document.getElementById("sumCritical");
const sumWarningEl = document.getElementById("sumWarning");
const sumInfoEl = document.getElementById("sumInfo");
const sumTotalEl = document.getElementById("sumTotal");

let readingsCache = {};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Safe fetch with JSON parsing
 */
async function fetchJson(url, opts = {}) {
    try {
        const res = await fetch(url, opts);
        const txt = await res.text();
        try { 
            return JSON.parse(txt); 
        } catch { 
            return txt; 
        }
    } catch (e) {
        console.error("fetchJson error", url, e);
        return null;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get severity color class
 */
function colorSeverity(s) {
    if (s === "critical") return "text-red-600";
    if (s === "warn" || s === "warning") return "text-yellow-500";
    return "text-blue-500";
}

// ============================================================
// READINGS & PARAMETERS
// ============================================================

/**
 * Load readings.json and extract parameter list
 */
async function loadReadingsAndParams() {
    try {
        const js = await fetchJson(`${API}/readings`);
        if (!js || js.status !== "ok") {
            readingsCache = {};
            populateParamDropdown([]);
            return;
        }

        readingsCache = js.data || {};
        const params = new Set();

        Object.values(readingsCache).forEach(dev => {
            if (typeof dev === "object") {
                Object.keys(dev).forEach(k => {
                    if (k === "timestamp" || k.toLowerCase() === "device_id") return;
                    params.add(k);
                });
            }
        });

        populateParamDropdown([...params].sort());

    } catch (err) {
        console.error("loadReadingsAndParams error:", err);
    }
}

/**
 * Populate parameter dropdown with categories
 */
function populateParamDropdown(list) {
    const sel = document.getElementById("rule_param");
    if (!sel) return;
    
    sel.innerHTML = "<option value=''>-- เลือก Parameter --</option>";

    const catMap = { 
        Voltage: [], 
        Current: [], 
        Power: [], 
        Energy: [], 
        Frequency: [], 
        Other: [] 
    };

    list.forEach(p => {
        const x = p.toLowerCase();
        if (x.includes("volt")) catMap.Voltage.push(p);
        else if (x.includes("current") || x.includes("amp")) catMap.Current.push(p);
        else if (x.includes("power")) catMap.Power.push(p);
        else if (x.includes("energy") || x.includes("kwh")) catMap.Energy.push(p);
        else if (x.includes("freq")) catMap.Frequency.push(p);
        else catMap.Other.push(p);
    });

    Object.keys(catMap).forEach(cat => {
        if (!catMap[cat].length) return;
        const g = document.createElement("optgroup");
        g.label = cat;
        catMap[cat].forEach(item => {
            const o = document.createElement("option");
            o.value = item;
            o.textContent = item;
            g.appendChild(o);
        });
        sel.appendChild(g);
    });
}

// ============================================================
// ALERT RULES MANAGEMENT
// ============================================================

/**
 * Load and render all alert rules
 */
async function loadRules() {
    try {
        const rules = await fetchJson(`${API}/rules`);
        if (!Array.isArray(rules)) {
            ruleTableEl.innerHTML = `<p class="text-gray-500">โหลดกฎไม่สำเร็จ</p>`;
            return;
        }

        ruleTableEl.innerHTML = rules.length ? "" : `<p class="text-gray-500">ยังไม่มีกฎแจ้งเตือน</p>`;

        rules.forEach(r => {
            const rJSON = JSON.stringify(r).replace(/'/g, "\\'");
            ruleTableEl.innerHTML += `
            <div class="p-3 border rounded-lg bg-gray-50 flex justify-between items-center animate-fadeIn">
                <div>
                    <div class="font-bold">${escapeHtml(r.rule_name || r.metric)}</div>
                    <div class="text-sm text-gray-600">
                        ${r.metric} ${r.operator} ${r.threshold} |
                        <span class="${colorSeverity(r.severity)} font-semibold">${r.severity}</span>
                    </div>
                    <div class="text-xs text-gray-500">${escapeHtml(r.message)}</div>
                </div>
                <div class="flex gap-2 items-center">
                    <label class="flex items-center text-sm">
                        <input type="checkbox" ${r.is_active ? "checked" : ""} 
                            onchange="toggleRule(${r.id}, this.checked)">
                        เปิดใช้
                    </label>
                    <button onclick='openRuleModal(${rJSON})'
                        class="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600">
                        แก้ไข
                    </button>
                    <button onclick="deleteRule(${r.id})"
                        class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                        ลบ
                    </button>
                </div>
            </div>`;
        });

    } catch (err) {
        console.error("loadRules error:", err);
        ruleTableEl.innerHTML = `<p class="text-gray-500">เกิดข้อผิดพลาดโหลดกฎ</p>`;
    }
}

/**
 * Open rule modal for create/edit
 */
function openRuleModal(rule = null) {
    const modal = document.getElementById("ruleModal");
    if (!modal) return;
    modal.classList.remove("hidden");

    loadReadingsAndParams();

    if (rule) {
        document.getElementById("ruleModalTitle").innerText = "แก้ไขกฎ";
        document.getElementById("rule_id").value = rule.id || "";
        document.getElementById("rule_name").value = rule.rule_name || rule.metric || "";
        document.getElementById("rule_param").value = rule.metric || "";
        document.getElementById("rule_operator").value = rule.operator || ">";
        document.getElementById("rule_threshold").value = rule.threshold || "";
        document.getElementById("rule_severity").value = rule.severity || "info";
        document.getElementById("rule_message").value = rule.message || "";
    } else {
        document.getElementById("ruleForm").reset();
        document.getElementById("rule_id").value = "";
        document.getElementById("ruleModalTitle").innerText = "เพิ่มกฎใหม่";
    }
}

/**
 * Close rule modal
 */
function closeRuleModal() {
    const modal = document.getElementById("ruleModal");
    if (!modal) return;
    modal.classList.add("hidden");
}

/**
 * Save rule (create or update)
 */
async function saveRule() {
    try {
        const id = document.getElementById("rule_id").value;
        const rule = {
            rule_name: document.getElementById("rule_name").value.trim(),
            metric: document.getElementById("rule_param").value,
            operator: document.getElementById("rule_operator").value,
            threshold: Number(document.getElementById("rule_threshold").value || 0),
            severity: document.getElementById("rule_severity").value,
            message: document.getElementById("rule_message").value.trim(),
            is_active: true
        };

        if (!rule.metric || !rule.message) {
            alert("กรุณากรอก Parameter และ Message");
            return;
        }

        const url = id ? `${API}/rules/update/${id}` : `${API}/rules/add`;
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rule)
        });

        closeRuleModal();
        await loadRules();
        
    } catch (e) {
        console.error("saveRule error:", e);
        alert("บันทึกกฎไม่สำเร็จ");
    }
}

/**
 * Delete rule
 */
async function deleteRule(id) {
    try {
        if (!confirm("ต้องการลบกฎนี้ใช่ไหม?")) return;
        
        await fetch(`${API}/rules/delete/${id}`, { method: "DELETE" });
        await loadRules();
        
    } catch (e) {
        console.error("deleteRule error:", e);
        alert("ลบกฎไม่สำเร็จ");
    }
}

/**
 * Toggle rule active status
 */
async function toggleRule(id, active) {
    try {
        await fetch(`${API}/rules/update/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: active })
        });
    } catch (e) {
        console.error("toggleRule error:", e);
    }
}

// ============================================================
// LIVE ALERTS
// ============================================================

/**
 * Group alerts by convertor -> device -> metric
 */
function groupLiveAlerts(alerts) {
    const map = {};
    alerts.forEach(a => {
        const conv = a.convertor_id || "UNKNOWN";
        const dev = a.device_id || "UNKNOWN";
        const key = `${a.metric}_${a.threshold}_${a.message}`;
        
        if (!map[conv]) map[conv] = {};
        if (!map[conv][dev]) map[conv][dev] = {};
        if (!map[conv][dev][key]) map[conv][dev][key] = { ...a, count: 0 };
        
        map[conv][dev][key].count++;
    });
    return map;
}

/**
 * Render live alerts table
 */
function renderLiveTable(grouped) {
    const box = document.getElementById("liveAlertList");
    if (!box) return;
    
    let html = "";
    let total = 0;

    Object.keys(grouped).forEach(conv => {
        html += `
        <div class="mt-3 p-2 bg-red-100 border-l-4 border-red-600 rounded animate-fadeIn">
            <div class="font-bold text-red-700 text-lg">Convertor: ${escapeHtml(conv)}</div>
        </div>`;
        
        Object.keys(grouped[conv]).forEach(dev => {
            html += `
            <div class="mt-2 p-2 bg-blue-100 border-l-4 border-blue-600 rounded animate-fadeIn">
                <div class="font-bold text-blue-700 text-md">Device: ${escapeHtml(dev)}</div>
            </div>
            <table class="w-full text-sm mb-4 border">
                <thead>
                    <tr class="bg-gray-200">
                        <th class="p-1 border">Metric</th>
                        <th class="p-1 border">Value</th>
                        <th class="p-1 border">Threshold</th>
                        <th class="p-1 border">Message</th>
                        <th class="p-1 border">Time</th>
                        <th class="p-1 border">Count</th>
                    </tr>
                </thead>
                <tbody>`;
                
            Object.values(grouped[conv][dev]).forEach(a => {
                total += a.count;
                let sev = (a.severity || "").toLowerCase();
let bg;

if (sev === "critical") bg = "bg-red-50";
else if (sev === "warn" || sev === "warning") bg = "bg-yellow-50";
else bg = "bg-blue-50"; // info และกรณีอื่น

                html += `
                <tr class="${bg}">
                    <td class="p-1 border">${escapeHtml(a.metric)}</td>
                    <td class="p-1 border">${a.value}</td>
                    <td class="p-1 border">${a.threshold}</td>
                    <td class="p-1 border">${escapeHtml(a.message)}</td>
                    <td class="p-1 border">${escapeHtml(a.time)}</td>
                    <td class="p-1 border text-center font-bold text-red-600">x${a.count}</td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
        });
    });

    box.innerHTML = html || `<p class="text-gray-500">ไม่มีการแจ้งเตือน</p>`;
    
    const badge = document.getElementById("liveBadge");
    if (badge) badge.textContent = total;
}

/**
 * Load live alerts from all devices
 */
async function loadLiveAlerts() {
    try {
        await loadReadingsAndParams();
        const readings = readingsCache || {};
        const all = [];

        for (const deviceId of Object.keys(readings)) {
            const data = readings[deviceId];
            if (!data) continue;
            
            try {
                const res = await fetch(`${API}/check`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ device: deviceId, data })
                });
                
                const alerts = await res.json();
                if (Array.isArray(alerts)) {
                    alerts.forEach(a => all.push(a));
                }
            } catch (e) {
                console.warn(`Check failed for ${deviceId}:`, e);
            }
        }

        const grouped = groupLiveAlerts(all);
        renderLiveTable(grouped);

        // Update summary cards
        let critical = 0, warn = 0, info = 0;
        all.forEach(a => {
            const sev = (a.severity || "").toLowerCase();
if (sev === "critical") critical++;
else if (sev === "warn" || sev === "warning") warn++;
else if (sev === "info") info++;

        });
        
        if (sumCriticalEl) sumCriticalEl.textContent = critical;
        if (sumWarningEl) sumWarningEl.textContent = warn;
        if (sumInfoEl) sumInfoEl.textContent = info;
        if (sumTotalEl) sumTotalEl.textContent = all.length;

    } catch (err) {
        console.error("loadLiveAlerts error:", err);
    }
}

// ============================================================
// ALERT HISTORY
// ============================================================

/**
 * Group alert history logs
 */
function groupAlerts(logs) {
    const map = {};
    logs.forEach(raw => {
        const l = {
            convertor_id: raw.convertor_id || raw.convertor_name || "UNKNOWN",
            device_id: raw.device_id || raw.device_name || "UNKNOWN",
            metric: raw.metric || raw.rule_name || "-",
            value: raw.value !== undefined ? raw.value : (raw.reading_value !== undefined ? raw.reading_value : "-"),
            threshold: raw.threshold !== undefined ? raw.threshold : (raw.rule_threshold !== undefined ? raw.rule_threshold : "-"),
            message: raw.message || "",
            severity: (raw.severity || "info").toLowerCase(),
            time: raw.time || raw.timestamp || ""
        };

        const conv = l.convertor_id || "UNKNOWN";
        const dev = l.device_id || "UNKNOWN";
        const key = `${l.metric}_${l.threshold}_${l.message}`;

        if (!map[conv]) map[conv] = {};
        if (!map[conv][dev]) map[conv][dev] = {};
        if (!map[conv][dev][key]) map[conv][dev][key] = { ...l, count: 0 };

        map[conv][dev][key].count++;
    });
    return map;
}

/**
 * Render alert history table
 */
function renderHistoryTable(grouped) {
    const box = document.getElementById("alertHistory");
    if (!box) return;
    
    let html = "";
    let totalCount = 0;

    Object.keys(grouped).forEach(conv => {
        html += `
        <div class="mt-3 p-2 bg-red-100 border-l-4 border-red-600 rounded">
            <div class="font-bold text-red-700 text-lg">Convertor: ${escapeHtml(conv)}</div>
        </div>`;
        
        Object.keys(grouped[conv]).forEach(dev => {
            html += `
            <div class="mt-2 p-2 bg-blue-100 border-l-4 border-blue-600 rounded">
                <div class="font-bold text-blue-700 text-md">Device: ${escapeHtml(dev)}</div>
            </div>
            <table class="w-full text-sm mb-4 border">
                <thead>
                    <tr class="bg-gray-200">
                        <th class="p-1 border">Metric</th>
                        <th class="p-1 border">Value</th>
                        <th class="p-1 border">Threshold</th>
                        <th class="p-1 border">Message</th>
                        <th class="p-1 border">Time</th>
                        <th class="p-1 border">Count</th>
                    </tr>
                </thead>
                <tbody>`;
                
            Object.values(grouped[conv][dev]).forEach(l => {
                totalCount += l.count;
                const sev = (l.severity || "info").toLowerCase();
                const bg = sev === "critical" ? "bg-red-50" :
                          (sev === "warn" || sev === "warning") ? "bg-yellow-50" : "bg-blue-50";

                const metric = l.metric ?? "-";
                const value = l.value ?? "-";
                const threshold = l.threshold ?? "-";
                const message = l.message ?? "";
                const time = l.time ?? "";

                html += `
                <tr class="${bg}">
                    <td class="p-1 border">${escapeHtml(metric)}</td>
                    <td class="p-1 border">${escapeHtml(String(value))}</td>
                    <td class="p-1 border">${escapeHtml(String(threshold))}</td>
                    <td class="p-1 border">${escapeHtml(message)}</td>
                    <td class="p-1 border">${escapeHtml(time)}</td>
                    <td class="p-1 border text-center font-bold text-red-600">x${l.count}</td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
        });
    });

    box.innerHTML = html;
    
    const badge = document.getElementById("historyBadge");
    if (badge) badge.textContent = totalCount;
}

/**
 * Load alert history
 */
async function loadHistory() {
    try {
        const logs = await fetchJson(`${API}/logs`);
        
        if (!Array.isArray(logs) || logs.length === 0) {
            document.getElementById("alertHistory").innerHTML = 
                `<p class="text-gray-500">ยังไม่มีประวัติแจ้งเตือน</p>`;
            const badge = document.getElementById("historyBadge");
            if (badge) badge.textContent = "0";
            return;
        }
        
        const grouped = groupAlerts(logs);
        renderHistoryTable(grouped);
        
    } catch (err) {
        console.error("loadHistory error:", err);
    }
}

/**
 * Export history to CSV
 */
async function exportHistory() {
    try {
        const logs = await fetchJson(`${API}/logs`);
        
        if (!Array.isArray(logs) || logs.length === 0) {
            alert("ยังไม่มีข้อมูลประวัติให้ export");
            return;
        }
        
        let csv = "convertor,device,metric,value,threshold,severity,message,time\n";
        logs.forEach(raw => {
            const l = {
                convertor: raw.convertor_id || raw.convertor_name || "",
                device: raw.device_id || raw.device_name || "",
                metric: raw.metric || raw.rule_name || "",
                value: raw.value !== undefined ? raw.value : (raw.reading_value !== undefined ? raw.reading_value : ""),
                threshold: raw.threshold !== undefined ? raw.threshold : (raw.rule_threshold !== undefined ? raw.rule_threshold : ""),
                severity: (raw.severity || "").toLowerCase(),
                message: raw.message || "",
                time: raw.time || raw.timestamp || ""
            };

            const msg = String(l.message).replace(/"/g, '""');
            csv += `${l.convertor},${l.device},${l.metric},${l.value},${l.threshold},${l.severity},"${msg}",${l.time}\n`;
        });
        
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `alert_history_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
    } catch (e) {
        console.error("exportHistory error:", e);
        alert("Export ไม่สำเร็จ");
    }
}

/**
 * Clear all alert history
 */
async function clearHistory() {
    if (!confirm("ต้องการล้างประวัติแจ้งเตือนทั้งหมดใช่ไหม?")) return;
    
    try {
        const res = await fetch(`${API}/logs/clear`, { method: "POST" });
        
        if (res.ok) {
            document.getElementById("alertHistory").innerHTML = 
                `<p class="text-gray-500">ประวัติถูกลบแล้ว</p>`;
            
            const badge = document.getElementById("historyBadge");
            if (badge) badge.textContent = "0";
            
            const liveBadge = document.getElementById("liveBadge");
            if (liveBadge) liveBadge.textContent = "0";
        } else {
            alert(`ล้างประวัติไม่สำเร็จ: ${res.status}`);
        }
        
    } catch (e) {
        console.error("clearHistory error:", e);
        alert("ล้างประวัติไม่สำเร็จ");
    }
}

/**
 * Apply filters (placeholder for future implementation)
 */
function applyFilter() {
    loadLiveAlerts();
    loadHistory();
}

// ============================================================
// DEVICE STATUS MONITOR
// ============================================================

/**
 * Load device status from API
 */
async function loadDeviceStatus() {
    try {
        const res = await fetch(`${API}/device/status`);
        
        if (!res.ok) {
            console.error(`HTTP Error: ${res.status}`);
            return null;
        }
        
        const data = await res.json();
        
        if (data.error) {
            console.error("API Error:", data.error);
            return null;
        }
        
        return data;
        
    } catch (e) {
        console.error("loadDeviceStatus error:", e);
        return null;
    }
}

// ============================================================
// UPTIME REPORT
// ============================================================

/**
 * Load uptime/downtime report
 */
async function loadUptimeReport() {
    try {
        const res = await fetch(`${API}/device/uptime_report`);
        const data = await res.json();
        
        if (data.status !== "ok") {
            console.error("Failed to load uptime report");
            return;
        }
        
        renderUptimeReport(data.report, data.summary);
        
    } catch (err) {
        console.error("loadUptimeReport error:", err);
    }
}

/**
 * Render uptime report
 */
function renderUptimeReport(report, summary) {
    const container = document.getElementById("uptimeReportContainer");
    if (!container) return;
    
    let html = `
    <div class="mb-4 p-3 bg-blue-50 border-l-4 border-blue-600 rounded">
        <div class="font-bold text-blue-700">📊 Summary</div>
        <div class="text-sm text-gray-700 mt-2">
            <div>Total Devices: <b>${summary.total_devices}</b></div>
            <div>Total Offline Events: <b class="text-red-600">${summary.total_offline_events}</b></div>
            <div>Total Online Events: <b class="text-green-600">${summary.total_online_events}</b></div>
        </div>
    </div>`;
    
    report.forEach(dev => {
        const lastOffline = dev.last_offline;
        const lastOnline = dev.last_online;
        
        html += `
        <div class="mb-4 p-3 bg-white border rounded-lg shadow animate-fadeIn">
            <div class="font-bold text-lg text-gray-800 mb-2">🖥️ ${escapeHtml(dev.device)}</div>
            
            <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                <div class="p-2 bg-red-50 rounded">
                    <div class="text-red-700 font-semibold">Offline Events</div>
                    <div class="text-2xl font-bold text-red-600">${dev.total_offline}</div>
                </div>
                <div class="p-2 bg-green-50 rounded">
                    <div class="text-green-700 font-semibold">Online Events</div>
                    <div class="text-2xl font-bold text-green-600">${dev.total_online}</div>
                </div>
            </div>
            
            ${lastOffline ? `
            <div class="mb-2 p-2 bg-red-50 border-l-4 border-red-600 rounded">
                <div class="font-semibold text-red-700">🔴 Last Offline</div>
                <div class="text-xs text-gray-600">Time: ${escapeHtml(lastOffline.time)}</div>
                <div class="text-xs text-gray-700">${escapeHtml(lastOffline.details)}</div>
            </div>` : ''}
            
            ${lastOnline ? `
            <div class="p-2 bg-green-50 border-l-4 border-green-600 rounded">
                <div class="font-semibold text-green-700">🟢 Last Online</div>
                <div class="text-xs text-gray-600">Time: ${escapeHtml(lastOnline.time)}</div>
                <div class="text-xs text-gray-700">${escapeHtml(lastOnline.details)}</div>
            </div>` : ''}
            
            <details class="mt-2">
                <summary class="cursor-pointer text-sm text-blue-600 hover:underline">
                    📜 View Recent Events (${dev.events.length})
                </summary>
                <div class="mt-2 space-y-1">
                    ${dev.events.map(e => `
                        <div class="text-xs p-2 ${e.event.includes('Offline') ? 'bg-red-50' : 'bg-green-50'} rounded">
                            <b>${escapeHtml(e.time)}</b> - ${escapeHtml(e.event)}<br>
                            <span class="text-gray-600">${escapeHtml(e.details)}</span>
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>`;
    });
    
    container.innerHTML = html || `<p class="text-gray-500">ไม่มีข้อมูล</p>`;
}
function renderDeviceStatusTable(data) {
    const tbody = document.getElementById("deviceStatusTableBody");
    const badge = document.getElementById("statusBadgeOnline") || document.getElementById("statusBadge");

    if (!tbody) return;

    // ถ้าไม่มีข้อมูลหรือ Error
    if (!data || Object.keys(data).length === 0) {
        tbody.innerHTML = `
        <tr>
            <td colspan="5" class="p-4 text-center text-gray-500">
                ⚠️ ไม่สามารถโหลดข้อมูลอุปกรณ์ได้
            </td>
        </tr>`;
        
        // แก้ไขจุดที่ 2: เช็คว่ามี badge จริงไหมก่อนกำหนดค่า
        if (badge) badge.textContent = "0";
        return;
    }

    tbody.innerHTML = "";
    const keys = Object.keys(data);
    if (badge) badge.textContent = keys.length;

    // เรียงตาม Convertor ID
    const sorted = keys.sort((a, b) => {
        const convA = data[a]?.convertor_id || "";
        const convB = data[b]?.convertor_id || "";
        return convA.localeCompare(convB);
    });

    let html = "";
    sorted.forEach(deviceId => {
        const d = data[deviceId];
        if (!d) return;
        const statusText = d.online ? "ONLINE" : "OFFLINE";
        const statusClass = d.online ? "status-online" : "status-offline";
        const statusIcon = d.online ? "🟢" : "🔴";
        const convertorId = d.convertor_id || "Unknown";
        const deviceName = d.device_name || deviceId;
        const ipAddress = d.ip || "-";
        const lastUpdate = d.last_seen || "-";
        const offlineSince = d.offline_since || null;
        const offlineReason = d.offline_reason || null;
        const onlineReason = d.online_reason || null;

        html += `
        <tr class="animate-fadeIn">
            <td class="p-3 border border-gray-200 bg-gray-50 font-mono">${escapeHtml(convertorId)}</td>
            <td class="p-3 border border-gray-200 font-semibold">${escapeHtml(deviceName)}</td>
            <td class="p-3 border border-gray-200 font-mono text-gray-600">${escapeHtml(ipAddress)}</td>
            <td class="p-3 border border-gray-200 text-xs text-gray-600">
                ${escapeHtml(lastUpdate)}
                ${offlineSince ? `<div class="text-red-600 mt-1">ตั้งแต่: ${escapeHtml(offlineSince)}</div>` : ''}
                ${offlineReason ? `<div class="text-red-500">เหตุผล: ${escapeHtml(offlineReason)}</div>` : ''}
                ${onlineReason && !offlineSince ? `<div class="text-green-600 mt-1">เหตุผล: ${escapeHtml(onlineReason)}</div>` : ''}
            </td>
            <td class="p-3 border border-gray-200 text-center"><span class="${statusClass}">${statusIcon} ${statusText}</span></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

async function refreshDeviceStatus() {
    if (refreshDeviceStatus._loading) return;
    refreshDeviceStatus._loading = true;
    try {
        const status = await loadDeviceStatus();
        if (status) {
            renderDeviceStatusTable(status);
        }
    } finally {
        refreshDeviceStatus._loading = false;
    }
}

// เรียกครั้งแรก
refreshDeviceStatus();

// Auto-refresh ทุก 5 วินาที
setInterval(refreshDeviceStatus, 5000);
// เรียกตอน Load หน้า
loadUptimeReport();

// Auto-refresh ทุก 30 วินาที
setInterval(loadUptimeReport, 30000);
// ===========================================================
// backHome helper (just in case)
function backHome() {
    // change this path if your dashboard is elsewhere
    window.location.href = "/";
}

// ===========================================================
// AUTO REFRESH
// ===========================================================
loadRules();
loadReadingsAndParams();
loadLiveAlerts();
loadHistory();

setInterval(loadLiveAlerts, 5000);
setInterval(loadHistory, 10000);
setInterval(loadReadingsAndParams, 15000);
