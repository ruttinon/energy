// =======================================================
// User Event.js
// Futuristic 3D — Read-only Event Viewer
// Load from /api/alert/events
// =======================================================

(function () {

  const API = "/api/alert/events";  
  const REFRESH_MS = 8000;

  let lastEvents = [];

  const els = {
    eventData: document.getElementById("eventData"),
    eventCount: document.getElementById("eventCount"),

    filterStation: document.getElementById("filter-station"),
    filterFrom: document.getElementById("filter-from"),
    filterTo: document.getElementById("filter-to")
  };

  // SYSTEM HELPERS ----------------------------------------------------

  function timeNow() {
    return new Date().toLocaleString();
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[m]);
  }

  function formatTime(t) {
    const d = new Date(t);
    return isNaN(d) ? t : d.toLocaleString();
  }

  // BUILD DEVICE LIST SAME AS ALERT VIEWER ----------------------------

  function buildDeviceList(events) {
    const devices = Array.from(new Set(
      events.map(ev => ev.device || ev.device_name).filter(Boolean)
    ));

    // Don't override the one already built by Alerts
    if (!els.filterStation) return;

    let html = `<option value="all">All</option>`;
    devices.forEach(d => {
      html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
    });

    // only set if empty
    if (els.filterStation.children.length <= 1) {
      els.filterStation.innerHTML = html;
    }
  }

  // FILTER -------------------------------------------------------------

  function applyFilters(events) {
    const dev = els.filterStation?.value;
    const from = els.filterFrom?.value ? new Date(els.filterFrom.value) : null;
    const to = els.filterTo?.value ? new Date(els.filterTo.value) : null;

    return events.filter(ev => {

      // filter device
      if (dev && dev !== "all") {
        const dname = ev.device || ev.device_name;
        if (dname !== dev) return false;
      }

      const t = new Date(ev.time);

      if (from && t < from) return false;

      if (to) {
        const tmax = new Date(to.getTime() + 86400000);
        if (t > tmax) return false;
      }

      return true;
    });
  }

  // RENDER TABLE -------------------------------------------------------

  function renderEvents(events) {
    els.eventData.innerHTML = "";

    if (!events.length) {
      els.eventData.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">
            No events found
          </td>
        </tr>`;
      els.eventCount.textContent = "0 items";
      return;
    }

    const frag = document.createDocumentFragment();

    events.forEach(ev => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(formatTime(ev.time))}</td>
        <td>${escapeHtml(ev.type || "-")}</td>
        <td>${escapeHtml(ev.device || ev.user || "-")}</td>
        <td>${escapeHtml(ev.event || "-")}</td>
        <td style="color:var(--muted)">${escapeHtml(ev.details || "")}</td>
      `;

      frag.appendChild(tr);
    });

    els.eventData.appendChild(frag);
    els.eventCount.textContent = events.length + " items";
  }

  // FETCH --------------------------------------------------------------
async function fetchEvents() {
  try {
    const res = await fetch(API, { cache: "no-store" });

    if (!res.ok) throw new Error("API Error " + res.status);

    const data = await res.json() || [];

    if (!Array.isArray(data)) throw new Error("Invalid API format");

    lastEvents = data;

    buildDeviceList(data);
    renderEvents(applyFilters(data));

  } catch (err) {
    console.warn("⚠ Fetch Event Error:", err);
    renderEvents([]);
  }
}

  // INIT ----------------------------------------------------------------

  function wireFilters() {
    ["filter-station", "filter-from", "filter-to"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener("change", () => {
        renderEvents(applyFilters(lastEvents));
      });
    });
  }

  function init() {
    wireFilters();
    fetchEvents();
    setInterval(fetchEvents, REFRESH_MS);
  }

  init();

})();
