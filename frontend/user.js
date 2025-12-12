// ===========================================================
// ⚡ WEBVIEW-S ENERGY HUB - USER DASHBOARD
// Version: 3.0 Enhanced
// ===========================================================

'use strict';

// ===========================================================
// 🌐 GLOBAL NAVIGATION
// ===========================================================
function goPage(path) {
  window.location.href = path;
}

function showConfirmModal(message){
  return new Promise((resolve)=>{
    let modal = document.getElementById('confirm-modal');
    if (!modal){
      modal = document.createElement('div');
      modal.id = 'confirm-modal';
      modal.innerHTML = `
        <div class="cm-overlay"></div>
        <div class="cm-box">
          <div class="cm-title">Confirm</div>
          <div class="cm-msg"></div>
          <div class="cm-actions">
            <button class="cm-btn cm-cancel">Cancel</button>
            <button class="cm-btn cm-ok">OK</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const style = document.createElement('style');
      style.textContent = `.cm-overlay{position:fixed;inset:0;background:rgba(4,13,24,.65);backdrop-filter:blur(6px);z-index:9998}
        .cm-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(6,182,212,.08);border:2px solid rgba(6,182,212,.35);border-radius:16px;box-shadow:0 10px 40px rgba(6,182,212,.25);padding:18px 22px;min-width:280px;z-index:9999}
        .cm-title{font-family:'Orbitron',sans-serif;color:#22d3ee;font-weight:800;margin-bottom:8px}
        .cm-msg{color:#cce8ff;margin-bottom:14px}
        .cm-actions{display:flex;gap:10px;justify-content:flex-end}
        .cm-btn{border:1px solid rgba(6,182,212,.35);background:rgba(6,182,212,.12);color:#cce8ff;border-radius:10px;padding:8px 14px;cursor:pointer}
        .cm-btn.cm-ok{background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff}`;
      document.head.appendChild(style);
    }
    modal.querySelector('.cm-msg').textContent = message || '';
    modal.style.display = 'block';
    const onCancel = ()=>{ cleanup(); resolve(false); };
    const onOk = ()=>{ cleanup(); resolve(true); };
    function cleanup(){
      modal.style.display = 'none';
      modal.querySelector('.cm-cancel').removeEventListener('click', onCancel);
      modal.querySelector('.cm-ok').removeEventListener('click', onOk);
    }
    modal.querySelector('.cm-cancel').addEventListener('click', onCancel);
    modal.querySelector('.cm-ok').addEventListener('click', onOk);
  });
}

async function logout() {
  const ok = await showConfirmModal('คุณต้องการออกจากระบบหรือไม่?');
  if (!ok) return;
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch (e) {
    console.warn('Clear storage failed:', e);
  }
  window.location.href = '/frontend/login.html';
}

// ===========================================================
// 🔧 API CONFIGURATION
// ===========================================================
const getAPIBase = () => {
  const cfgBase = (window.__CONFIG?.apiBase && String(window.__CONFIG.apiBase).trim())
    ? String(window.__CONFIG.apiBase).replace(/\/$/, '')
    : '';
  
  const storedBase = (sessionStorage.getItem('API_BASE') || localStorage.getItem('API_BASE') || '').replace(/\/$/, '');
  
  return cfgBase || storedBase || window.location.origin;
};

const API_BASE = getAPIBase();

// ===========================================================
// 📊 STATE MANAGEMENT
// ===========================================================
const state = {
  currentPanel: 'status',
  updateInterval: null,
  isUpdating: false,
  lastUpdateTime: null,
  deviceData: {},
  billingData: {},
  chartInstance: null
};

const CONFIG = {
  UPDATE_INTERVAL: 5000,  // 5 seconds
  RETRY_DELAY: 2000,      // 2 seconds on error
  MAX_RETRIES: 3
};

// ===========================================================
// 🎯 TAB SWITCHING
// ===========================================================
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelName = tab.dataset.panel;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide panels
      document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.add('hidden');
      });
      
      const targetPanel = document.getElementById(`panel-${panelName}`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        state.currentPanel = panelName;
        
        // Trigger update for new panel
        if (panelName === 'billing') {
          updateBillingPanel();
        } else if (panelName === 'status') {
          updateStatusPanel();
        }
      }
    });
  });
}

// ===========================================================
// 🔄 DATA FETCHING
// ===========================================================
async function fetchWithRetry(url, retries = CONFIG.MAX_RETRIES, options = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
        ...options
      });
      if (response.ok) {
        return await response.json();
      }
      if (i === retries - 1) {
        return null;
      }
    } catch (error) {
      const msg = String(error && error.message || '');
      if (msg.includes('Abort') || msg.includes('ERR_ABORTED')) {
        return null;
      }
      if (i === retries - 1) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
  return null;
}

let statusController = null;
async function fetchDeviceStatus(projectId) {
  const url = projectId 
    ? `${API_BASE}/api/devices/status?project_id=${encodeURIComponent(projectId)}&_t=${Date.now()}`
    : `${API_BASE}/api/devices/status?_t=${Date.now()}`;
  if (statusController) try { statusController.abort(); } catch(e) {}
  statusController = new AbortController();
  return await fetchWithRetry(url, CONFIG.MAX_RETRIES, { signal: statusController.signal });
}

async function getActiveProjectId() {
  try { const r = await fetch(`${API_BASE}/public/projects`, { credentials: 'include' }); const j = await r.json(); return j.active || ((j.projects||[])[0]||{}).project_id || ''; } catch(e) { return ''; }
}

async function fetchBillingData(projectId) {
  const pid = projectId || await getActiveProjectId();
  return await fetchWithRetry(`${API_BASE}/api/billing/summary_excel?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`);
}

async function fetchBillingDaily(projectId) {
  const pid = projectId || await getActiveProjectId();
  const month = new Date().toISOString().slice(0,7);
  const url = `${API_BASE}/api/billing/chart/daily_excel?project_id=${encodeURIComponent(pid)}&month=${month}&_t=${Date.now()}`;
  return await fetchWithRetry(url);
}

async function fetchConvertorSummary(projectId) {
  const pid = projectId || await getActiveProjectId();
  const url = `${API_BASE}/api/billing/convertor_summary?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`;
  return await fetchWithRetry(url);
}

// ===========================================================
// 📈 STATUS PANEL UPDATE
// ===========================================================
async function updateStatusPanel() {
  if (state.isUpdating) return;
  
  state.isUpdating = true;
  
  try {
    const projectId = new URLSearchParams(location.search).get('pid') || 
                     localStorage.getItem('project_id') || '';

    const data = await fetchDeviceStatus(projectId);

    if (!data) {
      // Avoid noisy logs on navigation abort
      // console.warn('⚠️ No status data received');
      return;
    }
    
    // Update summary stats
    updateStatusSummary(data);
    
    // Update device table
    updateDeviceTable(data.devices || []);
    
    // Update timestamp
    updateTimestamp();
    
    state.deviceData = data;
    
  } catch (error) {
    // Ignore abort-related errors silently
    const msg = String(error && error.message || '');
    if (msg.includes('Abort') || msg.includes('ERR_ABORTED')) return;
    console.error('❌ Status panel update failed:', error);
    showError('Unable to fetch device status');
  } finally {
    state.isUpdating = false;
  }
}

function updateStatusSummary(data) {
  const online = data.summary?.online || 0;
  const offline = data.summary?.offline || 0;
  const total = data.summary?.total || 0;
  
  animateValue('sum-online', online);
  animateValue('sum-offline', offline);
  animateValue('sum-total', total);
}

function updateDeviceTable(devices) {
  const tbody = document.getElementById('system-table');
  if (!tbody) return;
  
  if (!devices || devices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
          <div style="font-size:16px; margin-bottom:8px;">ไม่พบอุปกรณ์</div>
          <div style="font-size:13px; opacity:0.7;">ยังไม่มีอุปกรณ์ในระบบ</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = devices.map(device => `
    <tr>
      <td>${escapeHtml(device.convertor || '—')}</td>
      <td>${escapeHtml(device.name || device.device_id || '—')}</td>
      <td><code style="font-size:12px; color:var(--primary-cyan);">${escapeHtml(device.ip_address || '—')}</code></td>
      <td>${formatDateTime(device.last_update)}</td>
      <td>
        <span class="status-${device.status === 'online' ? 'online' : 'offline'}">
          ${device.status === 'online' ? '🟢 Online' : '🔴 Offline'}
        </span>
      </td>
    </tr>
  `).join('');
}

// ===========================================================
// 💰 BILLING PANEL UPDATE
// ===========================================================
async function updateBillingPanel() {
  if (state.isUpdating) return;
  
  state.isUpdating = true;
  
  try {
    const projectId = new URLSearchParams(location.search).get('pid') || 
                     localStorage.getItem('project_id') || '';
    const data = await fetchBillingData(projectId);
    if (!data) {
      console.warn('⚠️ No billing data received');
      return;
    }
    const d = data.data || data || {};
    const summary = {
      today_kwh: Number(d.today_units || d.today_kwh || 0),
      month_kwh: Number(d.month_units || d.month_kwh || 0),
      month_cost: Number(d.month_money || d.month_cost || 0)
    };
    updateBillingSummary({ summary });
    let daily = await fetchBillingDaily(projectId);
    let chartRows = (daily.data || daily || {}).data || daily.data || [];
    if (!Array.isArray(chartRows) || chartRows.length === 0) {
      const pid2 = projectId || await getActiveProjectId();
      const month = new Date().toISOString().slice(0,7);
      const r2 = await fetchWithRetry(`${API_BASE}/api/billing/chart/daily_excel?project_id=${encodeURIComponent(pid2)}&month=${month}&_t=${Date.now()}`);
      chartRows = (r2.data || r2 || {}).data || r2.data || [];
    }
    const chartData = (Array.isArray(chartRows) ? chartRows.map(r => ({ date: String(r.day), energy: Number(r.value||0), cost: Number(r.cost||0) })) : []);
    updateBillingChart(chartData);
    
    // Update details table from convertor summary
    const conv = await fetchConvertorSummary(projectId);
    const cm = (conv && (conv.data || conv)) || {};
    const details = Object.keys(cm).map(cid => ({
      convertor: (cm[cid]||{}).convertor_name || cid,
      device_count: ((cm[cid]||{}).meters || []).length,
      today_kwh: Number((cm[cid]||{}).today_units || 0),
      today_cost: Number((cm[cid]||{}).today_money || 0),
      month_kwh: Number((cm[cid]||{}).month_units || 0),
      month_cost: Number((cm[cid]||{}).month_money || 0)
    }));
    updateBillingTable(details);
    
    state.billingData = data;
    
  } catch (error) {
    console.error('❌ Billing panel update failed:', error);
    showError('Unable to fetch billing data');
  } finally {
    state.isUpdating = false;
  }
}

function updateBillingSummary(data) {
  const today = data.summary?.today_kwh || 0;
  const month = data.summary?.month_kwh || 0;
  const cost = data.summary?.month_cost || 0;
  
  animateValue('bill-today', today, 2);
  animateValue('bill-month', month, 2);
  animateValue('bill-money', cost, 2);
}

function updateBillingChart(chartData) {
  const canvas = document.getElementById('billingChart');
  const messageDiv = document.getElementById('chart-message');
  
  if (!canvas) return;
  
  if (!chartData || chartData.length === 0) {
    canvas.style.display = 'none';
    if (messageDiv) messageDiv.style.display = 'block';
    return;
  }
  
  canvas.style.display = 'block';
  if (messageDiv) messageDiv.style.display = 'none';
  
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
  
  // Create new chart (dual dataset bar chart)
  state.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.map(d => d.date || d.label),
      datasets: [
        {
          label: 'พลังงาน (kWh)',
          data: chartData.map(d => d.energy || 0),
          yAxisID: 'y',
          backgroundColor: 'rgba(99, 209, 255, 0.3)',
          borderColor: '#63d1ff',
          borderWidth: 2
        },
        {
          label: 'ค่าใช้จ่าย (บาท)',
          data: chartData.map(d => d.cost || 0),
          yAxisID: 'y1',
          backgroundColor: 'rgba(229, 9, 20, 0.25)',
          borderColor: '#E50914',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(6, 182, 212, 0.1)' }
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          ticks: { color: '#94a3b8' },
          grid: { drawOnChartArea: false }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(6, 182, 212, 0.1)' }
        }
      }
    }
  });
}

function updateBillingTable(details) {
  const tbody = document.getElementById('billing-table');
  if (!tbody) return;
  
  if (!details || details.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">
          <div style="font-size:16px; margin-bottom:8px;">ไม่พบข้อมูลค่าใช้จ่าย</div>
          <div style="font-size:13px; opacity:0.7;">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
        </td>
      </tr>
    `;
    return;
  }
  
  const nf = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  tbody.innerHTML = details.map(item => `
    <tr>
      <td>${escapeHtml(item.convertor || '—')}</td>
      <td style="text-align:right">${item.device_count || 0}</td>
      <td style="text-align:right">${nf.format(item.today_kwh || 0)}</td>
      <td style="text-align:right">${nf.format(item.today_cost || 0)}</td>
      <td style="text-align:right">${nf.format(item.month_kwh || 0)}</td>
      <td style="text-align:right">${nf.format(item.month_cost || 0)}</td>
    </tr>
  `).join('');
}

// ===========================================================
// 🎨 UI UTILITIES
// ===========================================================
function animateValue(elementId, targetValue, decimals = 0) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const currentValue = parseFloat(element.textContent) || 0;
  const difference = targetValue - currentValue;
  const steps = 20;
  const stepValue = difference / steps;
  let currentStep = 0;
  
  const interval = setInterval(() => {
    currentStep++;
    const newValue = currentValue + (stepValue * currentStep);
    
    if (currentStep >= steps) {
      element.textContent = targetValue.toFixed(decimals);
      clearInterval(interval);
    } else {
      element.textContent = newValue.toFixed(decimals);
    }
  }, 50);
}

function updateTimestamp() {
  const element = document.getElementById('updateTime');
  if (!element) return;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  element.textContent = timeStr;
  state.lastUpdateTime = now;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  console.error('❌', message);
  // You can implement a toast notification here
}

// ===========================================================
// 🔄 AUTO UPDATE LOOP
// ===========================================================
function startAutoUpdate() {
  // Initial update
  if (state.currentPanel === 'status') {
    updateStatusPanel();
  } else if (state.currentPanel === 'billing') {
    updateBillingPanel();
  }
  
  // Set interval for updates
  if (state.updateInterval) {
    clearInterval(state.updateInterval);
  }
  
  state.updateInterval = setInterval(() => {
    if (state.isUpdating) return;
    if (state.currentPanel === 'status') {
      updateStatusPanel();
    } else if (state.currentPanel === 'billing') {
      updateBillingPanel();
    }
  }, CONFIG.UPDATE_INTERVAL);
}

function stopAutoUpdate() {
  if (state.updateInterval) {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  }
}

// ===========================================================
// 🎬 INITIALIZATION
// ===========================================================
function initDashboard() {
  console.log('🚀 Initializing WEBVIEW-S Dashboard...');
  
  // Set project name in header
  const projectName = new URLSearchParams(location.search).get('project') || 
                     localStorage.getItem('project_name') || 
                     'DEFAULT';
  
  const projNameElement = document.getElementById('projName');
  if (projNameElement) {
    projNameElement.textContent = projectName;
  }
  
  // Initialize tabs
  initTabs();
  
  // Start auto-update
  startAutoUpdate();
  
  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoUpdate();
    } else {
      startAutoUpdate();
    }
  });
  
  console.log('✅ Dashboard initialized successfully');
}

// ===========================================================
// 🎯 EXPORTS & EVENT LISTENERS
// ===========================================================
window.goPage = goPage;
window.logout = logout;
window.refreshDashboard = () => {
  if (state.currentPanel === 'status') {
    updateStatusPanel();
  } else if (state.currentPanel === 'billing') {
    updateBillingPanel();
  }
};

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoUpdate();
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
});
