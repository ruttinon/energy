// ===========================================================
// ⚙️ SMART ENERGY DASHBOARD (Realtime Data + Chart + Summary)
// ===========================================================

const API_BASE = window.location.origin;
let currentDevice = null;
let jsonKeys = [];
let lastData = null;
let realtimeTimer = null;
let isFetching = false;

/* ===========================================================
   🧭 โหลดอุปกรณ์จาก convertors.json
   =========================================================== */
export async function loadDevices() {
  try {
    const deviceSelect = document.getElementById("device-select");
    if (!deviceSelect) return;
    deviceSelect.innerHTML = "";

    const snapshot = await fetch(`${API_BASE}/api/convertors`).then(r => r.json());
    if (!snapshot.convertors) throw new Error("ไม่มี convertors");

    const allDevices = [];
    for (const [convId, convData] of Object.entries(snapshot.convertors)) {
      const devices = convData.devices || {};
      for (const [devId] of Object.entries(devices)) {
        allDevices.push({ convId, devId });
      }
    }

    if (allDevices.length === 0) {
      deviceSelect.innerHTML = `<option>No devices found</option>`;
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const deviceParam = urlParams.get("device");
    let selectedDev = allDevices[0].devId;

    if (deviceParam) {
      const found = allDevices.find(d => d.devId === deviceParam);
      if (found) selectedDev = found.devId;
    }

    allDevices.forEach(({ convId, devId }) => {
      const opt = document.createElement("option");
      opt.value = devId;
      opt.textContent = `${devId} (${convId})`;
      if (devId === selectedDev) opt.selected = true;
      deviceSelect.appendChild(opt);
    });

    // ✅ ตั้งค่า Device ปัจจุบัน
    currentDevice = selectedDev;
    localStorage.setItem("selectedDevice", currentDevice);
    const devText = document.getElementById("device-id-text");
    if (devText) devText.innerText = selectedDev;

    // ✅ โหลดข้อมูลทันที
    await fetchAndUpdate();

    // ✅ เมื่อเลือก Device ใหม่ → โหลดข้อมูลทันที
    deviceSelect.onchange = async (e) => {
      currentDevice = e.target.value;
      localStorage.setItem("selectedDevice", currentDevice);
      if (devText) devText.innerText = currentDevice;
      console.log(`🔁 เปลี่ยน Device เป็น ${currentDevice}`);
      await fetchAndUpdate();
    };

  } catch (err) {
    console.error("❌ โหลดอุปกรณ์ผิดพลาด:", err);
  }
}

/* ===========================================================
   ⚡ โหลดข้อมูลสดแบบ Realtime
   =========================================================== */
export async function fetchAndUpdate() {
  if (isFetching || !currentDevice) return;
  isFetching = true;

  try {
    const pid = new URLSearchParams(location.search).get('pid') || '';
    const url = pid
      ? `${API_BASE}/api/json_latest/${encodeURIComponent(currentDevice)}?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`
      : `${API_BASE}/api/json_latest/${encodeURIComponent(currentDevice)}?_t=${Date.now()}`;
    let res = await fetch(url, { cache: "no-store" });
    let data = null;
    if (res.ok){ const js = await res.json(); data = js.latest || null; }
    if (!data && pid){
      const res2 = await fetch(`${API_BASE}/public/projects/${encodeURIComponent(pid)}/readings?_t=${Date.now()}`, { cache: 'no-store' });
      if (res2.ok){ const j2 = await res2.json(); const items=j2.items||[]; const obj={}; items.filter(it=>String(it.device_id)===String(currentDevice)).forEach(it=>{ obj[it.parameter]=it.value; }); if(Object.keys(obj).length) data=obj; }
    }
    if (!data) throw new Error(`ไม่พบข้อมูลของ ${currentDevice}`);

    lastData = data;

    const timestamp = document.getElementById("timestamp");
    if (timestamp) timestamp.innerText = new Date().toLocaleTimeString("th-TH");

    // ถ้ายังไม่มี key — render ตารางครั้งแรก
    if (jsonKeys.length === 0) {
      jsonKeys = Object.keys(data).filter(k => !["timestamp", "device_id", "alerts", "online"].includes(k));
      renderKeysTable(jsonKeys, data);
      initCharts();
    }

    updateValuesInTable(data);
    updateSummaryCards(data);
    renderTableFromObject(data);
    updateCharts(data);

  } catch (err) {
    console.error("❌ โหลดข้อมูลสดผิดพลาด:", err);
  } finally {
    isFetching = false;
  }
}

/* ===========================================================
   📊 Rendering Functions (Table / Cards / Chart)
   =========================================================== */
function renderKeysTable(keys, data) {
  const tbody = document.getElementById("keys-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  keys.forEach(k => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-3 font-semibold text-gray-800">${k}</td>
      <td class="p-3"><span id="val_${k}" class="text-gray-900 font-bold">${data[k] ?? "-"}</span></td>
      <td class="p-3 muted">-</td>
      <td class="p-3 muted hidden md:table-cell">Auto-detected key</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTableFromObject(dataObj) {
  const tbody = document.getElementById("keys-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  jsonKeys.forEach(key => {
    const value = dataObj[key] !== undefined ? dataObj[key] : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-3 font-semibold text-gray-800">${key}</td>
      <td class="p-3 text-gray-900 font-bold">${(value === "-" ? "-" : Number(value).toFixed(2))}</td>
      <td class="p-3 text-gray-600">-</td>
      <td class="p-3 text-gray-500 hidden md:table-cell">Auto</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateValuesInTable(data) {
  jsonKeys.forEach(k => {
    const el = document.getElementById(`val_${k}`);
    if (el) {
      const newVal = data[k] !== undefined ? Number(data[k]).toFixed(2) : "-";
      if (el.innerText !== newVal) el.innerText = newVal;
    }
  });
}

/* ===========================================================
   📋 Summary Card + Chart Functions
   =========================================================== */
function updateSummaryCards(data) {
  const voltageL1 = (data.Voltage_L1 || data.Voltage_L1_N || 0).toFixed(1);
  const voltageL2 = (data.Voltage_L2 || data.Voltage_L2_N || 0).toFixed(1);
  const voltageL3 = (data.Voltage_L3 || data.Voltage_L3_N || 0).toFixed(1);

  const currentL1 = (data.Current_L1 || 0).toFixed(2);
  const currentL2 = (data.Current_L2 || 0).toFixed(2);
  const currentL3 = (data.Current_L3 || 0).toFixed(2);

  const activeP = (data.ActivePower_Total || data.TotalActivePower || 0).toFixed(2);
  const reactiveP = (data.ReactivePower_Total || data.TotalReactivePower || 0).toFixed(2);

  const summaryEl = document.getElementById("summary-cards");
  if (!summaryEl) return;
  summaryEl.innerHTML = `
    <div class="card"><b>Voltage (V)</b><br>L1: ${voltageL1} | L2: ${voltageL2} | L3: ${voltageL3}</div>
    <div class="card"><b>Current (A)</b><br>L1: ${currentL1} | L2: ${currentL2} | L3: ${currentL3}</div>
    <div class="card"><b>Power (kW/kvar)</b><br>P: ${activeP} | Q: ${reactiveP}</div>
  `;
}

function initCharts() {
  const ctxV = document.getElementById("chartVoltage");
  const ctxI = document.getElementById("chartCurrent");
  if (!ctxV || !ctxI) return;

  voltageChart = new Chart(ctxV, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "V L1", data: [], borderWidth: 2 },
      { label: "V L2", data: [], borderWidth: 2 },
      { label: "V L3", data: [], borderWidth: 2 }
    ]},
    options: { responsive: true, scales: { y: { beginAtZero: false } } }
  });

  currentChart = new Chart(ctxI, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "I L1", data: [], borderWidth: 2 },
      { label: "I L2", data: [], borderWidth: 2 },
      { label: "I L3", data: [], borderWidth: 2 }
    ]},
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

function updateCharts(data) {
  if (!voltageChart || !currentChart) return;
  const time = new Date().toLocaleTimeString("th-TH").split(" ")[0];
  voltageChart.data.labels.push(time);
  currentChart.data.labels.push(time);
  if (voltageChart.data.labels.length > 15) {
    voltageChart.data.labels.shift();
    currentChart.data.labels.shift();
  }

  const voltages = [data.Voltage_L1 || 0, data.Voltage_L2 || 0, data.Voltage_L3 || 0];
  const currents = [data.Current_L1 || 0, data.Current_L2 || 0, data.Current_L3 || 0];

  for (let i = 0; i < 3; i++) {
    voltageChart.data.datasets[i].data.push(voltages[i]);
    currentChart.data.datasets[i].data.push(currents[i]);
    if (voltageChart.data.datasets[i].data.length > 15) {
      voltageChart.data.datasets[i].data.shift();
      currentChart.data.datasets[i].data.shift();
    }
  }

  voltageChart.update();
  currentChart.update();
}

/* ===========================================================
   ⚙️ อ่าน config เพื่อซ่อนฟังก์ชันย่อยในหน้า Monitor
   =========================================================== */
async function applyMonitorConfig() {
  try {
    const res = await fetch("/api/settings/get_config?t=" + Date.now());
    if (!res.ok) throw new Error("โหลด config.json ไม่ได้");
    const cfg = await res.json();
    const sub = cfg.modules?.subModules || {};
    console.log("🧩 Monitor Config Loaded:", sub);

    const tabMap = {
      monitor_summary: "🧭 Summary",
      monitor_power: "🔌 Power",
      monitor_quality: "📈 Quality",
      monitor_diagram: "📊 Overview"
    };

    for (const [key, label] of Object.entries(tabMap)) {
      const tab = [...document.querySelectorAll(".tab-btn")]
        .find(btn => btn.textContent.includes(label));
      if (tab) {
        tab.style.display = sub[key] ? "inline-block" : "none";
        console.log(`🔹 ${label}: ${sub[key] ? "แสดง" : "ซ่อน"}`);
      }
    }

    if (!sub.monitor_autoRefresh) {
      console.log("⏸️ ปิด Auto Refresh");
      if (window.refreshNow && window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
      }
    } else {
      console.log("🔁 เปิด Auto Refresh");
      if (!window.autoRefreshInterval && window.refreshNow) {
        window.autoRefreshInterval = setInterval(window.refreshNow, 10000);
      }
    }

  } catch (err) {
    console.error("❌ applyMonitorConfig Error:", err);
  }
}

/* ===========================================================
   🚀 Init Dashboard (เริ่มอัตโนมัติทุกครั้ง)
   =========================================================== */
export async function initDashboard() {
  console.log("🚀 Initializing dashboard...");
  await loadDevices();

  if (realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer = setInterval(fetchAndUpdate, 2000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(realtimeTimer);
      realtimeTimer = null;
    } else if (!realtimeTimer) {
      realtimeTimer = setInterval(fetchAndUpdate, 2000);
    }
  });

  // ✅ โหลด config หลังจาก dashboard พร้อม
  await applyMonitorConfig();
}
