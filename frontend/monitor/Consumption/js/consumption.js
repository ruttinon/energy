/* =========================================
   💠 Premium Consumption Analysis Script
   ⚡ Real-Time Auto-Refresh Every 5 Seconds
   ========================================= */

const API_URL = "/data/readings.json";
let selectedDevice = null; // 🧠 เก็บชื่อ Device ที่เลือก
let allData = []; // เก็บข้อมูลทั้งหมดไว้ก่อนจะ filter
let currentType = "Ea_plus"; // ประเภทข้อมูลปัจจุบัน
let refreshInterval = null; // ⏰ Interval สำหรับ auto-refresh
let isRefreshing = false; // 🔒 ป้องกัน multiple refresh พร้อมกัน

const REFRESH_INTERVAL = 5000; // 5 วินาที

/* =========================================
   📦 Fetch Data with Enhanced Error Handling
   ========================================= */
async function fetchData() {
  // ป้องกัน concurrent requests
  if (isRefreshing) {
    console.log("⏳ Already refreshing, skipping...");
    return allData;
  }

  try {
    isRefreshing = true;
    
    // แสดง loading state เฉพาะครั้งแรก
    if (allData.length === 0) {
      showLoadingState();
    }

    const res = await fetch(API_URL + "?t=" + Date.now(), { 
      cache: "no-store",
      headers: { 
        'Content-Type': 'application/json' 
      }
    });

    // ตรวจสอบ HTTP status
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json = await res.json();

    // 🔧 แปลง object → array
    const arr = Object.keys(json).map(k => ({
      device_id: json[k].device_id || k,
      time: json[k].timestamp || "-",
      Ea_plus: (json[k].Consumed_kWh || 0) * 1000,  // Wh
      Er_plus: (json[k].Generated_kWh || 0) * 1000, // Wh
      Es: json[k].ActivePower_Total || 0,           // W
    }));

    console.log("✅ Data refreshed:", arr.length, "records");
    allData = arr;
    
    // แสดงเวลา update ล่าสุด
    updateLastRefreshTime();
    
    return arr;

  } catch (err) {
    console.error("❌ Failed to load data:", err);
    showError(`Failed to load data: ${err.message}`);
    return allData; // คืนค่าข้อมูลเก่าถ้า error
  } finally {
    isRefreshing = false;
  }
}

/* =========================================
   ⏰ แสดงเวลา Refresh ล่าสุด
   ========================================= */
function updateLastRefreshTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('th-TH');
  
  // อัปเดตใน console
  console.log(`🔄 Last refresh: ${timeString}`);
  
  // อัปเดตใน UI (ถ้ามี element)
  const refreshTimeEl = document.getElementById('last-refresh-time');
  if (refreshTimeEl) {
    refreshTimeEl.textContent = timeString;
  }
}

/* =========================================
   🔄 Auto Refresh Function
   ========================================= */
async function autoRefresh() {
  console.log("🔄 Auto-refresh triggered");
  
  // โหลดข้อมูลใหม่
  const newData = await fetchData();
  
  // กรองข้อมูลตาม device ที่เลือก
  const filtered = filterByDevice(newData, selectedDevice);
  
  // แสดงผลแบบ smooth (ไม่กระตุก)
  renderTable(filtered, currentType);
}

/* =========================================
   ▶️ เริ่ม Auto-Refresh
   ========================================= */
function startAutoRefresh() {
  // หยุด interval เก่าก่อน (ถ้ามี)
  stopAutoRefresh();
  
  // เริ่ม interval ใหม่
  refreshInterval = setInterval(autoRefresh, REFRESH_INTERVAL);
  
  console.log(`✅ Auto-refresh started (every ${REFRESH_INTERVAL/1000}s)`);
}

/* =========================================
   ⏸️ หยุด Auto-Refresh
   ========================================= */
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log("⏸️ Auto-refresh stopped");
  }
}

/* =========================================
   🖼️ Show Loading State
   ========================================= */
function showLoadingState() {
  const tbody = document.querySelector("#dataTable tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2">
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>Loading real-time data...</div>
          </div>
        </td>
      </tr>
    `;
  }
}

/* =========================================
   ❌ Show Error Message
   ========================================= */
function showError(message) {
  const tbody = document.querySelector("#dataTable tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2">
          <div class="error-message">
            ⚠️ ${message}
            <br><small>Retrying automatically...</small>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Reset summary
  updateSummary([], currentType);
}

/* =========================================
   🧮 Render Table with Data
   ========================================= */
function renderTable(data, type) {
  const tbody = document.querySelector("#dataTable tbody");
  if (!tbody) return;

  // เก็บ scroll position เดิม
  const wrapper = tbody.closest('.table-wrapper');
  const scrollPos = wrapper ? wrapper.scrollTop : 0;

  tbody.innerHTML = "";

  // ตรวจสอบข้อมูลว่าง
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2">
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div class="empty-text">No data available for this device</div>
            <small style="color: var(--text-muted); margin-top: 8px; display: block;">
              Auto-refreshing every ${REFRESH_INTERVAL/1000} seconds...
            </small>
          </div>
        </td>
      </tr>
    `;
    updateSummary([], type);
    document.getElementById("from").textContent = "-";
    document.getElementById("to").textContent = "-";
    return;
  }

  // แสดงข้อมูลในตาราง
  data.forEach(r => {
    const value = r[type] || 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${r.time}</td>
      <td>${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
    `;
    
    // เพิ่ม animation สำหรับ row ใหม่
    row.style.animation = 'fadeIn 0.3s ease-in';
    tbody.appendChild(row);
  });

  // คืน scroll position
  if (wrapper) {
    wrapper.scrollTop = scrollPos;
  }

  // อัปเดต summary และช่วงเวลา
  updateSummary(data, type);
  document.getElementById("from").textContent = data[0]?.time || "-";
  document.getElementById("to").textContent = data[data.length - 1]?.time || "-";
}

/* =========================================
   📊 Update Summary Cards
   ========================================= */
function updateSummary(data, type) {
  const totalEl = document.getElementById("summary-total");
  const avgEl = document.getElementById("summary-avg");

  if (!totalEl || !avgEl) return;

  // กรณีไม่มีข้อมูล
  if (!data || data.length === 0) {
    totalEl.innerHTML = '--<span class="summary-unit">Wh</span>';
    avgEl.innerHTML = '--<span class="summary-unit">Wh</span>';
    return;
  }

  // คำนวณค่า
  const values = data.map(d => d[type] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;

  // แสดงผลพร้อม animation
  totalEl.style.animation = 'pulse 0.5s ease-in-out';
  avgEl.style.animation = 'pulse 0.5s ease-in-out';
  
  totalEl.innerHTML = `
    ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    <span class="summary-unit">Wh</span>
  `;
  
  avgEl.innerHTML = `
    ${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    <span class="summary-unit">Wh</span>
  `;

  // ลบ animation หลังเสร็จ
  setTimeout(() => {
    totalEl.style.animation = '';
    avgEl.style.animation = '';
  }, 500);
}

/* =========================================
   📅 Filter by Date Range (Optional)
   ========================================= */
function filterByDate(data, from, to) {
  if (!from || !to) return data;
  
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  return data.filter(r => {
    const t = new Date(r.time).getTime();
    return t >= fromTime && t <= toTime;
  });
}

/* =========================================
   🔍 Filter by Device
   ========================================= */
function filterByDevice(data, deviceId) {
  if (!deviceId) return data;
  return data.filter(r => r.device_id === deviceId);
}

/* =========================================
   🚀 Initialize Application
   ========================================= */
async function init() {
  // โหลดข้อมูลครั้งแรก
  const data = await fetchData();
  renderTable(data, currentType);

  // ⏰ เริ่ม auto-refresh
  startAutoRefresh();

  // 🔘 ปุ่มเลือกประเภทพลังงาน
  const buttons = document.querySelectorAll(".btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // อัปเดต active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // เปลี่ยนประเภทข้อมูล
      currentType = btn.dataset.type;
      
      // กรองข้อมูลและแสดงผล
      const filtered = filterByDevice(allData, selectedDevice);
      renderTable(filtered, currentType);
      
      console.log(`🔄 Switched to type: ${currentType}`);
    });
  });

  // 📅 ถ้ามีช่องเลือกวันที่ (Optional)
  const fromInput = document.getElementById("fromDate");
  const toInput = document.getElementById("toDate");
  
  if (fromInput && toInput) {
    [fromInput, toInput].forEach(input => {
      input.addEventListener("change", () => {
        let filtered = filterByDevice(allData, selectedDevice);
        filtered = filterByDate(filtered, fromInput.value, toInput.value);
        renderTable(filtered, currentType);
        
        console.log(`📅 Date range changed: ${fromInput.value} to ${toInput.value}`);
      });
    });
  }

  // 🧩 ฟัง event เปลี่ยน device จาก sidebar
  const deviceSelect = document.getElementById("device-select");
  
  if (deviceSelect) {
    deviceSelect.addEventListener("change", async e => {
      selectedDevice = e.target.value;
      console.log("🔄 Device changed:", selectedDevice);

      // ✅ โหลดข้อมูลใหม่ทันที
      const newData = await fetchData();
      const filtered = filterByDevice(newData, selectedDevice);
      renderTable(filtered, currentType);
    });
  } else {
    console.warn("⚠️ Device select element not found. Make sure sidebar is loaded.");
  }

  // 🔄 ปุ่ม Manual Refresh (ถ้ามี)
  const refreshBtn = document.getElementById("manual-refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      console.log("🔄 Manual refresh triggered");
      await autoRefresh();
    });
  }

  // ⏸️ หยุด refresh เมื่อ tab ไม่ active
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log("⏸️ Tab hidden, pausing auto-refresh");
      stopAutoRefresh();
    } else {
      console.log("▶️ Tab visible, resuming auto-refresh");
      startAutoRefresh();
      autoRefresh(); // Refresh ทันทีเมื่อกลับมา
    }
  });

  // เพิ่ม global error handler
  window.addEventListener('unhandledrejection', event => {
    console.error('❌ Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Auto-retry in progress...');
  });

  // Cleanup เมื่อปิดหน้า
  window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
  });
}

/* =========================================
   🎬 Start Application
   ========================================= */
// เริ่มต้นเมื่อ DOM พร้อม
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// เพิ่ม manual refresh function
window.refreshConsumptionData = async function() {
  console.log("🔄 Manual refresh triggered via window function");
  await autoRefresh();
};

// Export functions for external use
window.consumptionModule = {
  refresh: autoRefresh,
  start: startAutoRefresh,
  stop: stopAutoRefresh,
  getCurrentData: () => allData,
  getFilteredData: () => filterByDevice(allData, selectedDevice)
};

// Log เวอร์ชัน
console.log("💠 Consumption Analysis Module v2.1 - Real-Time Edition ⚡");
console.log(`🔄 Auto-refresh enabled (every ${REFRESH_INTERVAL/1000}s)`);