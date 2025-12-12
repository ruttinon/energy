// user/monitor/MonitorJS/power.js
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

// ⭐ DEFAULT MODE + TYPE ⭐
let selectedMode = null;  // เริ่มต้นไม่มีการเลือก
let selectedType = null;  // เริ่มต้นไม่มีการเลือก

let updateTimer = null;
let isInitialized = false;

// เก็บค่าสถิติแยกตาม mode และ type
const statHistory = {
  INST: {
    P: { L1: [], L2: [], L3: [], Total: [] },
    Q: { L1: [], L2: [], L3: [], Total: [] },
    S: { L1: [], L2: [], L3: [], Total: [] },
    PF: { L1: [], L2: [], L3: [], Total: [] },
    'cosφ': { L1: [], L2: [], L3: [], Total: [] },
    'tanφ': { L1: [], L2: [], L3: [], Total: [] }
  },
  AVG: {
    P: { L1: [], L2: [], L3: [], Total: [] },
    Q: { L1: [], L2: [], L3: [], Total: [] },
    S: { L1: [], L2: [], L3: [], Total: [] },
    PF: { L1: [], L2: [], L3: [], Total: [] },
    'cosφ': { L1: [], L2: [], L3: [], Total: [] },
    'tanφ': { L1: [], L2: [], L3: [], Total: [] }
  }
};

// -------------------------------------------------------------
function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

// -------------------------------------------------------------
async function fetchData() {
  const device = localStorage.getItem("selectedDevice");
  if (!device) return null;

  try {
    const pid = document.getElementById('proj')?.value || '';
    const url = pid
      ? `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`
      : `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?_t=${Date.now()}`;

    const res = await fetch(url, { cache: "no-store" });
    const js = await res.json();
    return js.latest || null;

  } catch (err) {
    console.error("❌ โหลด json_latest ล้มเหลว:", err);
    return null;
  }
}

function safeDiv(a, b) {
  if (b === 0 || b === null || isNaN(b)) return 0;
  return a / b;
}

// -------------------------------------------------------------
function setGauge(idSuffix, value, maxVal = 1, minVal = 0) {
  const fillEl = document.getElementById(`fill-${idSuffix}`);
  const cursorEl = document.getElementById(`cursor-${idSuffix}`);
  const valEl = document.getElementById(`val-${idSuffix}`);

  if (!fillEl || !cursorEl || !valEl) return;

  let percent = 0;
  if (minVal < 0) {
    const range = maxVal - minVal;
    percent = ((value - minVal) / range) * 100;
  } else {
    percent = (value / maxVal) * 100;
  }

  percent = Math.max(0, Math.min(100, percent));

  fillEl.style.height = `${percent}%`;
  cursorEl.style.bottom = `${percent}%`;
  valEl.textContent = value.toFixed(3);
}

// -------------------------------------------------------------
function updateStatHistory(mode, type, values) {
  if (!statHistory[mode] || !statHistory[mode][type]) return;
  
  const history = statHistory[mode][type];
  
  ['L1', 'L2', 'L3', 'Total'].forEach((phase, idx) => {
    history[phase].push(values[idx]);
    // เก็บประวัติไว้ 1000 ค่า
    if (history[phase].length > 1000) history[phase].shift();
  });
}

function getStats(mode, type) {
  if (!statHistory[mode] || !statHistory[mode][type]) {
    return {
      L1: { current: 0, max: 0, min: 0, avg: 0 },
      L2: { current: 0, max: 0, min: 0, avg: 0 },
      L3: { current: 0, max: 0, min: 0, avg: 0 },
      Total: { current: 0, max: 0, min: 0, avg: 0 }
    };
  }

  const history = statHistory[mode][type];
  const result = {};
  
  ['L1', 'L2', 'L3', 'Total'].forEach(phase => {
    const data = history[phase];
    
    if (data.length === 0) {
      result[phase] = { current: 0, max: 0, min: 0, avg: 0 };
      return;
    }
    
    const current = data[data.length - 1] || 0;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;
    
    result[phase] = {
      current: current,
      max: max,
      min: min,
      avg: avg
    };
  });

  return result;
}

// -------------------------------------------------------------
// ฟังก์ชันสร้างตาราง HTML
function createTableHTML() {
  return `
    <div class="power-table-container">
      <table class="power-table">
        <thead class="pt-header">
          <tr>
            <th>PARAMETER</th>
            <th>L1</th>
            <th>L2</th>
            <th>L3</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <!-- แถว Nom -->
          <tr class="pt-row row-nom">
            <td id="pt-param-name">-</td>
            <td id="pt-nom-l1">-</td>
            <td id="pt-nom-l2">-</td>
            <td id="pt-nom-l3">-</td>
            <td id="pt-nom-total">-</td>
          </tr>
          
          <!-- แถว Avg -->
          <tr class="pt-row row-avg">
            <td>Avg</td>
            <td id="pt-avg-l1">-</td>
            <td id="pt-avg-l2">-</td>
            <td id="pt-avg-l3">-</td>
            <td id="pt-avg-total">-</td>
          </tr>
          
          <!-- แถว Avg max -->
          <tr class="pt-row row-max">
            <td>Avg max</td>
            <td id="pt-max-l1">-</td>
            <td id="pt-max-l2">-</td>
            <td id="pt-max-l3">-</td>
            <td id="pt-max-total">-</td>
          </tr>
          
          <!-- แถว Avg min -->
          <tr class="pt-row row-min">
            <td>Avg min</td>
            <td id="pt-min-l1">-</td>
            <td id="pt-min-l2">-</td>
            <td id="pt-min-l3">-</td>
            <td id="pt-min-total">-</td>
          </tr>
          
          <!-- แถว Available -->
          <tr class="pt-row row-available">
            <td>Available</td>
            <td id="pt-avail-l1">-</td>
            <td id="pt-avail-l2">-</td>
            <td id="pt-avail-l3">-</td>
            <td id="pt-avail-total">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// -------------------------------------------------------------
function initPowerTable() {
  const container = document.querySelector('.power-main');
  if (!container) {
    console.error("❌ ไม่พบ .power-main container");
    return;
  }

  const oldTable = container.querySelector('.power-table-container');
  if (oldTable) {
    oldTable.remove();
  }

  container.insertAdjacentHTML('beforeend', createTableHTML());
  console.log("✅ สร้างตารางสำเร็จ");
}

// -------------------------------------------------------------
async function updatePower() {
  // ถ้ายังไม่ได้เลือก mode หรือ type ให้หยุด
  if (!selectedMode || !selectedType) {
    console.log("⚠️ กรุณาเลือก MODE และ TYPE ก่อน");
    return;
  }

  const data = await fetchData();
  if (!data) return;

  // อ่านค่าจริงจาก API
  const P = [
    parseFloat(data.ActivePower_L1) || 0, 
    parseFloat(data.ActivePower_L2) || 0, 
    parseFloat(data.ActivePower_L3) || 0
  ];
  const Q = [
    parseFloat(data.ReactivePower_L1) || 0, 
    parseFloat(data.ReactivePower_L2) || 0, 
    parseFloat(data.ReactivePower_L3) || 0
  ];
  const S = [
    parseFloat(data.ApparentPower_L1) || 0, 
    parseFloat(data.ApparentPower_L2) || 0, 
    parseFloat(data.ApparentPower_L3) || 0
  ];

  const TotalP = parseFloat(data.TotalActivePower) || (P[0] + P[1] + P[2]);
  const TotalQ = parseFloat(data.TotalReactivePower) || (Q[0] + Q[1] + Q[2]);
  const TotalS = parseFloat(data.TotalApparentPower) || (S[0] + S[1] + S[2]);

  let values = [];
  let unit = "";
  let title = "";
  let scaleMax = 1;
  let scaleMin = 0;

  switch (selectedType) {
    case "P":
      values = [...P, TotalP]; 
      unit = "W";
      title = "ACTIVE POWER (W)"; 
      scaleMax = 5000;
      break;
    case "Q":
      values = [...Q, TotalQ]; 
      unit = "var";
      title = "REACTIVE POWER (var)"; 
      scaleMax = 5000;
      break;
    case "S":
      values = [...S, TotalS]; 
      unit = "VA";
      title = "APPARENT POWER (VA)"; 
      scaleMax = 5000;
      break;
    case "PF":
      values = [
        parseFloat(data.PowerFactor_L1) || safeDiv(P[0], S[0]),
        parseFloat(data.PowerFactor_L2) || safeDiv(P[1], S[1]),
        parseFloat(data.PowerFactor_L3) || safeDiv(P[2], S[2]),
        parseFloat(data.PowerFactor_Total) || safeDiv(TotalP, TotalS)
      ];
      title = "POWER FACTOR"; 
      scaleMax = 1;
      break;
    case "cosφ":
      values = [
        safeDiv(P[0], S[0]), 
        safeDiv(P[1], S[1]), 
        safeDiv(P[2], S[2]), 
        safeDiv(TotalP, TotalS)
      ];
      title = "COS(Φ)"; 
      scaleMax = 1;
      break;
    case "tanφ":
      values = [
        safeDiv(Q[0], P[0]), 
        safeDiv(Q[1], P[1]), 
        safeDiv(Q[2], P[2]), 
        safeDiv(TotalQ, TotalP)
      ];
      title = "TAN(Φ)"; 
      scaleMax = 5; 
      scaleMin = -5;
      break;
  }

  // บันทึกค่าลง history
  updateStatHistory(selectedMode, selectedType, values);
  
  // ดึงสถิติ
  const stats = getStats(selectedMode, selectedType);

  // อัพเดท Header
  setTextSafe("power-status-text", `⚡ ${selectedMode} MODE — ${title}`);

  // อัพเดท Gauges - แสดงตามโหมดที่เลือก
  const displayValues = selectedMode === "INST" 
    ? [stats.L1.current, stats.L2.current, stats.L3.current, stats.Total.current]
    : [stats.L1.avg, stats.L2.avg, stats.L3.avg, stats.Total.avg];

  setGauge("L1", displayValues[0], scaleMax, scaleMin);
  setGauge("L2", displayValues[1], scaleMax, scaleMin);
  setGauge("L3", displayValues[2], scaleMax, scaleMin);
  setGauge("Total", displayValues[3], scaleMax, scaleMin);

  // อัพเดทตาราง
  updateTable(stats, unit);
}
function updateTable(stats, unit) {
  let paramName = selectedType;
  if (selectedType === "P") paramName = "P Nom.";
  else if (selectedType === "Q") paramName = "Q Nom.";
  else if (selectedType === "S") paramName = "S Nom.";
  else if (selectedType === "PF") paramName = "PF";
  else if (selectedType === "cosφ") paramName = "COS(Φ)";
  else if (selectedType === "tanφ") paramName = "TAN(Φ)";

  setTextSafe("pt-param-name", paramName);

  // ---------------------
  // MODE = INST (Instantaneous)
  // ---------------------
  if (selectedMode === "INST") {
    setTextSafe("pt-nom-l1", stats.L1.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-nom-l2", stats.L2.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-nom-l3", stats.L3.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-nom-total", stats.Total.current.toFixed(3) + (unit ? ` ${unit}` : ""));

    // ปรับป้ายชื่อแถวให้เป็น Inst / max / min
    const labelAvgCell = document.querySelector('.power-table .row-avg td:first-child');
    const labelMaxCell = document.querySelector('.power-table .row-max td:first-child');
    const labelMinCell = document.querySelector('.power-table .row-min td:first-child');
    if (labelAvgCell) labelAvgCell.textContent = 'Inst';
    if (labelMaxCell) labelMaxCell.textContent = 'max';
    if (labelMinCell) labelMinCell.textContent = 'min';

    // แถว Inst
    setTextSafe("pt-avg-l1", stats.L1.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-avg-l2", stats.L2.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-avg-l3", stats.L3.current.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-avg-total", stats.Total.current.toFixed(3) + (unit ? ` ${unit}` : ""));

    // แถว max/min
    setTextSafe("pt-max-l1", stats.L1.max.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-max-l2", stats.L2.max.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-max-l3", stats.L3.max.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-max-total", stats.Total.max.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-min-l1", stats.L1.min.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-min-l2", stats.L2.min.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-min-l3", stats.L3.min.toFixed(3) + (unit ? ` ${unit}` : ""));
    setTextSafe("pt-min-total", stats.Total.min.toFixed(3) + (unit ? ` ${unit}` : ""));

    // Available = current/max
    const calcAvail = (s) => {
      if (s.max === 0) return "100%";
      const uptime = (s.current / s.max) * 100;
      return Math.min(100, Math.max(0, uptime)).toFixed(1) + "%";
    };
    setTextSafe("pt-avail-l1", calcAvail(stats.L1));
    setTextSafe("pt-avail-l2", calcAvail(stats.L2));
    setTextSafe("pt-avail-l3", calcAvail(stats.L3));
    setTextSafe("pt-avail-total", calcAvail(stats.Total));

    return;
  }

  // ---------------------
  // MODE = AVG
  // ---------------------
  const labelAvgCell = document.querySelector('.power-table .row-avg td:first-child');
  const labelMaxCell = document.querySelector('.power-table .row-max td:first-child');
  const labelMinCell = document.querySelector('.power-table .row-min td:first-child');
  if (labelAvgCell) labelAvgCell.textContent = 'Avg';
  if (labelMaxCell) labelMaxCell.textContent = 'Avg max';
  if (labelMinCell) labelMinCell.textContent = 'Avg min';

  setTextSafe("pt-avg-l1", stats.L1.avg.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-avg-l2", stats.L2.avg.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-avg-l3", stats.L3.avg.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-avg-total", stats.Total.avg.toFixed(3) + (unit ? ` ${unit}` : ""));

  setTextSafe("pt-max-l1", stats.L1.max.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-max-l2", stats.L2.max.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-max-l3", stats.L3.max.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-max-total", stats.Total.max.toFixed(3) + (unit ? ` ${unit}` : ""));

  setTextSafe("pt-min-l1", stats.L1.min.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-min-l2", stats.L2.min.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-min-l3", stats.L3.min.toFixed(3) + (unit ? ` ${unit}` : ""));
  setTextSafe("pt-min-total", stats.Total.min.toFixed(3) + (unit ? ` ${unit}` : ""));

  // คำนวณ Available
  const calcAvail = (s) => {
    if (s.max === 0) return "100%";
    const uptime = (s.avg / s.max) * 100;
    return Math.min(100, Math.max(0, uptime)).toFixed(1) + "%";
  };

  setTextSafe("pt-avail-l1", calcAvail(stats.L1));
  setTextSafe("pt-avail-l2", calcAvail(stats.L2));
  setTextSafe("pt-avail-l3", calcAvail(stats.L3));
  setTextSafe("pt-avail-total", calcAvail(stats.Total));
}


// -------------------------------------------------------------
// Event handlers
document.addEventListener("click", e => {
  const modeBtn = e.target.closest(".pbtn.mode");
  const typeBtn = e.target.closest(".pbtn.type");

  if (modeBtn) {
    // ต้องเลือก MODE ก่อน
    document.querySelectorAll(".pbtn.mode").forEach(b => b.classList.remove("active"));
    modeBtn.classList.add("active");
    
    // แปลงเป็นตัวพิมพ์ใหญ่
    selectedMode = (modeBtn.dataset.mode || "").toUpperCase();
    
    console.log(`✅ เลือก MODE: ${selectedMode}`);
    
    // ตรวจสอบว่า mode ถูกต้อง
    if (!statHistory[selectedMode]) {
      console.error(`❌ MODE ไม่ถูกต้อง: ${selectedMode}`);
      return;
    }
    // รีเซ็ตสถานะ UI เมื่อเปลี่ยนโหมด แต่ไม่ล้าง history เพื่อให้ AVG เก็บค่าได้ต่อเนื่อง
    isInitialized = false;
    
    // ถ้าเลือก type แล้ว ให้อัพเดทเลย
    if (selectedType) {
      updatePower();
    } else {
      // แจ้งเตือนให้เลือก type
      setTextSafe("power-status-text", `⚡ ${selectedMode} MODE — กรุณาเลือกพารามิเตอร์`);
    }
  }

  if (typeBtn) {
    // ต้องเลือก MODE ก่อน
    if (!selectedMode) {
      alert("⚠️ กรุณาเลือก MODE (INST หรือ AVG) ก่อน!");
      return;
    }
    
    document.querySelectorAll(".pbtn.type").forEach(b => b.classList.remove("active"));
    typeBtn.classList.add("active");
    selectedType = typeBtn.dataset.type;
    
    console.log(`✅ เลือก TYPE: ${selectedType}`);
    
    // ตรวจสอบว่า type ถูกต้อง
    if (!statHistory[selectedMode] || !statHistory[selectedMode][selectedType]) {
      console.error(`❌ TYPE ไม่ถูกต้อง: ${selectedType} ใน MODE: ${selectedMode}`);
      // สร้าง history ใหม่ถ้ายังไม่มี
      if (statHistory[selectedMode]) {
        statHistory[selectedMode][selectedType] = { L1: [], L2: [], L3: [], Total: [] };
      }
    } else {
      // รีเซ็ตสถิติเมื่อเปลี่ยน type
      statHistory[selectedMode][selectedType] = { L1: [], L2: [], L3: [], Total: [] };
    }
    
    // เริ่มอัพเดท
    updatePower();
  }
});

// -------------------------------------------------------------
function startLoop() {
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(() => {
    if (selectedMode && selectedType) {
      updatePower();
    }
  }, 2000);
}

// -------------------------------------------------------------
// เริ่มทำงาน
console.log("🚀 Power Module Loading...");

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPowerTable();
    startLoop();
    setTextSafe("power-status-text", "⚡ กรุณาเลือก MODE และพารามิเตอร์");
  });
} else {
  initPowerTable();
  startLoop();
  setTextSafe("power-status-text", "⚡ กรุณาเลือก MODE และพารามิเตอร์");
}

export { updatePower };
