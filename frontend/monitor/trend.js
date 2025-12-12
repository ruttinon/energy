(function () {
  if (window.renderTrends) return;

  // ============================================================
  // โหลด CSS แบบ Inline (Futuristic 5D Theme)
  // ============================================================
  function injectFuturisticCSS() {
    if (document.getElementById("trend-5d-inline-style")) return;

    const style = document.createElement("style");
    style.id = "trend-5d-inline-style";
    style.textContent = `
/* ====================================================================
   🌌 FUTURISTIC 5D ENERGY TREND THEME
==================================================================== */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap');

:root {
  --bg-void: #0a0e1a;
  --bg-deep: #0f1420;
  --glass-panel: rgba(15, 20, 32, 0.65);
  --glass-border: rgba(0, 245, 255, 0.12);
  --neon-cyan: #00f5ff;
  --neon-purple: #8b5cf6;
  --neon-pink: #f472b6;
  --neon-green: #10b981;
  --text-glow: #e2e8f0;
  --text-dim: #94a3b8;
  --glow-cyan: 0 0 20px rgba(0, 245, 255, 0.4);
  --glow-purple: 0 0 20px rgba(139, 92, 246, 0.4);
  --shadow-5d: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.trend-container {
  display: grid;
  grid-template-areas: "header header" "chart sidebar";
  grid-template-columns: 1fr 320px;
  grid-template-rows: 70px 1fr;
  height: 100vh;
  gap: 16px;
  padding: 16px;
  background: radial-gradient(circle at 20% 30%, rgba(0, 245, 255, 0.08) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
              var(--bg-void);
}

.glass-panel {
  background: var(--glass-panel);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--shadow-5d);
  position: relative;
  overflow: hidden;
}

.glass-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--neon-cyan) 50%, transparent 100%);
  opacity: 0.6;
  animation: scanline 3s linear infinite;
}

@keyframes scanline {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

.trend-header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}

.trend-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 2rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #fff 0%, var(--neon-cyan) 50%, var(--neon-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: var(--glow-cyan);
  position: relative;
}

.trend-title::after {
  content: '5D';
  position: absolute;
  top: -8px;
  right: -40px;
  font-size: 0.8rem;
  color: var(--neon-purple);
  font-weight: 700;
  text-shadow: var(--glow-purple);
}

.mode-switcher {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 6px;
  border-radius: 16px;
  border: 1px solid var(--glass-border);
}

.mode-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 10px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.mode-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: var(--neon-cyan);
  transform: translate(-50%, -50%);
  transition: width 0.4s, height 0.4s;
  z-index: -1;
}

.mode-btn.active {
  color: #000;
  box-shadow: var(--glow-cyan);
}

.mode-btn.active::before {
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.mode-btn:hover:not(.active) {
  color: var(--neon-cyan);
  text-shadow: var(--glow-cyan);
}

.chart-container {
  grid-area: chart;
  padding: 24px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.chart-container::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(var(--glass-border) 1px, transparent 1px),
                    linear-gradient(90deg, var(--glass-border) 1px, transparent 1px);
  background-size: 50px 50px;
  opacity: 0.15;
  pointer-events: none;
  border-radius: 20px;
}

#trendChart, #waveformChart {
  flex: 1;
  position: relative;
  z-index: 1;
}

.controls-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  overflow-y: auto;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--neon-cyan);
  text-shadow: var(--glow-cyan);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label::before {
  content: '';
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, var(--neon-cyan), var(--neon-purple));
  border-radius: 2px;
  box-shadow: var(--glow-cyan);
}

.futuristic-input, .futuristic-select {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--glass-border);
  color: var(--text-glow);
  padding: 12px 16px;
  border-radius: 12px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  outline: none;
  transition: all 0.3s;
  cursor: pointer;
}

.futuristic-input:focus, .futuristic-select:focus {
  border-color: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
  background: rgba(0, 245, 255, 0.05);
}

.date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.range-btn {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--glass-border);
  color: var(--text-dim);
  padding: 8px;
  border-radius: 8px;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
}

.range-btn:hover, .range-btn.active {
  border-color: var(--neon-purple);
  color: var(--neon-purple);
  box-shadow: var(--glow-purple);
  background: rgba(139, 92, 246, 0.1);
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 8px;
}

.param-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.param-item:hover {
  background: rgba(0, 245, 255, 0.08);
  border-color: var(--glass-border);
  transform: translateX(4px);
}

.param-checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--text-dim);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s;
}

.param-checkbox:checked {
  background: var(--neon-cyan);
  border-color: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}

.param-checkbox:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #000;
  font-weight: 900;
  font-size: 12px;
}

.param-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 12px currentColor;
  cursor: pointer;
  transition: transform 0.2s;
}

.param-color-dot:hover {
  transform: scale(1.3);
}

.param-label {
  flex: 1;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-glow);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.action-btn {
  background: linear-gradient(135deg, var(--neon-purple) 0%, #7c3aed 100%);
  border: none;
  padding: 14px 20px;
  border-radius: 12px;
  color: #fff;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--glow-purple);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.action-btn:hover::before {
  width: 300px;
  height: 300px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 92, 246, 0.6);
}

.action-btn.stop {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
}

.action-btn.stop:hover {
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.6);
}

.phase-toggles {
  display: flex;
  gap: 16px;
  margin: 12px 0;
}

.phase-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-glow);
  font-weight: 600;
  cursor: pointer;
  transition: color 0.3s;
}

.phase-label:hover {
  color: var(--neon-cyan);
}

.phase-label input[type="checkbox"] {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-dim);
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s;
}

.phase-label input[type="checkbox"]:checked {
  background: var(--neon-green);
  border-color: var(--neon-green);
  box-shadow: 0 0 12px var(--neon-green);
}

.controls-sidebar::-webkit-scrollbar, .param-list::-webkit-scrollbar {
  width: 8px;
}

.controls-sidebar::-webkit-scrollbar-track, .param-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.controls-sidebar::-webkit-scrollbar-thumb, .param-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--neon-cyan), var(--neon-purple));
  border-radius: 4px;
  box-shadow: var(--glow-cyan);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.glass-panel {
  animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.trend-header { animation-delay: 0s; }
.chart-container { animation-delay: 0.1s; }
.controls-sidebar { animation-delay: 0.2s; }

.status-text {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-top: 8px;
  font-weight: 500;
  text-align: center;
}

@media (max-width: 1400px) {
  .trend-container { grid-template-columns: 1fr 280px; }
  .trend-title { font-size: 1.5rem; }
}

@media (max-width: 1024px) {
  .trend-container {
    grid-template-areas: "header" "chart" "sidebar";
    grid-template-columns: 1fr;
    grid-template-rows: 60px 1fr auto;
  }
  .controls-sidebar { max-height: 400px; }
}
    `;

    document.head.appendChild(style);
    console.log("✅ Futuristic 5D CSS loaded");
  }

  function ensureChart(cb) {
    function loadAdapter() {
      if (window.chartjsAdapterLoaded) return cb();
      const a = document.createElement("script");
      a.src = "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns";
      a.onload = () => {
        window.chartjsAdapterLoaded = true;
        cb();
      };
      a.onerror = cb;
      document.body.appendChild(a);
    }
    if (window.Chart) {
      loadAdapter();
    } else {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = loadAdapter;
      s.onerror = cb;
      document.body.appendChild(s);
    }
  }

  function buildUI(content) {
    injectFuturisticCSS(); // โหลด CSS ทันที

    content.innerHTML = `
    <div class="trend-container">
      <!-- Header -->
      <div class="trend-header glass-panel">
        <div class="trend-title">⚡ ENERGY TRENDS</div>
        
        <div class="mode-switcher">
          <button class="mode-btn active" data-mode="realtime">REALTIME</button>
          <button class="mode-btn" data-mode="history">HISTORY</button>
          <button class="mode-btn" data-mode="waveform">WAVEFORM</button>
        </div>
        
        <select id="chartMode" style="display:none">
          <option value="realtime">Realtime</option>
          <option value="history">History</option>
          <option value="waveform">Waveform</option>
        </select>
      </div>

      <!-- Chart -->
      <div class="chart-container glass-panel">
        <canvas id="trendChart"></canvas>
        <canvas id="waveformChart" style="display:none"></canvas>
      </div>

      <!-- Sidebar -->
      <div class="controls-sidebar glass-panel">
        
        <!-- History Controls -->
        <div id="history-controls" class="control-section" style="display:none">
          <div class="section-label">TIME RANGE</div>
          <div class="date-grid">
            <input id="startDate" type="date" class="futuristic-input">
            <input id="endDate" type="date" class="futuristic-input">
          </div>
          
          <div class="range-grid">
            <button class="range-btn" data-r="1d">1D</button>
            <button class="range-btn" data-r="7d">7D</button>
            <button class="range-btn" data-r="1m">1M</button>
            <button class="range-btn" data-r="1y">1Y</button>
          </div>

          <div class="section-label" style="margin-top:16px">CHART TYPE</div>
          <select id="chartTypeSelect" class="futuristic-select">
            <option value="line">🌊 Line Flow</option>
            <option value="area">🌈 Area Glow</option>
            <option value="bar">📊 Bar Stack</option>
            <option value="step">📈 Step Line</option>
            <option value="scatter">✨ Particles</option>
          </select>
        </div>

        <!-- Realtime Controls -->
        <div id="realtime-controls" class="control-section">
          <div class="section-label">LIVE MONITOR</div>
          <select id="realtimeChartTypeSelect" class="futuristic-select">
            <option value="line">🌊 Live Flow</option>
            <option value="area">🌈 Wave Fill</option>
            <option value="bar">📊 Equalizer</option>
            <option value="scatter">✨ Particles</option>
            <option value="step">📈 Step Grid</option>
          </select>
           
          <div class="action-grid">
            <button class="action-btn" id="rt-start">START</button>
            <button class="action-btn stop" id="rt-stop">STOP</button>
          </div>
        </div>
        
        <!-- Waveform Controls -->
        <div id="waveform-controls" class="control-section" style="display:none">
          <input type="hidden" id="hist-device">
          <div class="section-label">PHASE SELECT</div>
          <div class="phase-toggles">
            <label class="phase-label">
              <input type="checkbox" id="wf-l1" checked> L1
            </label>
            <label class="phase-label">
              <input type="checkbox" id="wf-l2" checked> L2
            </label>
            <label class="phase-label">
              <input type="checkbox" id="wf-l3" checked> L3
            </label>
          </div>
          <button class="action-btn" id="wf-refresh">🔬 ANALYZE</button>
          <div id="waveform-status" class="status-text"></div>
        </div>

        <!-- Parameters -->
        <div id="regWrapper" class="control-section" style="flex:1; display:flex; flex-direction:column; min-height:0">
          <div class="section-label">PARAMETERS</div>
          <div id="regSelect" class="param-list"></div>
        </div>
      </div>
    </div>`;
  }

  function getSelectedDevice() {
    return document.getElementById("dev")?.value || "";
  }

  window.renderTrends = function (content) {
    buildUI(content);

    ensureChart(() => {
      const modeSel = document.getElementById("chartMode");
      const histCtr = document.getElementById("history-controls");
      const rtCtr = document.getElementById("realtime-controls");
      const wfCtr = document.getElementById("waveform-controls");
      const regWrap = document.getElementById("regWrapper");
      const devSelSidebar = document.getElementById("dev");

      let chart = null;
      let rtTimer = null;

      const PALETTE = [
        "#00f5ff", "#a855f7", "#22c55e", "#eab308",
        "#ef4444", "#06b6d4", "#10b981", "#8b5cf6"
      ];

      function readColor(key) { return localStorage.getItem("trendColor:" + key); }
      function saveColor(key, val) { localStorage.setItem("trendColor:" + key, val); }

      // Mode buttons
      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          modeSel.value = btn.dataset.mode;
          switchMode();
        };
      });

      function ensureChartInstance() {
        const ctx = document.getElementById("trendChart")?.getContext("2d");
        if (!ctx) return null;

        if (chart) {
          if (!document.body.contains(chart.canvas)) {
            chart.destroy();
            chart = null;
          } else {
            return chart;
          }
        }

        chart = new Chart(ctx, {
          type: "line",
          data: { labels: [], datasets: [] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: '#e2e8f0',
                  font: { family: 'Rajdhani', size: 12, weight: '600' }
                }
              }
            },
            scales: {
              x: {
                type: "time",
                time: { unit: "minute" },
                grid: { color: 'rgba(0,245,255,0.1)' },
                ticks: { color: '#94a3b8' }
              },
              y: {
                grid: { color: 'rgba(0,245,255,0.1)' },
                ticks: { color: '#94a3b8' }
              }
            }
          }
        });

        return chart;
      }

      async function loadHistoryKeys() {
        const dev = getSelectedDevice();
        const regBox = document.getElementById("regSelect");
        if (regBox) regBox.innerHTML = "";

        if (!dev) return [];

        try {
          const pid = document.getElementById("proj")?.value || "";
          const r = await fetch(
            `/api/device/registers?device=${encodeURIComponent(dev)}${pid ? `&project_id=${encodeURIComponent(pid)}` : ""}`
          );
          const j = await r.json();
          const keys = j.registers || [];

          keys.forEach((k, i) => {
            const keyName = k.name || k;

            const wrap = document.createElement("div");
            wrap.className = "param-item";

            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "param-checkbox";
            chk.value = keyName;

            const color = readColor(keyName) || PALETTE[i % PALETTE.length];
            chk.dataset.color = color;

            const dot = document.createElement("div");
            dot.className = "param-color-dot";
            dot.style.backgroundColor = color;

            dot.onclick = (e) => {
              e.stopPropagation();
              const cur = chk.dataset.color;
              const next = PALETTE[(PALETTE.indexOf(cur) + 1) % PALETTE.length];
              chk.dataset.color = next;
              dot.style.backgroundColor = next;
              saveColor(keyName, next);
            };

            const lbl = document.createElement("span");
            lbl.className = "param-label";
            lbl.textContent = keyName;

            wrap.onclick = (e) => {
              if (e.target !== chk && e.target !== dot) {
                chk.checked = !chk.checked;
              }
            };

            wrap.appendChild(chk);
            wrap.appendChild(dot);
            wrap.appendChild(lbl);
            regBox.appendChild(wrap);
          });

          return keys;
        } catch (e) {
          return [];
        }
      }

      function selectedKeys() {
        return Array.from(document.querySelectorAll("#regSelect input[type=checkbox]:checked"))
          .map((c) => c.value);
      }

      function getColorForKey(key) {
        const chk = document.querySelector(`#regSelect input[value="${key}"]`);
        return chk?.dataset?.color || PALETTE[0];
      }

      async function drawHistory() {
        const dev = getSelectedDevice();
        if (!dev) return;

        const keys = selectedKeys();
        if (!keys.length) return;

        ensureChartInstance();

        const sd = document.getElementById("startDate").value;
        const ed = document.getElementById("endDate").value;
        const typeSel = document.getElementById("chartTypeSelect").value;

        const chartType = ["bar", "scatter"].includes(typeSel) ? typeSel : "line";
        chart.config.type = chartType;
        chart.data.datasets = [];

        const pid = document.getElementById("proj")?.value || "";

        for (const k of keys) {
          try {
            const url =
              `/api/history?device=${encodeURIComponent(dev)}&key=${encodeURIComponent(k)}`
              + `&start=${encodeURIComponent(sd + " 00:00:00")}`
              + `&end=${encodeURIComponent(ed + " 23:59:59")}`
              + (pid ? `&project_id=${encodeURIComponent(pid)}` : "");

            const r = await fetch(url);
            const j = await r.json();

            const rows = (j.history || []).map((d) => ({
              x: new Date(String(d.timestamp).replace(" ", "T")),
              y: Number(d.value),
            }));

            const color = getColorForKey(k);
            const ds = { label: k, data: rows, borderColor: color };

            if (chartType === "line") {
              ds.borderWidth = 3;
              ds.tension = 0.4;
              ds.pointRadius = 0;
              if (typeSel === "area") {
                ds.fill = true;
                ds.backgroundColor = color + '40';
              }
              if (typeSel === "step") ds.stepped = true;
            } else if (chartType === "bar") {
              ds.backgroundColor = color;
            }

            chart.data.datasets.push(ds);
          } catch (e) { }
        }

        chart.update();
      }

      async function drawRealtimeStart() {
        const dev = getSelectedDevice();
        if (!dev) return;

        ensureChartInstance();

        const rtType = document.getElementById("realtimeChartTypeSelect").value;
        const chartType = ["bar", "scatter"].includes(rtType) ? rtType : "line";

        if (chart.config.type !== chartType) {
          chart.config.type = chartType;
        }

        const picked = selectedKeys();
        if (!picked.length) {
          chart.data.datasets = [];
          chart.update();
          return;
        }

        const currentDataMap = {};
        chart.data.datasets.forEach(ds => {
          currentDataMap[ds.label] = ds.data;
        });

        chart.data.datasets = picked.map((k) => {
          const color = getColorForKey(k);
          const existingData = currentDataMap[k] || [];

          let ds = {
            label: k,
            data: existingData,
            borderColor: color,
            backgroundColor: chartType === 'bar' ? color : 'transparent',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0
          };

          if (chartType === 'line') {
            if (rtType === 'area') {
              ds.fill = true;
              ds.backgroundColor = color + '40';
            }
            if (rtType === 'step') ds.stepped = true;
          }

          return ds;
        });

        chart.update('none');

        if (rtTimer) clearInterval(rtTimer);

        rtTimer = setInterval(async () => {
          try {
            const pid = document.getElementById("proj")?.value || "";
            const url = pid
              ? `/api/json_latest/${dev}?project_id=${pid}&_t=${Date.now()}`
              : `/api/json_latest/${dev}?_t=${Date.now()}`;
            const r = await fetch(url);
            const j = await r.json();
            const latest = j.latest || {};

            const now = new Date();

            chart.data.datasets.forEach((ds) => {
              const v = Number(latest[ds.label]);
              if (!isNaN(v)) {
                ds.data.push({ x: now, y: v });
              }
              if (ds.data.length > 100) ds.data.shift();
            });

            chart.update('none');
          } catch (e) { }
        }, 1000);
      }

      function stopRealtime() {
        if (rtTimer) {
          clearInterval(rtTimer);
          rtTimer = null;
        }
      }

      let waveformMod = null;
      async function switchMode() {
        const trendCanvas = document.getElementById("trendChart");
        const wfCanvas = document.getElementById("waveformChart");
        const mode = modeSel.value;

        stopRealtime();
        if (waveformMod && waveformMod.stopWaveformInterval) waveformMod.stopWaveformInterval();

        if (mode === "history") {
          histCtr.style.display = "flex";
          rtCtr.style.display = "none";
          if (wfCtr) wfCtr.style.display = "none";
          if (regWrap) regWrap.style.display = "flex";
          if (wfCanvas) wfCanvas.style.display = "none";
          if (trendCanvas) trendCanvas.style.display = "";
          loadHistoryKeys().then(drawHistory);
        } else if (mode === "realtime") {
          histCtr.style.display = "none";
          rtCtr.style.display = "flex";
          if (wfCtr) wfCtr.style.display = "none";
          if (regWrap) regWrap.style.display = "flex";
          if (wfCanvas) wfCanvas.style.display = "none";
          if (trendCanvas) trendCanvas.style.display = "";
          loadHistoryKeys().then(drawRealtimeStart);
        } else {
          // Waveform
          histCtr.style.display = "none";
          rtCtr.style.display = "none";
          if (wfCtr) wfCtr.style.display = "flex";
          if (regWrap) regWrap.style.display = "none";
          if (trendCanvas) trendCanvas.style.display = "none";
          if (wfCanvas) wfCanvas.style.display = "";

          const mirror = document.getElementById("hist-device");
          const devVal = document.getElementById("dev")?.value || "";
          if (mirror) mirror.value = devVal;

          try {
            waveformMod = await import('/frontend/monitor/Traebds/waveform_graph_module.js');
            if (waveformMod && waveformMod.initWaveformGraphModule) {
              waveformMod.initWaveformGraphModule();
            }
          } catch (e) { console.error(e); }
        }
      }

      modeSel.onchange = switchMode;

      document.getElementById("rt-start").onclick = drawRealtimeStart;
      document.getElementById("rt-stop").onclick = stopRealtime;
      document.getElementById("chartTypeSelect").onchange = drawHistory;
      document.getElementById("realtimeChartTypeSelect").onchange = drawRealtimeStart;

      document.querySelectorAll('.range-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const now = new Date();
          let start = new Date();

          switch (btn.dataset.r) {
            case "1d": start = new Date(now.getTime() - 86400000); break;
            case "7d": start = new Date(now.getTime() - 7 * 86400000); break;
            case "1m": start.setMonth(start.getMonth() - 1); break;
            case "1y": start.setFullYear(start.getFullYear() - 1); break;
          }

          document.getElementById("startDate").value = start.toISOString().split("T")[0];
          document.getElementById("endDate").value = now.toISOString().split("T")[0];

          drawHistory();
        };
      });

      if (devSelSidebar) {
        devSelSidebar.onchange = () => {
          const mirror = document.getElementById("hist-device");
          if (mirror) mirror.value = devSelSidebar.value || "";

          if (modeSel.value === "history") {
            loadHistoryKeys().then(drawHistory);
          } else if (modeSel.value === "realtime") {
            loadHistoryKeys().then(drawRealtimeStart);
          } else {
            if (waveformMod && waveformMod.initWaveformGraphModule) {
              setTimeout(() => waveformMod.initWaveformGraphModule(), 120);
            }
          }
        };
      }

      const now = new Date();
      const st = new Date(now.getTime() - 7 * 86400000);
      const stEl = document.getElementById("startDate");
      const enEl = document.getElementById("endDate");
      if (stEl) stEl.value = st.toISOString().split("T")[0];
      if (enEl) enEl.value = now.toISOString().split("T")[0];

      switchMode();
    });
  };
})();
