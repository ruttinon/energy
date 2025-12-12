// ===========================================================
// ⚡ UI MONITORING - POWER-STYLE LAYOUT (FIXED VERSION)
// ===========================================================

const __cfgBase = (window.__CONFIG && window.__CONFIG.apiBase && String(window.__CONFIG.apiBase).trim())
  ? String(window.__CONFIG.apiBase).replace(/\/$/, '')
  : '';
const __storedBase = (sessionStorage.getItem('API_BASE') || localStorage.getItem('API_BASE') || '').replace(/\/$/, '');
const API_BASE = (() => {
  const origin = String(window.location.origin).replace(/\/$/, '');
  const candidate = String(__cfgBase || __storedBase || '').replace(/\/$/, '');
  if (!candidate) return origin;
  try {
    const u = new URL(candidate);
    const sameHost = u.hostname === window.location.hostname;
    const samePort = u.port === window.location.port;
    return (sameHost && samePort) ? candidate : origin;
  } catch(e) {
    return origin;
  }
})();

let selectedMode = null;     // Inst / Avg
let selectedType = null;     // I / V / U
let uiInterval = null;       // Auto-update interval
let isUpdating = false;      // ป้องกันการอัปเดตซ้อนทับ
let prevValues = [];         // สำหรับ smooth animation
let isInitialized = false;   // ตรวจสอบขั้นแรก

const statsBuffer = {
  I: { L1: [], L2: [], L3: [], N: [] },
  V: { 'L1-N': [], 'L2-N': [], 'L3-N': [] },
  U: { 'L1-L2': [], 'L2-L3': [], 'L3-L1': [] }
};

const MAX_SAMPLES = 30;

// ===========================================================
// 🛰️ FETCH DATA FROM API
// ===========================================================
async function fetchLiveData(device) {
  try {
    const pid = new URLSearchParams(location.search).get('pid') ||
                (document.getElementById('proj')?.value || '');

    const url = pid
      ? `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`
      : `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?_t=${Date.now()}`;

    let res = await fetch(url, { cache: "no-store" });

    if (res.ok) {
      const js = await res.json();
      return js.latest || null;
    }

    // Fallback to readings API
    const res2 = await fetch(`${API_BASE}/public/projects/${encodeURIComponent(pid)}/readings?_t=${Date.now()}`, { cache: "no-store" });
    if (!res2.ok) return null;

    const j2 = await res2.json();
    const obj = {};
    (j2.items || [])
      .filter(x => String(x.device_id) === String(device))
      .forEach(x => obj[x.parameter] = x.value);

    return Object.keys(obj).length ? obj : null;

  } catch (e) {
    console.error("❌ Fetch error:", e);
    return null;
  }
}

// ===========================================================
// 📊 DRAW VALUE BOXES (Power Module Style)
// ===========================================================
function drawGauges(values = [], labels = [], unit = "") {
  const container = document.getElementById("bar-container");
  if (!container) return;

  if (!values.length) {
    container.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-icon">📊</div>
        <div class="placeholder-text">No data available</div>
        <div class="placeholder-hint">Waiting for device data...</div>
      </div>`;
    return;
  }

  // Create new value boxes
  if (!isInitialized || container.querySelector('.placeholder')) {
    container.innerHTML = "";
    prevValues = [...values];

    values.forEach((v, i) => {
      const wrap = document.createElement("div");
      wrap.className = "value-column";
      wrap.dataset.index = i;

      // Label
      const label = document.createElement("div");
      label.className = "value-label-top";
      label.textContent = labels[i];

      // Value box
      const valueBox = document.createElement("div");
      valueBox.className = "value-display-box";
      valueBox.id = `val-${i}`;
      
      const valueText = document.createElement("div");
      valueText.className = "value-number";
      valueText.textContent = v.toFixed(2);
      
      const unitText = document.createElement("div");
      unitText.className = "value-unit";
      unitText.textContent = unit;
      
      valueBox.appendChild(valueText);
      valueBox.appendChild(unitText);

      wrap.appendChild(label);
      wrap.appendChild(valueBox);
      container.appendChild(wrap);
    });

    isInitialized = true;
  } 
  // Update existing value boxes smoothly
  else {
    values.forEach((v, i) => {
      const valueBox = document.getElementById(`val-${i}`);
      if (!valueBox) return;

      const valueText = valueBox.querySelector('.value-number');
      if (!valueText) return;

      // Smooth interpolation
      const smooth = prevValues[i] + (v - prevValues[i]) * 0.3;
      prevValues[i] = smooth;

      valueText.textContent = smooth.toFixed(2);
    });
  }
}

// ===========================================================
// 📋 RENDER TABLE (Power-style)
// ===========================================================
function renderTable(rows = [], headers = []) {
  const tableContainer = document.getElementById("ui-table-container");
  const infoTable = document.getElementById("info-table");
  if (!tableContainer && !infoTable) return;

  let table = null;
  if (tableContainer) {
    table = tableContainer.querySelector("table");
    if (!table) {
      table = document.createElement("table");
      table.className = "power-table";
      const thead = document.createElement("thead"); thead.className = "pt-header"; table.appendChild(thead);
      const tbody = document.createElement("tbody"); table.appendChild(tbody);
      tableContainer.appendChild(table);
    }
    tableContainer.style.display = rows.length ? "block" : "none";
  } else {
    table = infoTable;
    if (!table.querySelector("thead")) table.appendChild(document.createElement("thead"));
    if (!table.querySelector("tbody")) table.appendChild(document.createElement("tbody"));
  }

  const theadRowHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
  table.querySelector("thead").innerHTML = theadRowHTML;

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "pt-row";
    r.forEach((cellContent, colIdx) => {
      const td = document.createElement("td");
      td.textContent = cellContent;
      if (colIdx === 0) {
        td.style.textAlign = "left";
        td.style.paddingLeft = "20px";
        td.style.fontWeight = "900";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ===========================================================
// 🎯 UPDATE STATUS TEXT
// ===========================================================
function updateStatus(text) {
  const fallback = document.getElementById("ui-status-text");
  if (fallback) { fallback.textContent = text; return; }
  const badge = document.getElementById("status-badge");
  if (badge) {
    const t = badge.querySelector(".status-text");
    if (t) t.textContent = text;
    if (/UPDATING|MODE/.test(text)) badge.classList.add("active");
    else badge.classList.remove("active");
  }
}

// ===========================================================
// 🧭 MAIN UPDATE FUNCTION
// ===========================================================
async function updateUI() {
  if (isUpdating) return;

  let device = localStorage.getItem("selectedDevice");
  if (!device) {
    const pid = new URLSearchParams(location.search).get('pid') || (document.getElementById('proj')?.value || '');
    try {
      const res = await fetch(`${API_BASE}/public/projects/${encodeURIComponent(pid)}/readings?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        const first = (j.items || [])[0];
        if (first && first.device_id) {
          device = String(first.device_id);
          localStorage.setItem('selectedDevice', device);
        }
      }
    } catch(e) {}
  }
  if (!device || !selectedMode || !selectedType) {
    updateStatus("⚡ SELECT MODE AND TYPE");
    return;
  }

  isUpdating = true;
  updateStatus(`⚡ ${selectedMode} MODE — UPDATING...`);

  try {
    const data = await fetchLiveData(device);
    if (!data) {
      updateStatus("⚠️ NO DATA AVAILABLE");
      isUpdating = false;
      return;
    }

    let labels = [];
    let values = [];
    let unit = "";
    let rows = [];
    let title = "";

    // Helper: Push sample to buffer
    const pushSample = (typeKey, lbl, v) => {
      const buf = statsBuffer[typeKey][lbl];
      if (!buf) return;
      buf.push(Number(v) || 0);
      if (buf.length > MAX_SAMPLES) buf.shift();
    };

    // Helper: Generate AVG mode stats rows
    const avgStatsRow = (typeKey, arr) => {
      const nomR = ["Nominal"];
      const avgR = ["Average"];
      const maxR = ["Maximum"];
      const minR = ["Minimum"];
      
      arr.forEach(lbl => {
        const buf = statsBuffer[typeKey][lbl] || [];
        const current = buf.length ? buf[buf.length - 1] : 0;
        const mx = buf.length ? Math.max(...buf) : 0;
        const mn = buf.length ? Math.min(...buf) : 0;
        const ag = buf.length ? buf.reduce((a, b) => a + b, 0) / buf.length : 0;

        const fmt = v => `${v.toFixed(2)} ${unit}`;
        nomR.push(fmt(current));
        avgR.push(fmt(ag));
        maxR.push(fmt(mx));
        minR.push(fmt(mn));
      });
      
      return [nomR, avgR, maxR, minR];
    };

    // Helper: Generate INST mode stats rows
    const instStatsRow = (typeKey, arr) => {
      const instR = ["Inst"];
      const maxR = ["max"];
      const minR = ["min"];
      
      arr.forEach(lbl => {
        const buf = statsBuffer[typeKey][lbl] || [];
        const current = buf.length ? buf[buf.length - 1] : 0;
        const mx = buf.length ? Math.max(...buf) : 0;
        const mn = buf.length ? Math.min(...buf) : 0;

        const fmt = v => `${v.toFixed(2)} ${unit}`;
        instR.push(fmt(current));
        maxR.push(fmt(mx));
        minR.push(fmt(mn));
      });
      
      return [instR, maxR, minR];
    };

    // Helper: Get value from multiple possible keys
    const getValue = (obj, keys) => {
      for (const k of keys) {
        if (obj[k] != null) return Number(obj[k]) || 0;
      }
      return 0;
    };

    // Helper: Smart scaling to expected engineering units
    const smartScale = (v, expected) => {
      const x = Number(v) || 0;
      if (!isFinite(x)) return 0;
      switch (expected) {
        case 'A':
          if (x >= 20000) return x / 1000;      // mA → A
          if (x >= 2000) return x / 10;         // deciAmp → A
          return x;                              // already A
        case 'V220':
          if (x >= 20000) return x / 100;       // centiVolt → V
          if (x >= 2000) return x / 10;         // deciVolt → V
          return x;                              // already V
        case 'V380':
          if (x >= 40000) return x / 100;       // centiVolt → V
          if (x >= 4000) return x / 10;         // deciVolt → V
          return x;                              // already V
        default:
          return x;
      }
    };

    const getNominal = (type) => {
      const cfg = window.__CONFIG || {};
      const lsV = Number(localStorage.getItem('UI_NOMINAL_V'));
      const lsU = Number(localStorage.getItem('UI_NOMINAL_U'));
      if (type === 'V') {
        if (isFinite(lsV) && lsV > 0) return lsV;
        return Number(cfg.nominalVoltageLN) || 220;
      }
      if (type === 'U') {
        if (isFinite(lsU) && lsU > 0) return lsU;
        return Number(cfg.nominalVoltageLL) || 380;
      }
      return 0;
    };

    const avgOfBuffer = (typeKey, lbl) => {
      const buf = statsBuffer[typeKey][lbl] || [];
      if (!buf.length) return 0;
      return buf.reduce((a, b) => a + b, 0) / buf.length;
    };

    // ================================
    // ⚡ CURRENT (I)
    // ================================
    if (selectedType === "I") {
      labels = ["L1", "L2", "L3", "N"];
      values = [
        smartScale(getValue(data, ["Current_L1", "I1", "I_L1", "IL1", "Curr_L1"]), 'A'),
        smartScale(getValue(data, ["Current_L2", "I2", "I_L2", "IL2", "Curr_L2"]), 'A'),
        smartScale(getValue(data, ["Current_L3", "I3", "I_L3", "IL3", "Curr_L3"]), 'A'),
        smartScale(getValue(data, ["Neutral_Current", "Current_N", "IN", "I_N", "INeutral", "Current_Neutral"]), 'A')
      ];
      unit = "A";
      title = "CURRENT (A)";

      labels.forEach((lbl, i) => pushSample("I", lbl, values[i]));
      
      if (selectedMode === 'INST') {
        rows = instStatsRow("I", labels);
      } else {
        rows = avgStatsRow("I", labels);
      }
    }

    // ================================
    // ⚡ PHASE-TO-NEUTRAL (V)
    // ================================
    else if (selectedType === "V") {
      labels = ["L1-N", "L2-N", "L3-N"];
      values = [
        smartScale(getValue(data, ["Voltage_L1", "Voltage_L1_N", "VL1_N", "V1N", "V1", "L1_N", "V_L1_N"]), 'V220'),
        smartScale(getValue(data, ["Voltage_L2", "Voltage_L2_N", "VL2_N", "V2N", "V2", "L2_N", "V_L2_N"]), 'V220'),
        smartScale(getValue(data, ["Voltage_L3", "Voltage_L3_N", "VL3_N", "V3N", "V3", "L3_N", "V_L3_N"]), 'V220')
      ];
      unit = "V";
      title = "PHASE-TO-NEUTRAL VOLTAGE (V)";

      labels.forEach((lbl, i) => pushSample("V", lbl, values[i]));
      
      if (selectedMode === 'INST') {
        rows = instStatsRow("V", labels);
      } else {
        rows = avgStatsRow("V", labels);
      }
    }

    // ================================
    // ⚡ PHASE-TO-PHASE (U)
    // ================================
    else if (selectedType === "U") {
      labels = ["L1-L2", "L2-L3", "L3-L1"];
      values = [
        smartScale(getValue(data, ["Voltage_L1L2", "Voltage_L1_L2", "V12", "VL1_L2", "U12", "V_L1_L2"]), 'V380'),
        smartScale(getValue(data, ["Voltage_L2L3", "Voltage_L2_L3", "V23", "VL2_L3", "U23", "V_L2_L3"]), 'V380'),
        smartScale(getValue(data, ["Voltage_L3L1", "Voltage_L3_L1", "V31", "VL3_L1", "U31", "V_L3_L1"]), 'V380')
      ];
      unit = "V";
      title = "PHASE-TO-PHASE VOLTAGE (V)";

      labels.forEach((lbl, i) => pushSample("U", lbl, values[i]));
      
      if (selectedMode === 'INST') {
        rows = instStatsRow("U", labels);
      } else {
        rows = avgStatsRow("U", labels);
      }
    }

    // Inject deviation row for Voltage types
    if (selectedType === 'V' || selectedType === 'U') {
      const nominal = getNominal(selectedType);
      const fmt = v => `${v.toFixed(2)} ${unit}`;
      if (selectedMode === 'AVG') {
        const nomRow = ["Nominal", ...labels.map(() => fmt(nominal))];
        rows[0] = nomRow;
        const devRow = ["Deviation (%)"];
        labels.forEach((lbl, i) => {
          const val = avgOfBuffer(selectedType === 'V' ? 'V' : 'U', lbl);
          const pct = nominal > 0 ? ((val - nominal) / nominal) * 100 : 0;
          devRow.push(`${pct.toFixed(1)} %`);
        });
        rows.push(devRow);
      } else {
        const devRow = ["Deviation (%)"];
        labels.forEach((lbl, i) => {
          const val = values[i] || 0;
          const pct = nominal > 0 ? ((val - nominal) / nominal) * 100 : 0;
          devRow.push(`${pct.toFixed(1)} %`);
        });
        rows.push(devRow);
      }
    }

    // Render everything
    drawGauges(values, labels, unit);
    renderTable(rows, ["PARAMETER", ...labels]);
    updateStatus(`⚡ ${selectedMode} MODE — ${title}`);

  } catch (e) {
    console.error("❌ Update error:", e);
    updateStatus("❌ UPDATE FAILED");
  }

  isUpdating = false;
}

// ===========================================================
// 🎮 EVENT HANDLERS
// ===========================================================
function setupEventHandlers() {
  document.addEventListener("click", (ev) => {
    const modeBtn = ev.target.closest("[data-mode]");
    const typeBtn = ev.target.closest("[data-type]");

    // Mode selection
    if (modeBtn) {
      document.querySelectorAll("[data-mode]").forEach(x => x.classList.remove("active"));
      modeBtn.classList.add("active");
      selectedMode = /avg/i.test(modeBtn.dataset.mode) ? "AVG" : "INST";
      
      // Reset gauges
      isInitialized = false;
      prevValues = [];
      
      if (selectedType) {
        updateUI();
      } else {
        updateStatus(`⚡ ${selectedMode} MODE — SELECT PARAMETER`);
      }
      updateToolbarState();
    }

    // Type selection
    if (typeBtn) {
      if (!selectedMode) {
        alert("⚠️ Please select MODE first (INST or AVG)");
        return;
      }
      
      document.querySelectorAll("[data-type]").forEach(x => x.classList.remove("active"));
      typeBtn.classList.add("active");
      selectedType = typeBtn.dataset.type;

      // Reset gauges
      isInitialized = false;
      prevValues = [];
      
      updateUI();
    }
  });
}

function updateToolbarState() {
  const disable = !selectedMode;
  const btns = Array.from(document.querySelectorAll('.pbtn.type')).concat(Array.from(document.querySelectorAll('.control-btn.type')));
  btns.forEach(btn => {
    btn.style.pointerEvents = disable ? 'none' : '';
    btn.style.opacity = disable ? '0.5' : '1';
    btn.setAttribute('aria-disabled', disable ? 'true' : 'false');
  });
}

// ===========================================================
// 🕐 INIT UI MODULE
// ===========================================================
function initUI() {
  const host = document.getElementById("dash-content");
  if (!host) {
    setTimeout(initUI, 300);
    return;
  }

  console.log("🚀 UI Module initializing...");

  ensureUIToolbar();
  setupEventHandlers();
  updateStatus("⚡ SELECT MODE AND PARAMETER");

  // Clear any existing interval
  if (uiInterval) {
    clearInterval(uiInterval);
    uiInterval = null;
  }

  // Start auto-update loop
  uiInterval = setInterval(() => {
    if (selectedMode && selectedType) {
      updateUI();
    }
  }, 2000);

  console.log("✅ UI Module initialized");
}

// ===========================================================
// 🔄 REFRESH FUNCTION
// ===========================================================
window.refreshUI = () => {
  console.log("🔄 Refreshing UI...");
  isInitialized = false;
  prevValues = [];
  
  // Clear all stats
  Object.keys(statsBuffer).forEach(type => {
    Object.keys(statsBuffer[type]).forEach(phase => {
      statsBuffer[type][phase] = [];
    });
  });
  
  updateUI();
};

// ===========================================================
// 🛑 CLEANUP ON PAGE UNLOAD
// ===========================================================
window.addEventListener("beforeunload", () => {
  if (uiInterval) {
    clearInterval(uiInterval);
    uiInterval = null;
  }
});

// ===========================================================
// 📡 DEVICE CHANGE EVENT
// ===========================================================
window.addEventListener("deviceConfirmed", () => {
  console.log("📡 Device changed - refreshing UI");
  window.refreshUI();
});

// ===========================================================
// 🎬 AUTO-START
// ===========================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  setTimeout(initUI, 100);
}

// ===========================================================
// 🔧 EXPORTS
// ===========================================================
window.updateUI = updateUI;
window.initUI = initUI;

export { updateUI, initUI };

function ensureUIToolbar() {}
