// ===============================================================
//  event_admin.js
//  Admin Event Viewer — For ADD METOR-REALTIME
// ===============================================================

(function () {

  const EVENT_API = "/api/alert/events";
  const CLEAR_EVENT_API = "/api/alert/events/clear";

  const REFRESH_MS = 8000;

  let allEvents = [];

  // DOM Elements
  const els = {
    tbody: document.getElementById("eventTableBody"),
    badge: document.getElementById("eventBadge"),

    filterDevice: document.getElementById("filterDevice"),
    filterDateStart: document.getElementById("filterDateStart"),
    filterDateEnd: document.getElementById("filterDateEnd")
  };

  // ---------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------

  function escapeHtml(s) {
    if (!s) return "";
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

  // ---------------------------------------------------------------
  // Filtering System
  // ---------------------------------------------------------------

  function applyFilter(events) {
    const dev = els.filterDevice.value?.trim()?.toLowerCase();
    const dateStart = els.filterDateStart.value
      ? new Date(els.filterDateStart.value)
      : null;

    const dateEnd = els.filterDateEnd.value
      ? new Date(els.filterDateEnd.value)
      : null;

    return events.filter(ev => {
      // filter device/user
      const combined = `${ev.device || ""} ${ev.user || ""}`.toLowerCase();
      if (dev && !combined.includes(dev)) return false;

      const t = new Date(ev.time);

      if (dateStart && t < dateStart) return false;

      if (dateEnd) {
        const tmax = new Date(dateEnd.getTime() + 86400000);
        if (t > tmax) return false;
      }

      return true;
    });
  }

  // ---------------------------------------------------------------
  // Rendering Table
  // ---------------------------------------------------------------
  function renderEvents(events) {
    els.tbody.innerHTML = "";

    if (!events.length) {
      els.tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-3 text-center text-gray-400">
            ไม่มีข้อมูล Event
          </td>
        </tr>`;
      els.badge.textContent = "0";
      return;
    }

    // ⭐ รวม Event ซ้ำ (Group By)
    const grouped = {};

    events.forEach(ev => {
      const key = `${ev.event}|${ev.type}|${ev.device}|${ev.details}`;

      if (!grouped[key]) {
        grouped[key] = {
          ...ev,
          count: 1
        };
      } else {
        grouped[key].count += 1;

        // อัปเดตเวลาเป็นรายการล่าสุด
        grouped[key].time = ev.time;
      }
    });

    const groupedList = Object.values(grouped);

    // Update count badge
    els.badge.textContent = groupedList.length;

    const frag = document.createDocumentFragment();

    groupedList.forEach(ev => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-200 hover:bg-red-50";

      tr.innerHTML = `
        <td class="p-2">${escapeHtml(formatTime(ev.time))}</td>
        <td class="p-2 capitalize">${escapeHtml(ev.type || "-")}</td>
        <td class="p-2">${escapeHtml(ev.device || ev.user || "-")}</td>
        <td class="p-2">${escapeHtml(ev.event || "-")}</td>
        <td class="p-2 text-gray-600">${escapeHtml(ev.details || "-")}</td>
        <td class="p-2 font-bold text-red-600 text-center">${ev.count}</td>
      `;

      frag.appendChild(tr);
    });

    els.tbody.appendChild(frag);
  }

  // ---------------------------------------------------------------
  // Fetch Events
  // ---------------------------------------------------------------

  let loading = false;
  async function loadEvents() {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(EVENT_API, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      allEvents = Array.isArray(data) ? data : [];
      renderEvents(applyFilter(allEvents));
    } catch (err) {
      console.log("⚠ loadEvents error:", err);
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------
  // Clear Events
  // ---------------------------------------------------------------

  async function clearEvents() {
    if (!confirm("ลบประวัติ Event ทั้งหมด?")) return;

    try {
      const res = await fetch(CLEAR_EVENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) throw new Error("clear failed");

      // Reload
      loadEvents();

    } catch (err) {
      alert("Error clearing events");
      console.log(err);
    }
  }

  // Make function global for HTML button
  window.clearEvents = clearEvents;

  // ---------------------------------------------------------------
  // Filter change
  // ---------------------------------------------------------------

  function wireFilters() {
    ["filterDevice", "filterDateStart", "filterDateEnd"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener("change", () => {
        renderEvents(applyFilter(allEvents));
      });
    });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------

  function init() {
    wireFilters();
    loadEvents();
    setInterval(loadEvents, REFRESH_MS);
  }

  init();

})();
