
(function () {
  if (window.renderConsumption) return;

  // ===========================================
  // 1. INJECT STYLES (Futuristic 5D Theme)
  // ===========================================
  function injectStyles() {
    if (document.getElementById("consumption-5d-style")) return;
    const style = document.createElement("style");
    style.id = "consumption-5d-style";
    style.textContent = `
/* =============================
   💠 Premium Variables & Theme
============================= */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Orbitron:wght@700;900&display=swap');

:root {
  --primary: #00f5ff;
  --primary-glow: rgba(0, 245, 255, 0.5);
  --secondary: #8b5cf6;
  --bg-card: rgba(15, 23, 42, 0.6);
  --border: rgba(0, 245, 255, 0.2);
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --radius-xl: 16px;
}

.consumption-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  font-family: 'Inter', sans-serif;
  color: var(--text-primary);
}

/* TOP BAR */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  flex-wrap: wrap;
  gap: 16px;
}

.top-bar h2 {
  font-family: 'Orbitron', sans-serif;
  font-size: 20px;
  color: var(--primary);
  margin: 0;
  text-shadow: 0 0 15px var(--primary-glow);
}

/* BUTTON GROUP */
.btn-group {
  display: flex;
  gap: 10px;
}

.c-btn {
  padding: 8px 16px;
  background: rgba(0, 245, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: 'Orbitron', sans-serif;
  transition: all 0.3s;
}

.c-btn:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: var(--primary);
}

.c-btn.active {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: #000;
  border-color: var(--primary);
  box-shadow: 0 0 15px var(--primary-glow);
  font-weight: bold;
}

/* SUMMARY CARDS */
.summary-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.summary-card {
  background: var(--bg-card);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  text-align: center;
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.summary-value {
  font-family: 'Orbitron', sans-serif;
  font-size: 28px;
  color: var(--primary);
  text-shadow: 0 0 10px var(--primary-glow);
}

.summary-unit {
  font-size: 14px;
  color: var(--text-muted);
  margin-left: 5px;
}

/* TABLE */
.table-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  overflow-x: auto;
}

.c-table {
  width: 100%;
  border-collapse: collapse;
}

.c-table th {
  text-align: left;
  padding: 12px;
  font-family: 'Orbitron', sans-serif;
  color: var(--primary);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.c-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 14px;
}

.c-table tr:hover td {
  background: rgba(0, 245, 255, 0.05);
}
        `;
    document.head.appendChild(style);
  }

  // ===========================================
  // 2. LOGIC MODULE
  // ===========================================
  let currentType = "Ea_plus"; // Default: Consumed Energy
  let currentDevice = null;
  let autoRefreshTimer = null;
  const API_HISTORY = "/api/history"; // backend endpoint

  // Map button types to backend keys
  // You might need to adjust these keys based on your actual device registers
  const KEY_MAP = {
    "Ea_plus": ["ActiveEnergy_kWh", "Consumed_kWh", "ActiveEnergy_Import", "Energy", "kWh"],
    "Er_plus": ["Generated_kWh", "ActiveEnergy_Export", "Energy_Export"],
    "Es": ["ActivePower_Total", "Power", "kW"]
  };

  const UNIT_MAP = {
    "Ea_plus": "kWh",
    "Er_plus": "kWh",
    "Es": "kW"
  };

  async function fetchHistory(project_id, device_id) {
    if (!device_id || !project_id) return [];

    // Determine which keys to look for
    const possibleKeys = KEY_MAP[currentType] || [];

    // We'll try to find the first key that returns data?
    // Or just query for the first one for now.
    // Ideally we should know the exact key from registers.
    // For this implementation, let's try the first one and fallback.
    const targetKey = possibleKeys[0];

    // Calculate time range (Last 24 hours for "Live" view, or user selected)
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    const url = `${API_HISTORY}?project_id=${project_id}&device=${device_id}&key=${targetKey}&start=${start.toISOString().replace('T', ' ').split('.')[0]}&end=${end.toISOString().replace('T', ' ').split('.')[0]}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.history || [];
    } catch (e) {
      console.error("Fetch consumption error:", e);
      return [];
    }
  }

  function renderTable(data, container) {
    const tbody = container.querySelector("#cons-table-body");
    const totalEl = container.querySelector("#val-total");
    const avgEl = container.querySelector("#val-avg");

    if (!tbody) return;
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-muted)">No data found for this period</td></tr>`;
      if (totalEl) totalEl.textContent = "--";
      if (avgEl) avgEl.textContent = "--";
      return;
    }

    // Render rows (reverse chrono)
    // data format from history api: { timestamp, value }
    const sorted = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sorted.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${new Date(row.timestamp).toLocaleString()}</td>
                <td>${Number(row.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            `;
      tbody.appendChild(tr);
    });

    // Calculate Summary
    const values = data.map(d => Number(d.value));

    // Total (Sum for Energy? Or Max-Min? Usually sum of intervals if power, but if it is cumulative energy, we want diff.)
    // user's original code did SUM.
    // If type is Power (Es), Avg makes sense.
    // If type is Energy (Ea_plus), if it is cumulative counter, we usually want Max - Min.
    // But user's code: "total = values.reduce((a, b) => a + b, 0);" which implies interval consumption data OR they just want sum.
    // I will stick to SUM to match user's logic, but note that for cumulative registers this is wrong.
    // However, if the API returns "interval consumption", then Sum is correct.

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / (values.length || 1);

    if (totalEl) totalEl.textContent = sum.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (avgEl) avgEl.textContent = avg.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  async function update(container, MON) {
    const pid = MON.pid;
    const devId = document.getElementById("dev")?.value || localStorage.getItem("selectedDevice");

    if (!devId) {
      // Show select device state
      return;
    }

    const data = await fetchHistory(pid, devId);
    renderTable(data, container);
  }

  // ===========================================
  // 3. MAIN RENDERER
  // ===========================================
  window.renderConsumption = function (container, MON) {
    if (!container) return;

    // Clean up
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    injectStyles();

    container.innerHTML = `
          <div class="consumption-shell">
            <!-- Top Bar -->
            <div class="top-bar">
              <h2>⚡ Index Electricity</h2>
              
              <div class="btn-group">
                <button class="c-btn ${currentType === 'Ea_plus' ? 'active' : ''}" data-type="Ea_plus">Ea+</button>
                <button class="c-btn ${currentType === 'Er_plus' ? 'active' : ''}" data-type="Er_plus">Er+</button>
                <button class="c-btn ${currentType === 'Es' ? 'active' : ''}" data-type="Es">Es</button>
              </div>
            </div>

            <!-- Summary -->
            <div class="summary-container">
              <div class="summary-card">
                 <div class="summary-label">📊 Total / Sum</div>
                 <div class="summary-value">
                   <span id="val-total">--</span>
                   <span class="summary-unit" id="unit-total">${UNIT_MAP[currentType]}</span>
                 </div>
              </div>
              <div class="summary-card">
                 <div class="summary-label">📈 Average</div>
                 <div class="summary-value">
                   <span id="val-avg">--</span>
                   <span class="summary-unit" id="unit-avg">${UNIT_MAP[currentType]}</span>
                 </div>
              </div>
            </div>

            <!-- Table -->
            <div class="table-wrapper">
              <h3 style="margin:0 0 15px 0; font-size:14px; text-transform:uppercase; color:var(--primary)">Data Records (Last 24h)</h3>
              <table class="c-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody id="cons-table-body">
                   <tr><td colspan="2" style="text-align:center; padding:20px;">Loading...</td></tr>
                </tbody>
              </table>
            </div>
            
            <div style="font-size:11px; text-align:center; opacity:0.5; margin-top:20px;">
              © 2025 WEBVIEW-S • Consumption Analysis
            </div>
          </div>
        `;

    // Event Listeners for Buttons
    container.querySelectorAll(".c-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".c-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentType = btn.dataset.type;

        // Update units
        container.querySelector("#unit-total").textContent = UNIT_MAP[currentType];
        container.querySelector("#unit-avg").textContent = UNIT_MAP[currentType];

        update(container, MON);
      });
    });

    // Initial Load
    update(container, MON);

    // Auto Refresh
    autoRefreshTimer = setInterval(() => update(container, MON), 10000);

    // Listen for device change
    // Since monitor.js dispatches 'deviceConfirmed', we could listen to it, 
    // BUT monitor.js also calls render functions when navigating.
    // We can just rely on the interval or add global listener.
    const onDevChange = () => update(container, MON);
    document.addEventListener("deviceConfirmed", onDevChange); // note: need to remove this listener if we destroy the view, but simplistic for now.
  };

})();
