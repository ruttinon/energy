// =======================================================
// User Alert.js (Correct URL: /api/alert/logs)
// =======================================================

(function () {
  const API = "/api/alert/logs";   // <<<<< เส้นทางจริงของระบบนาย
  const REFRESH_MS = 8000;

  let lastData = [];

  const els = {
    lastUpdated: document.getElementById('lastUpdated'),
    statTotal: document.getElementById('stat-total'),
    statCrit: document.getElementById('stat-critical'),
    statWarn: document.getElementById('stat-warning'),
    statNorm: document.getElementById('stat-normal'),
    alertData: document.getElementById('alertData'),
    liveCount: document.getElementById('liveCount'),
    filterStation: document.getElementById('filter-station'),
    filterSeverity: document.getElementById('filter-severity'),
    filterFrom: document.getElementById('filter-from'),
    filterTo: document.getElementById('filter-to')
  };

  function timeNow() {
    return new Date().toLocaleString();
  }

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

  function renderTable(data) {
    els.alertData.innerHTML = '';

    if (!data.length) {
      els.alertData.innerHTML = `
        <tr><td colspan="5" style="text-align:center;padding:22px;color:var(--muted)">No alerts</td></tr>`;
      els.liveCount.textContent = '0 items';
      return;
    }

    const frag = document.createDocumentFragment();

    data.forEach(it => {
      const tr = document.createElement('tr');
      const sev = severityClass(it.severity);

      tr.classList.add("severity-" + sev);

      tr.innerHTML = `
        <td><strong>${escapeHtml(it.device_name || it.device_id)}</strong></td>
        <td>${escapeHtml(it.rule_name || "—")}</td>
        <td style="color:var(--muted)">${escapeHtml(it.message || "")}</td>
        <td><span class="pill ${sev}">${escapeHtml(it.severity)}</span></td>
        <td>${escapeHtml(formatTime(it.time))}</td>
      `;

      frag.appendChild(tr);
    });

    els.alertData.appendChild(frag);
    els.liveCount.textContent = data.length + " items";
  }

  function updateStats(data) {
    const total = data.length;
    const crit = data.filter(x => severityClass(x.severity) === "crit").length;
    const warn = data.filter(x => severityClass(x.severity) === "warn").length;
    const norm = total - crit - warn;

    els.statTotal.textContent = total;
    els.statCrit.textContent = crit;
    els.statWarn.textContent = warn;
    els.statNorm.textContent = norm;
  }

  function buildStationList(data) {
    const stations = Array.from(
      new Set(data.map(x => x.device_name || x.device_id))
    ).sort();

    els.filterStation.innerHTML =
      '<option value="all">All Devices</option>' +
      stations.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  }

  function applyFilters(data) {
    const station = els.filterStation.value;
    const sev = els.filterSeverity.value;
    const from = els.filterFrom.value ? new Date(els.filterFrom.value) : null;
    const to = els.filterTo.value ? new Date(els.filterTo.value) : null;

    return data.filter(it => {
      const dev = it.device_name || it.device_id;

      if (station !== "all" && dev !== station) return false;

      const scls = severityClass(it.severity);
      if (sev !== "all" && scls !== sev) return false;

      const t = new Date(it.time);
      if (from && t < from) return false;
      if (to && t > new Date(to.getTime() + 86400000)) return false;

      return true;
    });
  }

async function fetchAlerts() {
  try {
    const res = await fetch(API, { cache: "no-store" });

    if (!res.ok) throw new Error("API Error " + res.status);

    const data = await res.json() || [];

    if (!Array.isArray(data)) throw new Error("Invalid API format");

    lastData = data;

    els.lastUpdated.textContent = `Updated: ${timeNow()}`;
    updateStats(data);
    buildStationList(data);
    renderTable(applyFilters(data));

  } catch (err) {
    console.warn("⚠ Fetch Alert Error:", err);

    // ป้องกันหน้า freeze เวลา API ล่ม
    renderTable([]);
    els.lastUpdated.textContent = "Updated: connection lost";
  }
}


  function init() {
    ["filter-station", "filter-severity", "filter-from", "filter-to"]
      .forEach(id =>
        document.getElementById(id)?.addEventListener("change", () => {
          renderTable(applyFilters(lastData));
        })
      );

    fetchAlerts();
    setInterval(fetchAlerts, REFRESH_MS);
  }

  init();
})();
