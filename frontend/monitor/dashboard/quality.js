// ===========================================================
// 📊 QUALITY MODULE - Real-time Enhanced Version
// ===========================================================

const __cfgBase = (window.__CONFIG && window.__CONFIG.apiBase && String(window.__CONFIG.apiBase).trim())
  ? String(window.__CONFIG.apiBase).replace(/\/$/, '')
  : '';
const API_BASE = (__cfgBase || window.location.origin).replace(/\/$/, '');

let selectedQualityTab = "thdi";
let charts = {};
let qualityInterval = null;
let isUpdating = false;
let isInitialized = false;
let chartJsReady = false;

// ===========================================================
// 🔧 Helper Functions
// ===========================================================
function fmt(n, d = 3) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(d) : '0.000';
}

function el(id) {
  return document.getElementById(id);
}

// ===========================================================
// 🧩 รอให้ Chart.js โหลด
// ===========================================================
async function waitForChartJS() {
  if (typeof Chart !== "undefined") {
    chartJsReady = true;
    console.log("✅ Chart.js ready");
    return true;
  }

  let attempts = 0;
  while (attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (typeof Chart !== "undefined") {
      chartJsReady = true;
      console.log("✅ Chart.js loaded after", attempts + 1, "attempts");
      return true;
    }
    attempts++;
  }

  console.error("❌ Chart.js failed to load");
  return false;
}

// ===========================================================
// 🛰️ ดึงข้อมูลจาก API (Real-time)
// ===========================================================
async function fetchQualityData() {
  try {
    const device = el('dev')?.value || sessionStorage.getItem("selectedDevice") || localStorage.getItem("selectedDevice");
    if (!device) {
      console.warn("⚠️ No device selected");
      return null;
    }
    
    const pidParam = new URLSearchParams(location.search).get('pid') || '';
    const pid = pidParam || el('proj')?.value || '';
    
    const url = pid
      ? `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`
      : `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?_t=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const js = await res.json();
        if (js && js.latest) return js.latest;
      }
    } catch (e) {
      console.warn("json_latest failed, switching to history fallback", e);
    }

    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0,19).replace('T',' ');
    const end = now.toISOString().slice(0,19).replace('T',' ');

    const needKeysByTab = {
      thdi: ["THD_Current_L1","THD_Current_L2","THD_Current_L3"],
      thdu: ["THD_Voltage_L1L2","THD_Voltage_L2L3","THD_Voltage_L3L1","THD_Voltage_L1","THD_Voltage_L2","THD_Voltage_L3"],
      thdv: ["THDv_L1","THDv_L2","THDv_L3","THD_Voltage_L1","THD_Voltage_L2","THD_Voltage_L3"],
      tdd: ["TDD_L1","TDD_L2","TDD_L3"],
      kfactor: ["KFactor_L1","KFactor_L2","KFactor_L3"],
      crest: ["Crest_L1","Crest_L2","Crest_L3"]
    };

    const need = needKeysByTab[selectedQualityTab] || [];
    const out = {};
    for (const k of need) {
      const hurl = pid
        ? `${API_BASE}/api/history?device=${encodeURIComponent(device)}&key=${encodeURIComponent(k)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&project_id=${encodeURIComponent(pid)}`
        : `${API_BASE}/api/history?device=${encodeURIComponent(device)}&key=${encodeURIComponent(k)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      try {
        const r = await fetch(hurl, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        const hist = j.history || [];
        if (hist.length) out[k] = hist[hist.length - 1].value;
      } catch (e) {}
    }
    return Object.keys(out).length ? out : null;
  } catch (err) {
    console.error("❌ Failed to fetch quality data:", err);
    return null;
  }
}

// ===========================================================
// 📊 สร้าง/อัปเดต Chart (Optimized)
// ===========================================================
function createOrUpdateChart(canvasId, data, config) {
  const canvas = el(canvasId);
  if (!canvas) {
    setTimeout(() => createOrUpdateChart(canvasId, data, config), 200);
    return;
  }

  // ถ้ามี chart อยู่แล้ว ให้อัปเดตแทนการสร้างใหม่
  if (charts[canvasId]) {
    try {
      charts[canvasId].data.datasets[0].data = data.datasets[0].data;
      charts[canvasId].update('none');
      return;
    } catch (e) {
      console.warn("⚠️ Error updating chart, will recreate:", e);
      try {
        charts[canvasId].destroy();
      } catch (err) {}
      delete charts[canvasId];
    }
  }

  // ตรวจสอบขนาด canvas
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    setTimeout(() => createOrUpdateChart(canvasId, data, config), 300);
    return;
  }

  // ตั้งค่า canvas สำหรับ DPR
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // สร้าง chart ใหม่
  try {
    charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          title: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f1f5f9",
            bodyColor: "#cbd5e1",
            borderColor: "#06b6d4",
            borderWidth: 2,
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { 
              color: "rgba(148, 163, 184, 0.1)",
              drawBorder: false
            },
            ticks: { 
              color: "#94a3b8", 
              font: { size: 13, weight: '600' }
            }
          },
          y: {
            beginAtZero: true,
            grid: { 
              color: "rgba(148, 163, 184, 0.1)",
              drawBorder: false
            },
            ticks: { 
              color: "#94a3b8", 
              font: { size: 13 }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("❌ Error creating chart:", err);
  }
}

// ===========================================================
// 🎨 อัปเดตตารางและ Badge
// ===========================================================
function updateTableAndBadge(tbodyId, values, labels, thresholds = { good: 5, warning: 10 }) {
  const tbody = el(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = values.map((val, i) => {
    let badgeClass = "badge-good";
    let badgeText = "Good";
    
    if (val > thresholds.warning) {
      badgeClass = "badge-danger";
      badgeText = "High";
    } else if (val > thresholds.good) {
      badgeClass = "badge-warning";
      badgeText = "Moderate";
    }

    return `
      <tr>
        <td class="phase-label">${labels[i]}</td>
        <td class="value-cell">${fmt(val, 3)}</td>
        <td class="badge-cell"><span class="badge ${badgeClass}">${badgeText}</span></td>
      </tr>
    `;
  }).join("");
}

// ===========================================================
// 📈 Render Functions (Real-time)
// ===========================================================
function renderTHDi(data) {
  const values = [
    Number(data.THD_Current_L1) || 0,
    Number(data.THD_Current_L2) || 0,
    Number(data.THD_Current_L3) || 0
  ];
  const labels = ["L1", "L2", "L3"];

  updateTableAndBadge("thdi-table-body", values, labels, { good: 5, warning: 10 });

  createOrUpdateChart("thdi-chart", {
    labels: labels,
    datasets: [{
      label: "THD (%)",
      data: values,
      backgroundColor: [
        "rgba(37, 99, 235, 0.8)",
        "rgba(6, 182, 212, 0.8)",
        "rgba(139, 92, 246, 0.8)"
      ],
      borderColor: [
        "#2563eb",
        "#06b6d4",
        "#8b5cf6"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

function renderTHDu(data) {
  const values = [
    Number(data.THD_Voltage_L1L2 || data.THD_Voltage_L1) || 0,
    Number(data.THD_Voltage_L2L3 || data.THD_Voltage_L2) || 0,
    Number(data.THD_Voltage_L3L1 || data.THD_Voltage_L3) || 0
  ];
  const labels = ["U12", "U23", "U31"];

  updateTableAndBadge("thdu-table-body", values, labels, { good: 3, warning: 5 });

  createOrUpdateChart("thdu-chart", {
    labels: labels,
    datasets: [{
      label: "THD (%)",
      data: values,
      backgroundColor: [
        "rgba(30, 58, 138, 0.8)",
        "rgba(59, 130, 246, 0.8)",
        "rgba(147, 197, 253, 0.8)"
      ],
      borderColor: [
        "#1e3a8a",
        "#3b82f6",
        "#93c5fd"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

function renderTHDv(data) {
  const values = [
    Number(data.THDv_L1 || data.THD_Voltage_L1) || 0,
    Number(data.THDv_L2 || data.THD_Voltage_L2) || 0,
    Number(data.THDv_L3 || data.THD_Voltage_L3) || 0
  ];
  const labels = ["V1", "V2", "V3"];

  updateTableAndBadge("thdv-table-body", values, labels, { good: 3, warning: 5 });

  createOrUpdateChart("thdv-chart", {
    labels: labels,
    datasets: [{
      label: "THD (%)",
      data: values,
      backgroundColor: [
        "rgba(147, 51, 234, 0.8)",
        "rgba(168, 85, 247, 0.8)",
        "rgba(196, 181, 253, 0.8)"
      ],
      borderColor: [
        "#9333ea",
        "#a855f7",
        "#c4b5fd"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

function renderTDD(data) {
  const values = [
    Number(data.TDD_L1) || 0,
    Number(data.TDD_L2) || 0,
    Number(data.TDD_L3) || 0
  ];
  const labels = ["L1", "L2", "L3"];

  updateTableAndBadge("tdd-table-body", values, labels, { good: 5, warning: 8 });

  createOrUpdateChart("tdd-chart", {
    labels: labels,
    datasets: [{
      label: "TDD (%)",
      data: values,
      backgroundColor: [
        "rgba(22, 163, 74, 0.8)",
        "rgba(34, 197, 94, 0.8)",
        "rgba(134, 239, 172, 0.8)"
      ],
      borderColor: [
        "#16a34a",
        "#22c55e",
        "#86efac"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

function renderKFactor(data) {
  const values = [
    Number(data.KFactor_L1) || 1.0,
    Number(data.KFactor_L2) || 1.0,
    Number(data.KFactor_L3) || 1.0
  ];
  const labels = ["L1", "L2", "L3"];

  updateTableAndBadge("kfactor-table-body", values, labels, { good: 4, warning: 9 });

  createOrUpdateChart("kfactor-chart", {
    labels: labels,
    datasets: [{
      label: "K-Factor",
      data: values,
      backgroundColor: [
        "rgba(220, 38, 38, 0.8)",
        "rgba(239, 68, 68, 0.8)",
        "rgba(252, 165, 165, 0.8)"
      ],
      borderColor: [
        "#dc2626",
        "#ef4444",
        "#fca5a5"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

function renderCrest(data) {
  const values = [
    Number(data.Crest_L1) || 1.414,
    Number(data.Crest_L2) || 1.414,
    Number(data.Crest_L3) || 1.414
  ];
  const labels = ["V1", "V2", "V3"];

  updateTableAndBadge("crest-table-body", values, labels, { good: 1.5, warning: 1.8 });

  createOrUpdateChart("crest-chart", {
    labels: labels,
    datasets: [{
      label: "Crest Factor",
      data: values,
      backgroundColor: [
        "rgba(234, 179, 8, 0.8)",
        "rgba(250, 204, 21, 0.8)",
        "rgba(253, 224, 71, 0.8)"
      ],
      borderColor: [
        "#eab308",
        "#facc15",
        "#fde047"
      ],
      borderWidth: 2,
      borderRadius: 6
    }]
  });
}

// ===========================================================
// 📝 อัปเดต Quality (Main Function - Real-time)
// ===========================================================
async function updateQuality() {
  if (isUpdating) return;
  
  if (!chartJsReady) {
    const ready = await waitForChartJS();
    if (!ready) return;
  }

  const activeSection = el(`${selectedQualityTab}-section`);
  if (!activeSection || !activeSection.classList.contains('active')) {
    return;
  }

  isUpdating = true;

  try {
    const data = await fetchQualityData();
    if (!data) {
      console.warn("⚠️ No quality data available");
      isUpdating = false;
      return;
    }

    switch (selectedQualityTab) {
      case "thdi":
        renderTHDi(data);
        break;
      case "thdu":
        renderTHDu(data);
        break;
      case "thdv":
        renderTHDv(data);
        break;
      case "tdd":
        renderTDD(data);
        break;
      case "kfactor":
        renderKFactor(data);
        break;
      case "crest":
        renderCrest(data);
        break;
    }

  } catch (err) {
    console.error("❌ Error updating quality:", err);
  } finally {
    isUpdating = false;
  }
}

// ===========================================================
// 🎯 Setup Tab Navigation
// ===========================================================
function setupTabs() {
  const tabs = document.querySelectorAll(".qbtn.tab");
  
  if (!tabs.length) {
    console.warn("⚠️ Tabs not ready, retrying...");
    setTimeout(setupTabs, 500);
    return;
  }

  console.log("✅ Setting up", tabs.length, "quality tabs");

  tabs.forEach(tab => {
    tab.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const targetTab = tab.dataset.tab;
      console.log("📌 Tab clicked:", targetTab);

      document.querySelectorAll(".qbtn.tab").forEach(t => 
        t.classList.remove("active")
      );
      tab.classList.add("active");

      document.querySelectorAll(".quality-section").forEach(s => 
        s.classList.remove("active")
      );

      const targetSection = el(`${targetTab}-section`);
      if (targetSection) {
        targetSection.classList.add("active");
      }

      selectedQualityTab = targetTab;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      updateQuality();
    });
  });

  isInitialized = true;
  console.log("✅ Tabs setup complete");
}

// ===========================================================
// ⏱️ เริ่ม Auto-Update Loop (Real-time)
// ===========================================================
function startQualityLoop() {
  if (qualityInterval) {
    clearInterval(qualityInterval);
  }

  console.log("⏱️ Starting quality update loop (every 3s)");
  
  // อัปเดตครั้งแรกทันที
  updateQuality();
  
  // ตั้ง interval
  qualityInterval = setInterval(() => {
    updateQuality();
  }, 3000);
}

// ===========================================================
// 🚀 Initialize Quality Module
// ===========================================================
async function initQuality() {
  console.log("🚀 Initializing Quality module");

  const wrapper = document.querySelector(".quality-wrapper");
  if (!wrapper) {
    console.warn("⚠️ Quality wrapper not found, retrying...");
    setTimeout(initQuality, 500);
    return;
  }

  if (isInitialized) {
    console.log("🔄 Re-initializing Quality module");
    if (qualityInterval) {
      clearInterval(qualityInterval);
      qualityInterval = null;
    }
    Object.keys(charts).forEach(key => {
      try {
        if (charts[key]) charts[key].destroy();
      } catch (e) {}
    });
    charts = {};
    isInitialized = false;
  }

  await waitForChartJS();
  setupTabs();
  startQualityLoop();
}

// ===========================================================
// 📡 Event Listeners
// ===========================================================
window.addEventListener("deviceConfirmed", () => {
  console.log("📡 Device changed - refreshing quality data");
  
  if (qualityInterval) {
    clearInterval(qualityInterval);
    qualityInterval = null;
  }
  
  Object.keys(charts).forEach(key => {
    try {
      if (charts[key]) charts[key].destroy();
    } catch (e) {}
  });
  charts = {};
  
  startQualityLoop();
});

window.addEventListener("beforeunload", () => {
  if (qualityInterval) {
    clearInterval(qualityInterval);
  }
  Object.keys(charts).forEach(key => {
    try {
      if (charts[key]) charts[key].destroy();
    } catch (e) {}
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    const wrapper = document.querySelector(".quality-wrapper");
    if (wrapper && wrapper.offsetParent !== null) {
      if (!isInitialized || !qualityInterval) {
        setTimeout(initQuality, 300);
      }
    }
  }
});

// ===========================================================
// 🎬 Auto-Start
// ===========================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initQuality, 500);
  });
} else {
  setTimeout(initQuality, 500);
}

const qualityObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.classList && node.classList.contains('quality-wrapper')) {
        setTimeout(initQuality, 300);
      }
    });
  });
});

if (document.body) {
  qualityObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Export
window.updateQuality = updateQuality;
window.startQualityLoop = startQualityLoop;
window.initQuality = initQuality;
export { updateQuality, startQualityLoop, initQuality };
