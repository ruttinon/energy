(function () {
    if (window.renderAlarms) return;

    // ============================================================
    // 1. INJECT CSS (Futuristic 5D Theme)
    // ============================================================
    function injectStyles() {
        if (document.getElementById("alarms-5d-style")) return;
        const style = document.createElement("style");
        style.id = "alarms-5d-style";
        style.textContent = `
/* ===========================================================
   User Alert.css – Futuristic AI / Cyberpunk Theme
   Read-only User Panel – Dark Neon Style
   =========================================================== */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap');

:root {
  --bg-primary: #0a0e1a;
  --bg-secondary: #131825;
  --bg-card: rgba(19, 24, 37, 0.6);
  --cyan-bright: #00d4ff;
  --cyan-glow: #00ffff;
  --purple-accent: #8b5cf6;
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --success: #10b981;
  --warning: #f59e0b;
  --critical: #ef4444;
  --border-glow: rgba(0, 212, 255, 0.3);
  --card-radius: 12px;
}

.alarms-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 20px;
  height: 100%;
  overflow: hidden;
  font-family: 'Rajdhani', sans-serif;
  color: var(--text-primary);
}

.alarms-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(19, 24, 37, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-glow);
  border-radius: var(--card-radius);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
}

.alarms-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-visor {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(139, 92, 246, 0.2));
  border: 1px solid var(--cyan-bright);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  animation: glow 3s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.5); }
  50% { box-shadow: 0 0 30px rgba(0, 212, 255, 0.8); }
}

.robot-glyph {
  width: 32px;
  height: 32px;
}

.alarms-main {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
  overflow: hidden;
}

.left-panel, .right-panel {
  padding: 24px;
  background: rgba(19, 24, 37, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-glow);
  border-radius: var(--card-radius);
  overflow-y: auto;
}

/* STATS */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 16px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.05), rgba(139, 92, 246, 0.05));
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 10px;
  text-align: center;
}

.stat-card .num {
  font-size: 28px;
  font-weight: 700;
  color: var(--cyan-bright);
}

.stat-card .lbl {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

/* FILTERS */
.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filters label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.filter-select, .filter-date {
  width: 100%;
  padding: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 8px;
}
.filter-select option { background: #0f1625; }

/* TABLE */
.alert-table {
  width: 100%;
  border-collapse: collapse;
}

.alert-table th {
  padding: 16px;
  text-align: left;
  font-size: 12px;
  color: var(--cyan-bright);
  text-transform: uppercase;
  border-bottom: 2px solid var(--cyan-bright);
}

.alert-table td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
}

.pill {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.pill.crit { background: rgba(239, 68, 68, 0.2); color: var(--critical); border: 1px solid var(--critical); }
.pill.warn { background: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid var(--warning); }
.pill.normal { background: rgba(16, 185, 129, 0.2); color: var(--success); border: 1px solid var(--success); }

@media (max-width: 1024px) {
  .alarms-main { grid-template-columns: 1fr; }
}
    `;
        document.head.appendChild(style);
    }

    // ============================================================
    // 2. LOGIC
    // ============================================================
    const API = "/api/alert/logs";
    let refreshTimer = null;
    let lastData = [];

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[m]);
    }

    function formatTime(t) {
        const d = new Date(t);
        return isNaN(d) ? t : d.toLocaleString();
    }

    function severityClass(s) {
        if (!s) return 'normal';
        s = s.toLowerCase();
        if (s.includes('crit')) return 'crit';
        if (s.includes('warn')) return 'warn';
        return 'normal';
    }

    function renderTable(data, container) {
        const tbody = container.querySelector('#alertData');
        const liveCount = container.querySelector('#liveCount');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:22px;color:var(--text-muted)">No alerts</td></tr>`;
            if (liveCount) liveCount.textContent = '0 items';
            return;
        }

        const frag = document.createDocumentFragment();
        data.forEach(it => {
            const tr = document.createElement('tr');
            const sev = severityClass(it.severity);
            tr.innerHTML = `
        <td><strong>${escapeHtml(it.device_name || it.device_id)}</strong></td>
        <td>${escapeHtml(it.rule_name || "—")}</td>
        <td style="color:var(--text-muted)">${escapeHtml(it.message || "")}</td>
        <td><span class="pill ${sev}">${escapeHtml(it.severity)}</span></td>
        <td>${escapeHtml(formatTime(it.time))}</td>
      `;
            frag.appendChild(tr);
        });

        tbody.appendChild(frag);
        if (liveCount) liveCount.textContent = data.length + " items";
    }

    function updateStats(data, container) {
        const total = data.length;
        const crit = data.filter(x => severityClass(x.severity) === "crit").length;
        const warn = data.filter(x => severityClass(x.severity) === "warn").length;
        const norm = total - crit - warn;

        const setTxt = (id, val) => {
            const el = container.querySelector('#' + id);
            if (el) el.textContent = val;
        };

        setTxt('stat-total', total);
        setTxt('stat-critical', crit);
        setTxt('stat-warning', warn);
        setTxt('stat-normal', norm);
    }

    function buildStationList(data, container) {
        const sel = container.querySelector('#filter-station');
        if (!sel) return;
        const currentFrom = sel.value; // preserve selection

        const stations = Array.from(new Set(data.map(x => x.device_name || x.device_id))).sort();

        // Only rebuild if options size changed or empty (simple strategy)
        // For perfect sync we might want to be smarter, but let's just rebuild and set value back
        if (sel.options.length === 1 && stations.length > 0) {
            // rebuild
            sel.innerHTML = '<option value="all">All Devices</option>' +
                stations.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            if (currentFrom) sel.value = currentFrom;
        }
    }

    function getFilters(container) {
        return {
            station: container.querySelector('#filter-station')?.value,
            severity: container.querySelector('#filter-severity')?.value,
            from: container.querySelector('#filter-from')?.value,
            to: container.querySelector('#filter-to')?.value
        };
    }

    function applyFilters(data, filters) {
        const { station, severity, from, to } = filters;
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;

        return data.filter(it => {
            const dev = it.device_name || it.device_id;
            if (station && station !== "all" && dev !== station) return false;

            const scls = severityClass(it.severity);
            if (severity && severity !== "all" && scls !== severity) return false;

            const t = new Date(it.time);
            if (fromDate && t < fromDate) return false;
            if (toDate && t > new Date(toDate.getTime() + 86400000)) return false;

            return true;
        });
    }

    async function fetchAlerts(container) {
        try {
            // Use active project ID if available
            const pid = window.MON?.pid || '';
            const url = pid ? `${API}?project_id=${encodeURIComponent(pid)}` : API;

            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("API Error");
            const data = await res.json() || [];

            lastData = Array.isArray(data) ? data : [];

            const timeEl = container.querySelector('#lastUpdated');
            if (timeEl) timeEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

            updateStats(lastData, container);
            buildStationList(lastData, container);

            const filters = getFilters(container);
            renderTable(applyFilters(lastData, filters), container);

        } catch (err) {
            console.warn("Fetch Alert Error:", err);
        }
    }

    // ============================================================
    // 3. RENDER FUNCTION
    // ============================================================
    window.renderAlarms = function (container) {
        if (!container) return;

        // Clean up previous interval if any
        if (refreshTimer) clearInterval(refreshTimer);

        injectStyles();

        container.innerHTML = `
      <div class="alarms-shell">
        <div class="alarms-topbar">
          <div class="alarms-brand">
            <div class="logo-visor">
              <svg class="robot-glyph" viewBox="0 0 64 64">
                <rect x="10" y="18" width="44" height="32" rx="6" fill="rgba(255,255,255,0.12)" stroke="rgba(30,144,255,0.6)" stroke-width="1.6" />
                <circle cx="24" cy="32" r="3.6" fill="white" opacity="0.92" />
                <circle cx="40" cy="32" r="3.6" fill="white" opacity="0.92" />
                <rect x="20" y="10" width="24" height="6" rx="3" fill="rgba(30,144,255,0.12)" stroke="rgba(30,144,255,0.35)" />
              </svg>
            </div>
            <div>
              <h1 style="font-size:20px; font-weight:700; color:var(--text-primary); margin:0;">Alert Viewer</h1>
              <p style="font-size:13px; opacity:0.7; margin:0;">Realtime System Intelligence</p>
            </div>
          </div>
          <div style="display:flex; gap:12px;">
             <div class="pill" style="border:1px solid var(--cyan-bright); color:var(--cyan-bright)" id="lastUpdated">Updated: -</div>
          </div>
        </div>

        <div class="alarms-main">
          <!-- LEFT -->
          <aside class="left-panel">
            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
               <strong style="color:var(--cyan-bright); text-transform:uppercase;">Overview</strong>
               <span style="font-size:11px; opacity:0.6">AUTO REFRESH</span>
            </div>

            <div class="stats-grid">
              <div class="stat-card"><div class="num" id="stat-total">-</div><div class="lbl">Total</div></div>
              <div class="stat-card"><div class="num" id="stat-critical">-</div><div class="lbl">Critical</div></div>
              <div class="stat-card"><div class="num" id="stat-warning">-</div><div class="lbl">Warning</div></div>
              <div class="stat-card"><div class="num" id="stat-normal">-</div><div class="lbl">Normal</div></div>
            </div>

            <strong style="display:block; margin-bottom:8px; color:var(--text-primary); margin-top:20px;">Filters</strong>
            <div class="filters">
              <label>Station</label>
              <select id="filter-station" class="filter-select"><option value="all">All Devices</option></select>

              <label>Severity</label>
              <select id="filter-severity" class="filter-select">
                <option value="all">All Severities</option>
                <option value="crit">Critical</option>
                <option value="warn">Warning</option>
                <option value="normal">Normal</option>
              </select>

              <label>From Date</label>
              <input type="date" id="filter-from" class="filter-date">
              <label>To Date</label>
              <input type="date" id="filter-to" class="filter-date">
            </div>
          </aside>

          <!-- RIGHT -->
          <section class="right-panel">
            <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
              <h2 style="font-size:18px; color:var(--cyan-bright); text-transform:uppercase; margin:0;">Live Alerts</h2>
              <span id="liveCount" style="font-size:12px; opacity:0.7">- items</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="alert-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Rule</th>
                    <th>Message</th>
                    <th>Severity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody id="alertData">
                   <tr><td colspan="5" style="text-align:center; padding:20px;">Loading...</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    `;

        // Bind events
        const filterInputs = container.querySelectorAll('.filter-select, .filter-date');
        filterInputs.forEach(el => {
            el.addEventListener('change', () => {
                const filters = getFilters(container);
                renderTable(applyFilters(lastData, filters), container);
            });
        });

        // Initial Fetch works immediate
        fetchAlerts(container);
        refreshTimer = setInterval(() => fetchAlerts(container), 8000);
    };
})();
