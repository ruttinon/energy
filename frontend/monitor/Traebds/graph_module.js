// ====================================================================
// graph_module.js – IMPROVED STABILITY & PERFORMANCE
// ====================================================================
const Chart = window.Chart;
const API_BASE = window.location.origin;

window.historyChart = null;
window.isDrawingGraph = false;
window.customRange = { start: null, end: null };

// ====================================================================
// COLOR MANAGEMENT
// ====================================================================
const NEON_COLORS = [
  '#00f5ff', '#8b5cf6', '#f472b6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#a855f7', '#22c55e', '#eab308'
];

function loadColorMap() {
  try {
    return JSON.parse(localStorage.getItem("chartColors") || "{}");
  } catch (e) {
    console.warn("Failed to load color map:", e);
    return {};
  }
}

function saveColorMap(map) {
  try {
    localStorage.setItem("chartColors", JSON.stringify(map));
  } catch (e) {
    console.warn("Failed to save color map:", e);
  }
}

function getColor(key, idx) {
  const saved = loadColorMap();
  return saved[key] || NEON_COLORS[idx % NEON_COLORS.length];
}

// ====================================================================
// SMART TIME UNIT
// ====================================================================
function getSmartTimeUnit(start, end) {
  const diff = end - start;
  const d = 86400000; // 1 day in ms
  
  if (diff <= d) return { unit: "hour", fmt: "HH:mm" };
  if (diff <= 7 * d) return { unit: "day", fmt: "dd MMM HH:mm" };
  if (diff <= 31 * d) return { unit: "day", fmt: "dd MMM" };
  if (diff <= 366 * d) return { unit: "month", fmt: "MMM yyyy" };
  return { unit: "year", fmt: "yyyy" };
}

// ====================================================================
// BUCKET INTERVAL - สำหรับ aggregate data
// ====================================================================
function getBucketInterval(start, end) {
  const diff = end - start;
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  
  if (diff > 180 * day) return day;           // > 6 months: daily
  if (diff > 90 * day) return 6 * hour;       // > 3 months: 6 hours
  if (diff > 31 * day) return hour;           // > 1 month: hourly
  if (diff > 7 * day) return 15 * minute;     // > 1 week: 15 min
  if (diff > 3 * day) return 5 * minute;      // > 3 days: 5 min
  return minute;                               // <= 3 days: 1 min
}

// ====================================================================
// GET SELECTED KEYS
// ====================================================================
export function getSelectedKeys() {
  const checkboxes = document.querySelectorAll("#hist-key-container input[type='checkbox']:checked");
  return Array.from(checkboxes).map(e => e.value);
}

// ====================================================================
// INIT RANGE BUTTONS
// ====================================================================
export function initRangeButtons() {
  const btns = document.querySelectorAll(".range-btn");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");

  if (!startDate || !endDate) {
    console.warn("Date inputs not found");
    return;
  }

  // Set default range (7 days)
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 86400000);

  startDate.value = start.toISOString().split("T")[0];
  endDate.value = now.toISOString().split("T")[0];

  window.customRange = { start, end: now };

  // Range button handlers
  btns.forEach(btn => {
    btn.onclick = () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setQuickRange(btn.dataset.range);
    };
  });

  // Date input handlers
  startDate.onchange = () => {
    try {
      const newStart = new Date(startDate.value);
      if (!isNaN(newStart.getTime())) {
        window.customRange.start = newStart;
        drawCombinedGraph();
      }
    } catch (e) {
      console.error("Invalid start date:", e);
    }
  };

  endDate.onchange = () => {
    try {
      const newEnd = new Date(endDate.value + "T23:59:59");
      if (!isNaN(newEnd.getTime())) {
        window.customRange.end = newEnd;
        drawCombinedGraph();
      }
    } catch (e) {
      console.error("Invalid end date:", e);
    }
  };

  // Set default active button
  const defaultBtn = document.querySelector('.range-btn[data-range="7d"]');
  if (defaultBtn) defaultBtn.classList.add("active");
}

// ====================================================================
// INIT MODULE
// ====================================================================
export function initGraphModule() {
  console.log("🔧 Initializing Graph Module...");
  
  initRangeButtons();
  loadHistoricalSelectors();
  
  const typeSel = document.getElementById("chartTypeSelect");
  if (typeSel) {
    typeSel.onchange = () => {
      console.log("Chart type changed to:", typeSel.value);
      drawCombinedGraph();
    };
  }
  
  console.log("✅ Graph Module Initialized");
}

window.initGraphModule = initGraphModule;

// ====================================================================
// DRAW COMBINED GRAPH - ปรับปรุงความเสถียร
// ====================================================================
export async function drawCombinedGraph() {
  // Prevent concurrent drawing
  if (window.isDrawingGraph) {
    console.log("⏳ Graph drawing already in progress...");
    return;
  }
  
  window.isDrawingGraph = true;
  console.log("📊 Drawing graph...");

  const status = document.getElementById("multi-status");
  const dev = document.getElementById("hist-device")?.value;
  const keys = getSelectedKeys();
  const chartType = document.getElementById("chartTypeSelect")?.value || "line";

  // Validation
  if (!dev) {
    if (status) status.textContent = "⟨ Select Device ⟩";
    window.isDrawingGraph = false;
    return;
  }

  if (!keys.length) {
    if (status) status.textContent = "⟨ Select at least one field ⟩";
    window.isDrawingGraph = false;
    return;
  }

  const { start, end } = window.customRange;
  if (!start || !end) {
    if (status) status.textContent = "⟨ Select time range ⟩";
    window.isDrawingGraph = false;
    return;
  }

  // Destroy existing chart
  if (window.historyChart) {
    try {
      window.historyChart.destroy();
      window.historyChart = null;
    } catch (e) {
      console.warn("Error destroying chart:", e);
    }
  }

  if (status) {
    status.innerHTML = '<span class="loading-dots">⟨ Loading data</span>';
  }

  try {
    const timeFmt = getSmartTimeUnit(start, end);
    const interval = getBucketInterval(start, end);
    const isBar = chartType === "bar";
    
    let bucketMap = {};
    let fetchErrors = 0;

    // Fetch data for all selected keys
    for (const k of keys) {
      try {
        const url = `${API_BASE}/api/history?device=${dev}&key=${k}&start=${start.toISOString()}&end=${end.toISOString()}`;
        console.log(`Fetching ${k}:`, url);
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const js = await res.json();
        const rows = js.history || js.data || [];

        console.log(`${k}: ${rows.length} data points`);

        // Process data into buckets
        for (const d of rows) {
          try {
            const t = new Date(d.timestamp || d.t || d.x).getTime();
            const y = Number(d.value || d.v || d.y);
            
            if (isNaN(t) || isNaN(y)) continue;
            
            const bucket = Math.floor(t / interval) * interval;
            if (!bucketMap[bucket]) bucketMap[bucket] = {};
            
            // Average multiple values in same bucket
            if (bucketMap[bucket][k]) {
              bucketMap[bucket][k] = (bucketMap[bucket][k] + y) / 2;
            } else {
              bucketMap[bucket][k] = y;
            }
          } catch (e) {
            console.warn(`Error processing data point for ${k}:`, e);
          }
        }
      } catch (err) {
        console.error(`Error fetching ${k}:`, err);
        fetchErrors++;
      }
    }

    if (fetchErrors === keys.length) {
      throw new Error("Failed to fetch all data");
    }

    // Sort buckets and create labels
    const sortedBuckets = Object.keys(bucketMap)
      .map(Number)
      .sort((a, b) => a - b);

    if (sortedBuckets.length === 0) {
      if (status) status.textContent = "⚠️ No data available for selected range";
      window.isDrawingGraph = false;
      return;
    }

    const labels = sortedBuckets.map(ts =>
      new Date(ts).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
        hour12: false
      })
    );

    // Build datasets
    const datasets = keys.map((k, idx) => {
      const color = getColor(k, idx);
      
      if (isBar) {
        return {
          type: "bar",
          label: k,
          data: sortedBuckets.map(n => bucketMap[n]?.[k] ?? null),
          backgroundColor: color + "BB",
          borderColor: color,
          borderWidth: 2,
          borderRadius: 8,
          barThickness: 'flex',
          maxBarThickness: 25,
          minBarLength: 2,
          categoryPercentage: 0.7,  // เพิ่มช่องว่างระหว่าง categories
          barPercentage: 0.75        // เพิ่มช่องว่างระหว่างแท่ง
        };
      }

      // Line/Area/Step/Scatter
      return {
        type: "line",
        label: k,
        data: sortedBuckets.map(n => ({ x: n, y: bucketMap[n]?.[k] ?? null })),
        borderColor: color,
        backgroundColor: chartType === "area" ? color + "40" : "transparent",
        borderWidth: chartType === "scatter" ? 0 : 2.5,
        pointRadius: chartType === "scatter" ? 6 : 2,
        pointHoverRadius: chartType === "scatter" ? 8 : 5,
        pointBackgroundColor: color,
        pointBorderColor: chartType === "scatter" ? "#0a0e1a" : color,
        pointBorderWidth: chartType === "scatter" ? 2 : 1,
        pointStyle: chartType === "scatter" ? 'circle' : 'circle',
        tension: chartType === "step" ? 0 : 0.4,
        stepped: chartType === "step" ? "before" : false,
        fill: chartType === "area",
        spanGaps: true,
        showLine: chartType !== "scatter"  // ซ่อนเส้นในโหมด scatter
      };
    });

    // Create chart
    const ctx = document.getElementById("historyChart")?.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context not found");
    }

    window.historyChart = new Chart(ctx, {
      type: isBar ? "bar" : "line",
      data: { 
        labels: isBar ? labels : undefined, 
        datasets 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { 
          duration: 600, 
          easing: 'easeOutQuart' 
        },
        interaction: { 
          intersect: false, 
          mode: 'index' 
        },
        scales: {
          x: isBar
            ? {
                type: "category",
                categoryPercentage: 0.7,  // ลดความกว้างของ category เพิ่มช่องว่าง
                barPercentage: 0.75,      // ลดความกว้างของแท่ง
                grid: { 
                  color: 'rgba(0,245,255,0.08)', 
                  drawBorder: false 
                },
                ticks: { 
                  color: '#94a3b8', 
                  maxRotation: 45,
                  autoSkip: true,
                  maxTicksLimit: 15,
                  font: { family: 'Rajdhani', size: 11 } 
                }
              }
            : {
                type: "time",
                time: { 
                  unit: timeFmt.unit, 
                  displayFormats: { [timeFmt.unit]: timeFmt.fmt },
                  tooltipFormat: "dd MMM yyyy HH:mm"
                },
                grid: { 
                  color: 'rgba(0,245,255,0.08)', 
                  drawBorder: false 
                },
                ticks: { 
                  color: '#94a3b8',
                  autoSkip: true,
                  maxTicksLimit: 12,
                  font: { family: 'Rajdhani', size: 11 } 
                }
              },
          y: {
            grid: { 
              color: 'rgba(0,245,255,0.08)', 
              drawBorder: false 
            },
            ticks: { 
              color: '#94a3b8',
              font: { family: 'Rajdhani', size: 11 }
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: '#e2e8f0',
              font: { family: 'Orbitron', size: 11, weight: '600' },
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
            titleFont: { family: 'Orbitron', size: 13, weight: '600' },
            bodyFont: { family: 'Rajdhani', size: 13 },
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2);
                }
                return label;
              }
            }
          }
        }
      }
    });

    if (status) {
      status.textContent = `✓ Loaded ${datasets.length} series • ${sortedBuckets.length} points`;
    }
    
    console.log("✅ Graph drawn successfully");

  } catch (error) {
    console.error("❌ Error drawing graph:", error);
    if (status) {
      status.textContent = `⚠️ Error: ${error.message}`;
    }
  } finally {
    window.isDrawingGraph = false;
  }
}

// ====================================================================
// SET QUICK RANGE
// ====================================================================
export function setQuickRange(type) {
  const now = new Date();
  let start = new Date();

  switch (type) {
    case "1d":
      start = new Date(now.getTime() - 86400000);
      break;
    case "7d":
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case "1m":
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case "1y":
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start = new Date(now.getTime() - 7 * 86400000);
  }

  window.customRange = { start, end: new Date() };
  
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  
  if (startDateInput) startDateInput.value = start.toISOString().split("T")[0];
  if (endDateInput) endDateInput.value = new Date().toISOString().split("T")[0];
  
  console.log(`Range set to ${type}:`, { start, end: new Date() });
  drawCombinedGraph();
}

// ====================================================================
// LOAD SELECTORS WITH COLOR PICKER
// ====================================================================
export async function loadHistoricalSelectors(preConv = null, preDev = null) {
  const convSel = document.getElementById("hist-conv");
  const devSel = document.getElementById("hist-device");
  const box = document.getElementById("hist-key-container");

  if (!convSel || !devSel || !box) {
    console.warn("Selector elements not found");
    return;
  }

  try {
    console.log("🔄 Loading convertors...");
    const res = await fetch(`/data/convertors.json?_t=${Date.now()}`);
    const convertors = await res.json();

    // =========================================================
    // 1) เติมรายการ Convertor
    // =========================================================
    convSel.innerHTML = `<option value="">⟨ Select Convertor ⟩</option>`;
    Object.entries(convertors).forEach(([cid, c]) => {
      convSel.innerHTML += `<option value="${cid}">${c.name || cid}</option>`;
    });

    // ⭐ Preselect convertor จาก Sidebar
    if (preConv) convSel.value = preConv;
    if (preConv) {
  let tryCount = 0;
  const waitConv = setInterval(() => {
    tryCount++;
    if (convSel.options.length > 1) {
      convSel.value = preConv;
      clearInterval(waitConv);
      convSel.onchange();
    }
    if (tryCount > 20) clearInterval(waitConv); // 2 seconds timeout
  }, 100);
}

    // =========================================================
    // 2) เมื่อ convertor เปลี่ยน → โหลด device
    // =========================================================
    convSel.onchange = async () => {
      const convId = convSel.value;
      const devices = convertors[convId]?.devices || {};

      devSel.innerHTML = `<option value="">⟨ Select Device ⟩</option>`;
      box.innerHTML = `<span class="placeholder-text">⟨ Select Device to load fields ⟩</span>`;

      Object.entries(devices).forEach(([did, d]) => {
        devSel.innerHTML += `<option value="${did}">${d.name || did}</option>`;
      });

      // ⭐ Preselect device ถ้าส่งมาจาก Sidebar
      if (preDev) devSel.value = preDev;

      // ถ้ามี device อยู่แล้ว → โหลด fields ทันที
      if (devSel.value) {
        await loadHistFields(devSel.value, box);
      }

      // =========================================================
      // device onchange → โหลด fields
      // =========================================================
      devSel.onchange = async () => {
        if (!devSel.value) return;
        await loadHistFields(devSel.value, box);
      };
    };

    // ถ้ามาจาก Sidebar → Trigger โหลด devices + fields ทันที
    if (preConv) {
      convSel.onchange();
    }

    console.log("✅ Selectors loaded");

  } catch (err) {
    console.error("Error loading convertors:", err);
    convSel.innerHTML = `<option value="">⚠️ Error loading</option>`;
  }
}


// ========================================================================
// ⭐ ฟังก์ชันโหลด fields สำหรับ Device (แยกออกมาชัดๆ)
// ========================================================================
async function loadHistFields(devId, box) {
  box.innerHTML = `<span class="placeholder-text">⟨ Loading fields... ⟩</span>`;

  try {
    const res = await fetch(`/api/history/keys?device=${devId}`);
    const js = await res.json();
    const savedColors = loadColorMap();

    box.innerHTML = "";
    const keys = js.keys || [];

    console.log(`Loaded ${keys.length} fields for ${devId}`);

    keys.forEach((k, idx) => {
      const row = document.createElement("div");
      row.className = "field-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = k;
      checkbox.id = `field-${k}`;
      checkbox.onchange = () => drawCombinedGraph();

      const label = document.createElement("span");
      label.textContent = k;

      const picker = document.createElement("input");
      picker.type = "color";
      picker.className = "color-picker";
      picker.dataset.key = k;
      picker.value = savedColors[k] || NEON_COLORS[idx % NEON_COLORS.length];
      picker.onchange = () => {
        savedColors[k] = picker.value;
        saveColorMap(savedColors);
        drawCombinedGraph();
      };

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(picker);
      box.appendChild(row);
    });

    if (keys.length === 0) {
      box.innerHTML = `<span class="placeholder-text">⚠️ No fields available</span>`;
    }

  } catch (err) {
    console.error("Error loading fields:", err);
    box.innerHTML = `<span class="placeholder-text">⚠️ Error loading fields</span>`;
  }
}


export default {
  initGraphModule,
  drawCombinedGraph,
  loadHistoricalSelectors,
  getSelectedKeys,
  setQuickRange
};
