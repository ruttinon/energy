// ====================================================================
// realtime_graph_module.js – IMPROVED & STABLE VERSION
// ====================================================================
const Chart = window.Chart;

window.realtimeChartInstance = null;
window.graphHistory = {};

const NEON_COLORS = [
  '#00f5ff', '#8b5cf6', '#f472b6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#a855f7', '#22c55e', '#eab308'
];

const MAX_DATA_POINTS = 60; // 1 minute at 1s interval
let graphInterval = null;
let isFirstDraw = true;
let isDrawing = false;

// ====================================================================
// INIT
// ====================================================================
function initRealtimeGraphModule() {
  console.log("🔄 Initializing Realtime Graph Module...");
  stopGraphInterval();
  window.graphHistory = {};
  isFirstDraw = true;
  isDrawing = false;
  populateGraphSelectors();
}

// ====================================================================
// POPULATE SELECTORS
// ====================================================================
async function populateGraphSelectors() {
  const convSel = document.getElementById("hist-conv");
  const devSel = document.getElementById("hist-device");
  const keyBox = document.getElementById("hist-key-container");

  if (!convSel || !devSel || !keyBox) {
    console.warn("Selector elements not found");
    return;
  }

  try {
    console.log("📡 Loading convertors...");
    const res = await fetch("/data/convertors.json?_t=" + Date.now());
    const convs = await res.json();

    convSel.innerHTML = `<option value="">⟨ Select Convertor ⟩</option>`;
    Object.entries(convs).forEach(([id, c]) => {
      convSel.innerHTML += `<option value="${id}">${c.name || id}</option>`;
    });

    convSel.onchange = () => {
      const devices = convs[convSel.value]?.devices || {};
      devSel.innerHTML = `<option value="">⟨ Select Device ⟩</option>`;
      keyBox.innerHTML = `<span class="placeholder-text">⟨ Select Device to load fields ⟩</span>`;
      
      stopGraphInterval();

      Object.entries(devices).forEach(([did, d]) => {
        devSel.innerHTML += `<option value="${did}">${d.name || did}</option>`;
      });

      devSel.onchange = () => {
        stopGraphInterval();
        window.graphHistory = {};
        isFirstDraw = true;
        loadKeys(devSel.value);
      };
    };

    console.log("✅ Selectors loaded");
  } catch (err) {
    console.error("❌ Error loading convertors:", err);
    convSel.innerHTML = `<option value="">⟨ Error loading ⟩</option>`;
  }
}

// ====================================================================
// LOAD KEYS WITH COLOR PICKER
// ====================================================================
async function loadKeys(devId) {
  const box = document.getElementById("hist-key-container");
  
  if (!box) return;
  
  box.innerHTML = `<span class="placeholder-text">⟨ Loading fields... ⟩</span>`;

  try {
    const res = await fetch(`/api/history/keys?device=${devId}`);
    const js = await res.json();

    if (!js.keys || js.keys.length === 0) {
      box.innerHTML = `<span class="placeholder-text">⚠️ No fields available</span>`;
      return;
    }

    box.innerHTML = "";
    
    js.keys.forEach((k, idx) => {
      const row = document.createElement("div");
      row.className = "field-row";
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = k;
      checkbox.id = `rt-field-${k}`;
      checkbox.onchange = () => {
        window.graphHistory = {};
        isFirstDraw = true;
        startGraphInterval();
      };

      const label = document.createElement("span");
      label.textContent = k;

      const colorDot = document.createElement("div");
      colorDot.className = "color-dot";
      colorDot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${NEON_COLORS[idx % NEON_COLORS.length]};
        box-shadow: 0 0 8px ${NEON_COLORS[idx % NEON_COLORS.length]};
      `;

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(colorDot);
      box.appendChild(row);
    });

    console.log(`✅ Loaded ${js.keys.length} fields for ${devId}`);
  } catch (err) {
    console.error("❌ Error loading fields:", err);
    box.innerHTML = `<span class="placeholder-text">⚠️ Error loading fields</span>`;
  }
}

// ====================================================================
// GET SELECTED FIELDS
// ====================================================================
function getFields() {
  const checkboxes = document.querySelectorAll("#hist-key-container input[type='checkbox']:checked");
  return Array.from(checkboxes).map(e => e.value);
}

// ====================================================================
// DETECT AXIS TYPE - Auto-detect based on field name
// ====================================================================
function axisFor(fieldName) {
  const f = fieldName.toLowerCase();
  
  if (f.includes("volt") || f.includes("_v") || f.includes("vph")) return "voltAxis";
  if (f.includes("curr") || f.includes("_i") || f.includes("amp") || f.includes("_a")) return "currAxis";
  if (f.includes("power") || f.includes("_p") || f.includes("watt") || f.includes("_w")) return "powerAxis";
  if (f.includes("freq") || f.includes("hz") || f.includes("_f")) return "freqAxis";
  if (f.includes("temp") || f.includes("°c") || f.includes("temperature")) return "tempAxis";
  if (f.includes("pf") || f.includes("factor")) return "pfAxis";
  
  return "voltAxis"; // default
}

// ====================================================================
// CREATE AXIS CONFIG
// ====================================================================
function createAxisConfig(position, title, color, hidden = false) {
  return {
    type: "linear",
    position,
    display: !hidden,
    grid: { 
      color: position === 'left' ? 'rgba(0,245,255,0.08)' : 'rgba(139,92,246,0.05)',
      drawBorder: false,
      drawOnChartArea: position === 'left'
    },
    title: { 
      display: true, 
      text: title, 
      color: color, 
      font: { family: 'Orbitron', size: 10, weight: '600' } 
    },
    ticks: { 
      color: '#94a3b8', 
      font: { family: 'Rajdhani', size: 10 }
    }
  };
}

// ====================================================================
// CREATE CHART CONFIG
// ====================================================================
function createChartConfig(datasets, usedAxes) {
  // Get chart type from selector (default: line)
  const chartTypeSelect = document.getElementById("realtimeChartTypeSelect");
  const chartType = chartTypeSelect ? chartTypeSelect.value : "line";
  
  console.log("🎨 Creating realtime chart with type:", chartType);
  
  return {
    type: chartType === "scatter" ? "scatter" : (chartType === "bar" ? "bar" : "line"),
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: isFirstDraw ? { duration: 600, easing: 'easeOutQuart' } : false,
      interaction: { 
        intersect: false, 
        mode: 'index' 
      },
      scales: {
        x: chartType === "bar" || chartType === "scatter"
          ? {
              type: chartType === "bar" ? "category" : "time",
              categoryPercentage: 0.65,
              barPercentage: 0.7,
              time: chartType === "scatter" ? {
                unit: "second",
                displayFormats: { second: "HH:mm:ss" }
              } : undefined,
              grid: { color: 'rgba(0,245,255,0.08)', drawBorder: false },
              ticks: { 
                color: '#94a3b8', 
                maxRotation: 0,
                font: { family: 'Rajdhani', size: 11 } 
              }
            }
          : {
              type: "time",
              time: { unit: "second", displayFormats: { second: "HH:mm:ss" } },
              grid: { color: 'rgba(0,245,255,0.08)', drawBorder: false },
              ticks: { 
                color: '#94a3b8',
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 10,
                font: { family: 'Rajdhani', size: 11 } 
              }
            },
        voltAxis: createAxisConfig("left", "Voltage (V)", '#00f5ff', !usedAxes.has('voltAxis')),
        currAxis: createAxisConfig("right", "Current (A)", '#f472b6', !usedAxes.has('currAxis')),
        powerAxis: createAxisConfig("right", "Power (W)", '#8b5cf6', !usedAxes.has('powerAxis')),
        freqAxis: createAxisConfig("right", "Freq (Hz)", '#10b981', !usedAxes.has('freqAxis')),
        tempAxis: createAxisConfig("right", "Temp (°C)", '#f59e0b', !usedAxes.has('tempAxis')),
        pfAxis: createAxisConfig("right", "Power Factor", '#06b6d4', !usedAxes.has('pfAxis'))
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: '#e2e8f0',
            font: { family: 'Orbitron', size: 10, weight: '600' },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10,14,26,0.95)',
          titleColor: '#00d4ff',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(0,212,255,0.4)',
          borderWidth: 1,
          cornerRadius: 10,
          titleFont: { family: 'Orbitron', size: 12, weight: '600' },
          bodyFont: { family: 'Rajdhani', size: 13 },
          padding: 12,
          displayColors: true,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) ?? 'N/A'}`
          }
        }
      }
    }
  };
}

// ====================================================================
// FETCH AND DRAW GRAPH
// ====================================================================
async function fetchAndDrawGraph() {
  if (isDrawing) {
    console.log("⏳ Already drawing, skip...");
    return;
  }

  isDrawing = true;

  const dev = document.getElementById("hist-device")?.value;
  const fields = getFields();
  const status = document.getElementById("multi-status-realtime");

  if (!status) {
    isDrawing = false;
    return;
  }

  if (!dev || !fields.length) {
    status.textContent = "⟨ Select Device and Fields ⟩";
    isDrawing = false;
    return;
  }

  try {
    const res = await fetch(`/api/json_latest/${dev}?_t=${Date.now()}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const js = await res.json();

    if (!js.latest) {
      status.textContent = "⟨ No data available ⟩";
      isDrawing = false;
      return;
    }

    const now = new Date();
    let updateCount = 0;
    
    // Update history for each field
    fields.forEach(f => {
      const v = Number(js.latest[f]);
      
      if (isNaN(v)) {
        console.warn(`Invalid value for ${f}:`, js.latest[f]);
        return;
      }

      if (!window.graphHistory[f]) {
        window.graphHistory[f] = [];
      }

      window.graphHistory[f].push({ x: now, y: v });
      updateCount++;

      // Keep only last N points
      if (window.graphHistory[f].length > MAX_DATA_POINTS) {
        window.graphHistory[f].shift();
      }
    });

    if (updateCount === 0) {
      status.textContent = "⚠️ No valid data";
      isDrawing = false;
      return;
    }

    // Detect which axes are being used
    const usedAxes = new Set(fields.map(f => axisFor(f)));

    // Get chart type from selector
    const chartTypeSelect = document.getElementById("realtimeChartTypeSelect");
    const chartType = chartTypeSelect ? chartTypeSelect.value : "line";
    const isBar = chartType === "bar";

    // Build datasets based on chart type
    const datasets = fields.map((f, i) => {
      const color = NEON_COLORS[i % NEON_COLORS.length];
      const historyData = [...window.graphHistory[f]];

      // BAR CHART
      if (isBar) {
        return {
          type: "bar",
          label: f,
          data: historyData,
          backgroundColor: color + "BB",
          borderColor: color,
          borderWidth: 2,
          borderRadius: 8,
          barThickness: 'flex',
          maxBarThickness: 20,
          categoryPercentage: 0.65,
          barPercentage: 0.7,
          yAxisID: axisFor(f)
        };
      }

      // LINE CHART (default)
      if (chartType === "line") {
        return {
          type: "line",
          label: f,
          borderColor: color,
          backgroundColor: "transparent",
          data: historyData,
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: color,
          tension: 0.4,
          fill: false,
          yAxisID: axisFor(f),
          spanGaps: true
        };
      }

      // AREA CHART (filled line)
      if (chartType === "area") {
        return {
          type: "line",
          label: f,
          borderColor: color,
          backgroundColor: color + "30",
          data: historyData,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4,
          tension: 0.4,
          fill: true,
          yAxisID: axisFor(f),
          spanGaps: true
        };
      }

      // SCATTER CHART (points only)
      if (chartType === "scatter") {
        return {
          type: "scatter",
          label: f,
          data: historyData,
          backgroundColor: color,
          borderColor: "#0a0e1a",
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          yAxisID: axisFor(f)
        };
      }

      // STEP CHART (stepped line)
      if (chartType === "step") {
        return {
          type: "line",
          label: f,
          borderColor: color,
          backgroundColor: "transparent",
          data: historyData,
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0,
          stepped: "before",
          fill: false,
          yAxisID: axisFor(f),
          spanGaps: true
        };
      }

      // Default to line
      return {
        type: "line",
        label: f,
        borderColor: color,
        backgroundColor: "transparent",
        data: historyData,
        borderWidth: 2.5,
        pointRadius: 2,
        tension: 0.4,
        fill: false,
        yAxisID: axisFor(f)
      };
    });

    const ctx = document.getElementById("realtimeChart")?.getContext("2d");
    
    if (!ctx) {
      console.error("Canvas context not found");
      isDrawing = false;
      return;
    }

    // Create or update chart
    if (!window.realtimeChartInstance) {
      console.log("🎨 Creating new chart instance");
      window.realtimeChartInstance = new Chart(ctx, createChartConfig(datasets, usedAxes));
    } else {
      // Update existing chart
      window.realtimeChartInstance.data.datasets = datasets;
      
      // Update axis visibility
      ['voltAxis', 'currAxis', 'powerAxis', 'freqAxis', 'tempAxis', 'pfAxis'].forEach(axis => {
        if (window.realtimeChartInstance.options.scales[axis]) {
          window.realtimeChartInstance.options.scales[axis].display = usedAxes.has(axis);
        }
      });
      
      window.realtimeChartInstance.update(isFirstDraw ? 'default' : 'none');
    }

    isFirstDraw = false;
    
    // Update status with latest values
    const latestValues = fields.slice(0, 3).map(f => {
      const last = window.graphHistory[f]?.slice(-1)[0];
      return last ? `${f}: ${last.y.toFixed(2)}` : null;
    }).filter(Boolean).join(' • ');

    status.textContent = `✓ Live • ${latestValues}${fields.length > 3 ? ' ...' : ''}`;

  } catch (err) {
    console.error("❌ Realtime fetch error:", err);
    if (status) {
      status.textContent = `⚠️ Connection error`;
    }
  } finally {
    isDrawing = false;
  }
}

// ====================================================================
// INTERVAL CONTROL
// ====================================================================
function startGraphInterval() {
  stopGraphInterval();
  
  const fields = getFields();
  if (!fields.length) {
    console.log("⚠️ No fields selected");
    return;
  }
  
  console.log(`🚀 Starting realtime graph for fields:`, fields);
  
  // Immediate first fetch
  fetchAndDrawGraph();
  
  // Then update every second
  graphInterval = setInterval(() => {
    fetchAndDrawGraph();
  }, 1000);
}

function stopGraphInterval() {
  if (graphInterval) {
    clearInterval(graphInterval);
    graphInterval = null;
    console.log("⏸️ Stopped realtime graph interval");
  }

  if (window.realtimeChartInstance) {
    try {
      window.realtimeChartInstance.destroy();
      window.realtimeChartInstance = null;
      console.log("🗑️ Destroyed chart instance");
    } catch (e) {
      console.warn("Error destroying chart:", e);
    }
  }
}

// ====================================================================
// EXPORTS - ต้องอยู่ท้ายสุด
// ====================================================================
window.initRealtimeGraphModule = initRealtimeGraphModule;
window.startGraphInterval = startGraphInterval;
window.stopGraphInterval = stopGraphInterval;
window.fetchAndDrawGraph = fetchAndDrawGraph;

export {
  initRealtimeGraphModule,
  startGraphInterval,
  stopGraphInterval,
  fetchAndDrawGraph
};

export default {
  initRealtimeGraphModule,
  startGraphInterval,
  stopGraphInterval,
  fetchAndDrawGraph
};