const __cfgBase = (window.__CONFIG && window.__CONFIG.apiBase && String(window.__CONFIG.apiBase).trim())
  ? String(window.__CONFIG.apiBase).replace(/\/$/, '')
  : '';
const __storedBase = (sessionStorage.getItem('API_BASE') || localStorage.getItem('API_BASE') || '').replace(/\/$/, '');
const API_BASE = (() => {
  const origin = String(window.location.origin).replace(/\/$/, '');
  const candidate = String(__cfgBase || __storedBase || '').replace(/\/$/, '');
  if (!candidate) return origin;
  try {
    const u = new URL(candidate);
    const sameHost = u.hostname === window.location.hostname;
    const samePort = u.port === window.location.port;
    return (sameHost && samePort) ? candidate : origin;
  } catch(e) {
    return origin;
  }
})();

let currentDevice = null;
let currentConverter = null;
let allDevicesMap = {};
let templateMap = {};
let overviewTimer = null;
let isRefreshing = false;
let filterChangeTimeout = null;

/* ===========================================================
   📊 จัดกลุ่มข้อมูลตาม Converter → Device → Parameters
   =========================================================== */
function groupDataByStructure(items) {
  const grouped = {};
  
  items.forEach(item => {
    const deviceId = String(item.device_id);
    const deviceInfo = allDevicesMap[deviceId] || { 
      converter: '-', 
      name: `Device #${deviceId}` 
    };
    const converter = deviceInfo.converter || 'Unknown';
    const deviceName = deviceInfo.name;
    
    // สร้างโครงสร้าง: Converter → Device → Parameters
    if (!grouped[converter]) {
      grouped[converter] = {};
    }
    
    if (!grouped[converter][deviceName]) {
      grouped[converter][deviceName] = {
        deviceId: deviceId,
        parameters: []
      };
    }
    
    grouped[converter][deviceName].parameters.push({
      name: item.parameter,
      value: item.value,
      unit: item.unit || '-',
      description: item.description || '-'
    });
  });
  
  return grouped;
}

/* ===========================================================
   🎨 Render ข้อมูลแบบจัดกลุ่ม
   =========================================================== */
function renderGroupedData(groupedData) {
  const tbody = document.getElementById("overview-body");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  // เรียงลำดับ Converter
  const converters = Object.keys(groupedData).sort();
  
  converters.forEach(converter => {
    // สร้าง Converter Group Header
    const converterRow = document.createElement("tr");
    converterRow.className = "converter-group-row";
    converterRow.innerHTML = `
      <td colspan="4" style="padding: 0;">
        <div class="converter-header">
          <div class="converter-icon">⚡</div>
          <div class="converter-info">
            <h3>${converter}</h3>
            <p>${Object.keys(groupedData[converter]).length} Devices</p>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(converterRow);
    
    // เรียงลำดับ Devices ใน Converter นี้
    const devices = Object.keys(groupedData[converter]).sort();
    
    devices.forEach(deviceName => {
      const deviceData = groupedData[converter][deviceName];
      
      // สร้าง Device Section Header
      const deviceRow = document.createElement("tr");
      deviceRow.className = "device-section-row";
      deviceRow.innerHTML = `
        <td colspan="4" style="padding: 0;">
          <div class="device-section">
            <div class="device-header">
              <div class="device-badge">📱 Device</div>
              <div class="device-name">${deviceName}</div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(deviceRow);
      
      // สร้าง Parameters Table
      const tableRow = document.createElement("tr");
      tableRow.className = "parameters-table-row";
      tableRow.innerHTML = `
        <td colspan="4" style="padding: 0 0 20px 40px;">
          <div class="table-wrapper">
            <table class="premium-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${deviceData.parameters.map(param => `
                  <tr>
                    <td>${param.name}</td>
                    <td>${typeof param.value === 'number' ? param.value.toFixed(2) : param.value}</td>
                    <td>${param.unit}</td>
                    <td>${param.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </td>
      `;
      tbody.appendChild(tableRow);
    });
  });
}

/* ===========================================================
   🔄 Setup Filter Event Listeners
   =========================================================== */
function setupFilterListeners() {
  const searchBox = document.getElementById("searchBox");
  const filterCategory = document.getElementById("filterCategory");
  const filterConverter = document.getElementById("filterConverter");
  const filterDevice = document.getElementById("filterDevice");

  if (searchBox) {
    searchBox.removeEventListener("input", applyOverviewFilter);
    searchBox.addEventListener("input", applyOverviewFilter);
  }
  if (filterCategory) {
    filterCategory.removeEventListener("change", applyOverviewFilter);
    filterCategory.addEventListener("change", applyOverviewFilter);
  }
  if (filterConverter) {
    filterConverter.removeEventListener("change", handleConverterChange);
    filterConverter.addEventListener("change", handleConverterChange);
  }
  if (filterDevice) {
    filterDevice.removeEventListener("change", handleDeviceChange);
    filterDevice.addEventListener("change", handleDeviceChange);
  }
}

/* ===========================================================
   ⏰ Update Timestamp
   =========================================================== */
function updateTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
  const timestamp = document.getElementById("timestamp");
  if (timestamp) {
    timestamp.textContent = timeStr;
  }
}

/* ===========================================================
   🔄 จัดการ filter changes จาก sidebar
   =========================================================== */
async function handleFilterChange(event) {
  const { device, converter } = event.detail || {};
  
  if (filterChangeTimeout) {
    clearTimeout(filterChangeTimeout);
    filterChangeTimeout = null;
  }
  
  currentDevice = (device && device !== '') ? device : null;
  currentConverter = (converter && converter !== '') ? converter : null;
  
  filterChangeTimeout = setTimeout(async () => {
    if (isRefreshing) return;
    await refreshOverviewAll();
    filterChangeTimeout = null;
  }, 300);
}

/* ===========================================================
   🚀 เริ่มต้น Overview
   =========================================================== */
export async function updateOverview() {
  console.log("🚀 Overview page initialized");
  
  isRefreshing = false;
  
  if (overviewTimer) {
    clearInterval(overviewTimer);
    overviewTimer = null;
  }
  
  if (filterChangeTimeout) {
    clearTimeout(filterChangeTimeout);
    filterChangeTimeout = null;
  }
  
  try {
    const tbody = document.getElementById("overview-body");
    if (!tbody) {
      console.error("❌ ไม่พบ #overview-body element");
      return;
    }
    
    setupFilterListeners();
    updateTimestamp();
    if (!window.overviewTimestampInterval) {
      window.overviewTimestampInterval = setInterval(updateTimestamp, 1000);
    }
    
    document.removeEventListener('filterChanged', handleFilterChange);
    document.addEventListener('filterChanged', handleFilterChange);
    
    await loadAllDevices();
    populateConverterDropdown();
    populateDeviceDropdown();
    
    const sidebarDev = document.getElementById('dev')?.value || '';
    const sidebarConv = document.getElementById('conv')?.value || '';
    const filterConv = document.getElementById('filterConverter')?.value || '';
    const filterDev = document.getElementById('filterDevice')?.value || '';
    
    currentConverter = (sidebarConv && sidebarConv !== '') ? sidebarConv : ((filterConv && filterConv !== '') ? filterConv : null);
    currentDevice = (sidebarDev && sidebarDev !== '') ? sidebarDev : ((filterDev && filterDev !== '') ? filterDev : null);
    
    await refreshOverviewAll();

    overviewTimer = setInterval(() => {
      if (!isRefreshing) {
        refreshOverviewAll();
      }
    }, 3000);
    
    console.log("✅ Overview timer started (3s interval)");
  } catch (err) {
    console.error("❌ Error initializing overview:", err);
    isRefreshing = false;
  }
}

/* ===========================================================
   🗺️ โหลดข้อมูล devices ทั้งหมด
   =========================================================== */
async function loadAllDevices() {
  try {
    const pidParam = new URLSearchParams(location.search).get('pid') || '';
    const pid = pidParam || window.MON?.pid || '';
    if (!pid) {
      console.warn("⚠️ ไม่มี project_id");
      return;
    }
    
    const res = await fetch(`${API_BASE}/public/projects/${encodeURIComponent(pid)}/devices`);
    if (!res.ok) return;
    const json = await res.json();
    const devices = json.devices || [];
    
    allDevicesMap = {};
    devices.forEach(d => {
      allDevicesMap[String(d.id)] = {
        converter: d.converter || '-',
        name: d.name || `Device #${d.id}`,
        id: String(d.id)
      };
    });
    
    console.log("✅ โหลด devices ทั้งหมด:", allDevicesMap);
  } catch (err) {
    console.error("❌ โหลด devices ผิดพลาด:", err);
  }
}

/* ===========================================================
   📋 Populate Dropdowns
   =========================================================== */
function populateConverterDropdown() {
  const select = document.getElementById("filterConverter");
  if (!select) return;
  
  const converters = new Set();
  Object.values(allDevicesMap).forEach(d => {
    if (d.converter && d.converter !== '-') {
      converters.add(d.converter);
    }
  });
  
  select.innerHTML = `<option value="">All Converters</option>`;
  Array.from(converters).sort().forEach(conv => {
    const opt = document.createElement("option");
    opt.value = conv;
    opt.textContent = conv;
    select.appendChild(opt);
  });
}

function populateDeviceDropdown() {
  const select = document.getElementById("filterDevice");
  if (!select) return;
  
  const devices = Object.values(allDevicesMap);
  
  select.innerHTML = `<option value="">All Devices</option>`;
  devices.sort((a, b) => a.name.localeCompare(b.name)).forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.converter})`;
    select.appendChild(opt);
  });
}

/* ===========================================================
   🔄 Handle Filter Changes
   =========================================================== */
async function handleConverterChange(e) {
  currentConverter = e.target.value || null;
  currentDevice = null;
  const devSelect = document.getElementById("filterDevice");
  if (devSelect) devSelect.value = "";
  await refreshOverviewAll();
}

async function handleDeviceChange(e) {
  currentDevice = e.target.value || null;
  await refreshOverviewAll();
}

/* ===========================================================
   🔄 ดึงข้อมูล readings.json - All Devices
   =========================================================== */
async function refreshOverviewAll() {
  if (isRefreshing) {
    console.log("⏳ Already refreshing, skipping...");
    return;
  }
  isRefreshing = true;

  try {
    const pidParam = new URLSearchParams(location.search).get('pid') || '';
    const pid = pidParam || window.MON?.pid || '';
    if (!pid) {
      console.warn("⚠️ ไม่มี project_id");
      const tbody = document.getElementById("overview-body");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-cell"><div class="loading-spinner"></div><span>Waiting for project...</span></td></tr>';
      }
      isRefreshing = false;
      return;
    }

    const url = `${API_BASE}/public/projects/${encodeURIComponent(pid)}/readings?_t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`ไม่สามารถโหลด readings ได้: ${res.status}`);
    }
    const json = await res.json();
    let items = json.items || [];
    
    if (items.length === 0) {
      const tbody = document.getElementById("overview-body");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-cell"><span>No data available</span></td></tr>';
      }
      isRefreshing = false;
      return;
    }

    const tbody = document.getElementById("overview-body");
    const ts = document.getElementById("timestamp");
    if (ts) ts.textContent = new Date().toLocaleTimeString("th-TH");
    if (!tbody) {
      console.error("❌ ไม่พบ #overview-body element");
      isRefreshing = false;
      return;
    }

    // กรองตาม converter และ device ถ้ามี
    if (currentConverter) {
      items = items.filter(item => {
        const deviceInfo = allDevicesMap[String(item.device_id)];
        return deviceInfo && String(deviceInfo.converter) === String(currentConverter);
      });
    }
    if (currentDevice) {
      items = items.filter(item => {
        return String(item.device_id) === String(currentDevice);
      });
    }

    // จัดกลุ่มข้อมูล
    const groupedData = groupDataByStructure(items);
    
    // Render ข้อมูลแบบจัดกลุ่ม
    renderGroupedData(groupedData);
    
    // เรียกฟิลเตอร์หลัง render เสร็จ
    applyOverviewFilter();

  } catch (err) {
    console.error("❌ โหลด readings ผิดพลาด:", err);
  } finally {
    isRefreshing = false;
  }
}

/* ===========================================================
   🔍 ฟังก์ชันกรองข้อมูล
   =========================================================== */
function applyOverviewFilter() {
  const searchTerm = document.getElementById("searchBox")?.value?.toLowerCase() || "";
  const category = document.getElementById("filterCategory")?.value || "all";
  
  // กรอง Converter Groups
  const converterGroups = document.querySelectorAll(".converter-group-row");
  converterGroups.forEach(group => {
    const nextDevice = group.nextElementSibling;
    let hasVisibleParams = false;
    
    let current = nextDevice;
    while (current && !current.classList.contains("converter-group-row")) {
      if (current.classList.contains("parameters-table-row")) {
        const rows = current.querySelectorAll("tbody tr");
        rows.forEach(row => {
          const name = row.children[0]?.innerText.toLowerCase() || "";
          const desc = row.children[3]?.innerText.toLowerCase() || "";
          let match = true;

          if (searchTerm && !name.includes(searchTerm) && !desc.includes(searchTerm)) {
            match = false;
          }

          if (category !== "all") {
            if (category === "voltage" && !name.includes("voltage")) match = false;
            else if (category === "current" && !name.includes("current")) match = false;
            else if (category === "power" && !name.includes("power")) match = false;
            else if (category === "other" && (name.includes("voltage") || name.includes("current") || name.includes("power"))) match = false;
          }

          row.style.display = match ? "" : "none";
          if (match) hasVisibleParams = true;
        });
      }
      current = current.nextElementSibling;
    }
    
    // ซ่อน Converter Group ถ้าไม่มี parameters ที่แสดง
    let temp = group;
    while (temp && !temp.classList.contains("converter-group-row", 1)) {
      temp.style.display = hasVisibleParams ? "" : "none";
      temp = temp.nextElementSibling;
      if (temp && temp.classList.contains("converter-group-row")) break;
    }
    group.style.display = hasVisibleParams ? "" : "none";
  });
}

/* ===========================================================
   🛑 หยุด Overview Timer
   =========================================================== */
export function stopOverview() {
  console.log("🛑 Stopping Overview...");
  if (overviewTimer) {
    clearInterval(overviewTimer);
    overviewTimer = null;
  }
  if (window.overviewTimestampInterval) {
    clearInterval(window.overviewTimestampInterval);
    window.overviewTimestampInterval = null;
  }
  if (filterChangeTimeout) {
    clearTimeout(filterChangeTimeout);
    filterChangeTimeout = null;
  }
  isRefreshing = false;
  console.log("✅ Overview stopped");
}

window.addEventListener("beforeunload", () => {
  stopOverview();
  document.removeEventListener('filterChanged', handleFilterChange);
});