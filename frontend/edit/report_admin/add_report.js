(function () {
  if (window.__extendAddReport) return;
  window.__extendAddReport = true;

  // CSS URL
  const CSS_URL = '/frontend/edit/report_admin/report_admin.css';

  // Scripts to load
  const SCRIPTS = [
    '/frontend/edit/report_admin/excel_template_manager.js',
    '/frontend/edit/report_admin/excel_quick_editor.js',
    '/frontend/edit/report_admin/excel_help_system.js'
  ];

  // Helper to load scripts sequentially
  async function loadScripts() {
    for (const src of SCRIPTS) {
      if (!document.querySelector(`script[src="${src}"]`)) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
    }
  }

  // Inject CSS Link
  function injectStyles() {
    if (document.getElementById('report-admin-css')) return;
    const link = document.createElement('link');
    link.id = 'report-admin-css';
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);

    // Inline styles for scanline animation & tabs
    const style = document.createElement('style');
    style.textContent = `
        .scanline { position: fixed; top: -100vh; left: 0; width: 100%; height: 100vh; background: linear-gradient(to bottom, rgba(255,0,60,0) 0%, rgba(255,0,60,0.28) 50%, rgba(255,0,60,0) 100%); animation: scan 6s linear infinite; pointer-events: none; z-index: 10; opacity: 0.3; }
        @keyframes scan { 0% { top: -100vh; } 100% { top: 100vh; } }
        .rep-container { position: relative; z-index: 20; width: 100%; padding: 20px; padding-bottom:50px; }
        .loading-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: var(--red-base); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .success-badge { display: inline-block; background: rgba(34,197,94,0.2); color: #22c55e; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-left: 12px; }
        
        /* Tabs */
        .tab-header { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px; }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 10px 20px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; border-radius: 8px; }
        .tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .tab-btn.active { color: #63d1ff; background: rgba(99, 209, 255, 0.1); border-bottom: 2px solid #63d1ff; border-radius: 8px 8px 0 0; margin-bottom: -12px; }
        
        .tab-content { display: none; animation: fadeIn 0.3s ease; }
        .tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `;
    document.head.appendChild(style);
  }

  // --- STATE ---
  let systemData = null;
  let selectedData = null;
  let convertorsInfo = {};
  let aggregatedDevices = null;
  let currentProject = null;
  let currentPeriod = { mode: 'day', value: null };

  async function renderAddReportPage() {
    const area = document.getElementById('content-area');
    area.innerHTML = '';
    injectStyles();
    await loadScripts();

    const container = document.createElement('div');
    container.className = 'rep-container';
    container.innerHTML = `
        <div class="scanline"></div>
        <div class="container">
            <h2 class="ai-glow">🚀 Report Center</h2>
            
            <!-- Tabs -->
            <div class="tab-header">
                <button class="tab-btn active" onclick="switchTab('gen')">📝 Generate Report</button>
                <button class="tab-btn" onclick="switchTab('mgr')">⚙️ Manage Templates</button>
            </div>

            <!-- Tab 1: Generate Report -->
            <div id="tab-gen" class="tab-content active">
                <p style="margin-bottom: 24px; color: #94a3b8;">เลือกข้อมูลจากระบบแล้วสร้างไฟล์รายงานทันที</p>
                
                <!-- Template Selection -->
                <div class="form-section">
                    <label class="selector-label">📊 เลือก Template:</label>
                    <select id="templateSelect" class="big-select">
                        <option value="">-- กำลังโหลด Templates... --</option>
                    </select>
                </div>

                <!-- Auto-Fill Section -->
                <div class="form-section" id="autoFillSection">
                    <div class="auto-fill-header">
                        <div class="section-title">🎯 เลือกข้อมูลอัตโนมัติ (Auto-Fill)</div>
                        <button class="btn btn-blue" id="loadBtn">
                            🔄 โหลดข้อมูลจากระบบ
                        </button>
                    </div>
                    
                    <div class="selector-grid" id="selectorGrid" style="display: none; grid-template-columns: 1fr;">
                        <!-- วันที่ -->
                        <div class="selector-box">
                            <label class="selector-label">📅 เลือกช่วงเวลา:</label>
                            <select id="periodMode" class="big-select">
                                <option value="day">รายวัน</option>
                                <option value="month">รายเดือน</option>
                                <option value="year">รายปี</option>
                            </select>
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <input type="date" id="dateInput" class="big-select" style="flex:1;" />
                                <input type="month" id="monthInput" class="big-select" style="flex:1; display:none;" />
                                <input type="number" id="yearInput" class="big-select" style="flex:1; display:none;" min="2000" max="2100" placeholder="เช่น 2025" />
                            </div>
                        </div>
                        
                        <!-- Converter -->
                        <div class="selector-box">
                            <label class="selector-label">📦 เลือก Converter:</label>
                            <select id="convertorSelect" class="big-select" disabled>
                                <option value="">-- เลือก Converter --</option>
                            </select>
                            <small style="color: #94a3b8; margin-top: 8px; display: block;">
                                เลือก Converter เพื่อดูอุปกรณ์ภายใน หรือเลือก "ทั้งหมด" เพื่อดูทุกอุปกรณ์
                            </small>
                        </div>
                        
                        <!-- อุปกรณ์ -->
                        <div class="selector-box">
                            <label class="selector-label">🔌 เลือกอุปกรณ์:</label>
                            <select id="deviceSelect" class="big-select" disabled>
                                <option value="">-- เลือก Converter ก่อน --</option>
                            </select>
                            <small style="color: #94a3b8; margin-top: 8px; display: block;">
                                เลือกอุปกรณ์เฉพาะตัว หรือเลือกรายงานรวมของ Converter
                            </small>
                        </div>
                    </div>

                    <!-- Data Preview Card -->
                    <div id="dataCard" style="display: none;">
                        <div class="data-card">
                            <div style="font-size: 16px; font-weight: 600; color: var(--white-soft); margin-bottom: 16px;">
                                ✅ ข้อมูลที่จะใช้สร้างรายงาน
                            </div>
                            <div id="dataCardContent"></div>
                        </div>
                    </div>
                </div>

                <!-- Preview JSON -->
                <div class="preview-box">
                    <h4 style="color: var(--white-soft); margin-bottom: 12px;">📄 Preview Data (JSON)</h4>
                    <pre id="previewData">เลือก Template และเลือกข้อมูลเพื่อดูตัวอย่าง</pre>
                </div>

                <!-- Generate Buttons -->
                <div class="form-section">
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-red" id="generateBtn" style="flex: 1; padding: 16px; font-size: 18px;" disabled>
                            🚀 สร้างรายงาน Excel
                        </button>
                        <button class="btn btn-blue" id="generateCSVBtn" style="flex: 1; padding: 16px; font-size: 18px;" disabled>
                            📊 สร้างรายงาน CSV
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Manage Templates -->
            <div id="tab-mgr" class="tab-content">
                <div id="templateManagerContainer">
                    <!-- Template Manager will be rendered here -->
                </div>
            </div>
            
            <div style="margin-top:20px; text-align:center; color:#555; font-size:12px;">
               Enhanced Report Module v2.2 (Integrated)
            </div>
        </div>
    `;
    area.appendChild(container);

    // Bind Internal Events
    document.getElementById('loadBtn').onclick = loadSystemData;
    document.getElementById('periodMode').onchange = onPeriodModeChange;
    document.getElementById('dateInput').onchange = onPeriodValueChange;
    document.getElementById('monthInput').onchange = onPeriodValueChange;
    document.getElementById('yearInput').onchange = onPeriodValueChange;
    document.getElementById('convertorSelect').onchange = onConvertorChange;
    document.getElementById('deviceSelect').onchange = onDeviceChange;
    document.getElementById('generateBtn').onclick = generateExcel;
    document.getElementById('generateCSVBtn').onclick = generateCSV;

    // Global Tab Switcher
    window.switchTab = function (tabName) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      if (tabName === 'gen') {
        document.querySelector(`button[onclick="switchTab('gen')"]`).classList.add('active');
        document.getElementById('tab-gen').classList.add('active');
        loadTemplates(); // Refresh templates dropdown

        // Hide help button if exists (from help system)
        const helpBtn = document.getElementById('helpFloatingBtn');
        if (helpBtn) helpBtn.style.display = 'none';

      } else if (tabName === 'mgr') {
        document.querySelector(`button[onclick="switchTab('mgr')"]`).classList.add('active');
        document.getElementById('tab-mgr').classList.add('active');

        // Check if manager loaded
        if (window.renderTemplateManager) {
          window.renderTemplateManager('templateManagerContainer');
        } else {
          document.getElementById('templateManagerContainer').innerHTML = "<div style='padding:20px; text-align:center;'>Loading module...</div>";
          setTimeout(() => {
            if (window.renderTemplateManager) window.renderTemplateManager('templateManagerContainer');
          }, 1000);
        }

        // Show help button
        const helpBtn = document.getElementById('helpFloatingBtn');
        if (helpBtn) helpBtn.style.display = 'block';
      }
    };

    await initProject();
    await loadTemplates();

    // Set default date to today
    const dateInput = document.getElementById('dateInput');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Default hiding help button
    const helpBtn = document.getElementById('helpFloatingBtn');
    if (helpBtn) helpBtn.style.display = 'none';
  }

  // ... (Existing Functions: initProject, loadTemplates, etc.) ...
  // Re-copying existing logic to keep it working

  async function initProject() {
    try {
      const res = await fetch('/api/active');
      const j = await res.json();
      currentProject = j.active;
    } catch (e) {
      console.error("No active project");
    }
  }

  async function loadTemplates() {
    try {
      // Note: Endpoint might be /api/report/excel/templates OR /api/excel/templates depending on backend
      // excel_router.py uses @router.get("/excel/templates") but it's mounted.
      // Assuming /api/report/excel/templates based on previous file content.
      // But excel_template_manager.js used /api/excel/templates (corrected to /api/report/excel?).
      // Let's use the one that works in previous version: /api/report/excel/templates

      const res = await fetch('/api/report/excel/templates');
      const data = await res.json();
      const select = document.getElementById('templateSelect');
      if (!select) return;

      select.innerHTML = '<option value="">-- เลือก Template ที่ต้องการ --</option>';
      if (data.templates && data.templates.length > 0) {
        data.templates.forEach(tpl => {
          const option = document.createElement('option');
          option.value = tpl.id;
          option.textContent = `📄 ${tpl.filename}`;
          select.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Load error:', err);
    }
  }

  async function loadSystemData() {
    if (!currentProject) {
      alert("No active project");
      return;
    }

    const btn = document.getElementById('loadBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> กำลังโหลด...';
    btn.disabled = true;

    try {
      btn.innerHTML = originalText + ' <span class="success-badge">✓ พร้อมใช้งาน</span>';
      document.getElementById('selectorGrid').style.display = 'grid';
      onPeriodModeChange();

      if (document.getElementById('dateInput').value) {
        await onPeriodValueChange();
      }

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 1500);

    } catch (err) {
      console.error('Load error:', err);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  function onPeriodModeChange() {
    const mode = document.getElementById('periodMode').value;
    const dateIn = document.getElementById('dateInput');
    const monthIn = document.getElementById('monthInput');
    const yearIn = document.getElementById('yearInput');
    dateIn.style.display = mode === 'day' ? 'block' : 'none';
    monthIn.style.display = mode === 'month' ? 'block' : 'none';
    yearIn.style.display = mode === 'year' ? 'block' : 'none';
    currentPeriod.mode = mode;
  }

  async function onPeriodValueChange() {
    if (!currentProject) return;
    const mode = currentPeriod.mode;
    const dateVal = document.getElementById('dateInput').value;
    const monthVal = document.getElementById('monthInput').value;
    const yearVal = document.getElementById('yearInput').value;

    let url = `/api/report/${currentProject}/data/billing`;
    let value = null;
    if (mode === 'day' && dateVal) { url += `?date=${dateVal}`; value = dateVal; }
    if (mode === 'month' && monthVal) { url += `?month=${monthVal}`; value = monthVal; }
    if (mode === 'year' && yearVal) { alert("Yearly not supported yet"); return; }

    if (!value) return;

    try {
      const res = await fetch(url);
      const response = await res.json();
      if (response.status !== 'ok') throw new Error(response.msg);

      systemData = response.data;
      convertorsInfo = systemData.convertors || {};
      currentPeriod.value = value;

      if (mode === 'day') {
        aggregatedDevices = aggregateDevices(systemData.daily);
      } else {
        aggregatedDevices = {}; // Placeholder handling for month
      }

      buildSelectorsFromAggregated();

    } catch (e) {
      console.error(e);
      alert("Error fetching data: " + e.message);
    }
  }

  function aggregateDevices(daily) {
    const agg = {};
    Object.keys(daily || {}).forEach(date => {
      const devs = daily[date].devices || {};
      Object.keys(devs).forEach(id => {
        const info = devs[id];
        if (!agg[id]) {
          agg[id] = {
            device_id: id,
            device_name: info.device_name || id,
            convertor_id: info.convertor_id || 'unknown',
            meter_prev: info.meter_prev || info.meter_start || 0,
            meter_now: info.meter_now || info.meter_end || 0,
            used: 0,
            money: 0
          };
        }
        agg[id].used += info.total_used_today || 0;
        agg[id].money += info.money_today || 0;
        agg[id].meter_now = info.meter_now || info.meter_end || agg[id].meter_now;
      });
    });
    return agg;
  }

  function buildSelectorsFromAggregated() {
    const convertorSelect = document.getElementById('convertorSelect');
    const deviceSelect = document.getElementById('deviceSelect');
    convertorSelect.innerHTML = '<option value="">-- เลือก Converter --</option>';
    deviceSelect.innerHTML = '<option value="">-- เลือก Converter ก่อน --</option>';

    const grouped = {};
    Object.keys(convertorsInfo).forEach(convId => {
      grouped[convId] = { id: convId, name: convertorsInfo[convId].name || convId, devices: [] };
    });
    Object.keys(aggregatedDevices || {}).forEach(deviceId => {
      const info = aggregatedDevices[deviceId];
      const converterId = info.convertor_id || 'unknown';
      if (!grouped[converterId]) grouped[converterId] = { id: converterId, name: converterId, devices: [] };
      grouped[converterId].devices.push({ id: deviceId, name: info.device_name, info });
    });

    const optAll = document.createElement('option');
    const totals = Object.values(aggregatedDevices || {}).reduce((acc, d) => {
      acc.used += d.used || 0;
      acc.money += d.money || 0;
      return acc;
    }, { used: 0, money: 0 });
    optAll.value = '__ALL__';
    optAll.textContent = `🌐 ทั้งหมด (${Object.keys(aggregatedDevices || {}).length} เครื่อง, ${totals.used.toFixed(2)} kWh, ${totals.money.toFixed(2)} บาท)`;
    convertorSelect.appendChild(optAll);

    Object.keys(grouped).sort().forEach(convId => {
      const group = grouped[convId];
      const groupUsed = group.devices.reduce((sum, d) => sum + (d.info.used || 0), 0);
      const groupMoney = group.devices.reduce((sum, d) => sum + (d.info.money || 0), 0);
      if (group.devices.length > 0) {
        const opt = document.createElement('option');
        opt.value = `CONV_${convId}`;
        opt.textContent = `📦 ${group.name} (${group.devices.length} เครื่อง, ${groupUsed.toFixed(2)} kWh, ${groupMoney.toFixed(2)} บาท)`;
        convertorSelect.appendChild(opt);
      }
    });
    convertorSelect.disabled = false;
    deviceSelect.disabled = true;
  }

  function onConvertorChange() {
    const selection = document.getElementById('convertorSelect').value;
    const deviceSelect = document.getElementById('deviceSelect');

    if (!selection) {
      deviceSelect.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
      deviceSelect.disabled = true;
      hideDataCard();
      return;
    }

    deviceSelect.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
    const devices = aggregatedDevices || {};

    if (selection === '__ALL__') {
      const optAllConv = document.createElement('option');
      optAllConv.value = '__ALL_CONVERTERS__';
      optAllConv.textContent = `📦 รายงานทุก Converter รวมกัน`;
      optAllConv.style.fontWeight = '600';
      deviceSelect.appendChild(optAllConv);

      const optAllDev = document.createElement('option');
      optAllDev.value = '__ALL_DEVICES__';
      optAllDev.textContent = `🔌 รายงานทุกอุปกรณ์รวมกัน`;
      optAllDev.style.fontWeight = '600';
      deviceSelect.appendChild(optAllDev);

      Object.keys(devices).sort().forEach(id => {
        const info = devices[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `🔌 ${info.device_name} (${info.used.toFixed(2)} kWh)`;
        deviceSelect.appendChild(opt);
      });
    } else if (selection.startsWith('CONV_')) {
      const convId = selection.replace('CONV_', '');
      const convName = convertorsInfo[convId]?.name || convId;
      const groupDevices = Object.keys(devices).filter(id => devices[id].convertor_id === convId);

      if (groupDevices.length > 0) {
        const optGroup = document.createElement('option');
        optGroup.value = `__CONVERTER_${convId}__`;
        optGroup.textContent = `📦 ${convName} ทั้งหมด`;
        deviceSelect.appendChild(optGroup);
      }

      groupDevices.forEach(id => {
        const info = devices[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `🔌 ${info.device_name} (${info.used.toFixed(2)} kWh)`;
        deviceSelect.appendChild(opt);
      });
    }
    deviceSelect.disabled = false;
    hideDataCard();
  }

  function onDeviceChange() {
    const selection = document.getElementById('deviceSelect').value;
    if (!selection) { hideDataCard(); return; }

    const billing = systemData.billing || {};
    const devices = aggregatedDevices || {};
    const date = currentPeriod.value;
    const month = (currentPeriod.value || '').substring(0, 7);
    const monthlyData = systemData.monthly?.[month] || { units: 0, money: 0 };

    if (selection === '__ALL_CONVERTERS__') {
      const grouped = {};
      Object.keys(devices).forEach(deviceId => {
        const info = devices[deviceId];
        const convId = info.convertor_id || 'unknown';
        if (!grouped[convId]) grouped[convId] = { id: convId, name: convertorsInfo[convId]?.name || convId, devices: [] };
        grouped[convId].devices.push({
          device_id: deviceId,
          device_name: info.device_name || deviceId,
          meter_prev: info.meter_prev || 0,
          meter_now: info.meter_now || 0,
          used: info.used || 0,
          money: info.money || 0
        });
      });

      const totals = Object.values(devices).reduce((acc, d) => {
        acc.used += d.used || 0;
        acc.money += d.money || 0;
        return acc;
      }, { used: 0, money: 0 });

      const convertersWithTotals = Object.values(grouped).map(g => ({
        ...g,
        used: g.devices.reduce((s, d) => s + (d.used || 0), 0),
        money: g.devices.reduce((s, d) => s + (d.money || 0), 0)
      }));

      selectedData = {
        date,
        period_type: currentPeriod.mode,
        selection_type: 'all_converters',
        converters: convertersWithTotals,
        price_per_unit: billing.price_per_unit || 5.0,
        total_used: totals.used,
        total_money: totals.money,
        month_total_units: monthlyData.units || 0,
        month_total_money: monthlyData.money || 0
      };
    } else if (selection === '__ALL_DEVICES__') {
      const allDevices = Object.keys(devices).map(deviceId => {
        const info = devices[deviceId];
        return {
          device_id: deviceId,
          device_name: info.device_name || deviceId,
          meter_prev: info.meter_prev || 0,
          meter_now: info.meter_now || 0,
          used: info.used || 0,
          money: info.money || 0
        };
      });

      const totals = Object.values(devices).reduce((acc, d) => {
        acc.used += d.used || 0;
        acc.money += d.money || 0;
        return acc;
      }, { used: 0, money: 0 });

      const grouped = {};
      Object.keys(devices).forEach(deviceId => {
        const info = devices[deviceId];
        const convId = info.convertor_id || 'unknown';
        if (!grouped[convId]) grouped[convId] = { id: convId, name: convertorsInfo[convId]?.name || convId, devices: [] };
        grouped[convId].devices.push({
          device_id: deviceId,
          device_name: info.device_name || deviceId,
          meter_prev: info.meter_prev || 0,
          meter_now: info.meter_now || 0,
          used: info.used || 0,
          money: info.money || 0
        });
      });

      const converters = Object.values(grouped).map(g => ({
        ...g,
        used: g.devices.reduce((s, d) => s + (d.used || 0), 0),
        money: g.devices.reduce((s, d) => s + (d.money || 0), 0)
      }));

      selectedData = {
        date,
        period_type: currentPeriod.mode,
        selection_type: 'all_devices',
        devices: allDevices,
        converters: converters,
        price_per_unit: billing.price_per_unit || 5.0,
        total_used: totals.used,
        total_money: totals.money,
        month_total_units: monthlyData.units || 0,
        month_total_money: monthlyData.money || 0
      };
    } else if (selection.startsWith('__CONVERTER_')) {
      const converterId = selection.replace('__CONVERTER_', '').replace('__', '');
      const converterName = convertorsInfo[converterId]?.name || converterId;

      const groupDevices = Object.keys(devices)
        .filter(deviceId => devices[deviceId].convertor_id === converterId)
        .map(deviceId => {
          const info = devices[deviceId];
          return {
            device_id: deviceId,
            device_name: info.device_name || deviceId,
            meter_prev: info.meter_prev || 0,
            meter_now: info.meter_now || 0,
            used: info.used || 0,
            money: info.money || 0
          };
        });

      const groupUsed = groupDevices.reduce((sum, d) => sum + d.used, 0);
      const groupMoney = groupDevices.reduce((sum, d) => sum + d.money, 0);

      selectedData = {
        date,
        period_type: currentPeriod.mode,
        selection_type: 'converter',
        converter_id: converterId,
        converter_name: converterName,
        devices: groupDevices,
        price_per_unit: billing.price_per_unit || 5.0,
        total_used: groupUsed,
        total_money: groupMoney,
        month_total_units: monthlyData.units || 0,
        month_total_money: monthlyData.money || 0
      };
    } else {
      const deviceInfo = devices[selection];
      if (!deviceInfo) {
        hideDataCard();
        return;
      }

      selectedData = {
        date,
        period_type: currentPeriod.mode,
        selection_type: 'single',
        device_id: selection,
        device_name: deviceInfo.device_name || selection,
        convertor_id: deviceInfo.convertor_id,
        convertor_name: convertorsInfo[deviceInfo.convertor_id]?.name || deviceInfo.convertor_id,
        meter_prev: deviceInfo.meter_prev || 0,
        meter_now: deviceInfo.meter_now || 0,
        used: deviceInfo.used || 0,
        price_per_unit: billing.price_per_unit || 5.0,
        money: deviceInfo.money || 0,
        total_money: deviceInfo.money || 0,
        month_total_units: monthlyData.units || 0,
        month_total_money: monthlyData.money || 0
      };

      if (deviceInfo.customer) {
        selectedData.customer = deviceInfo.customer;
      }
    }

    showDataCard();
    document.getElementById('previewData').textContent = JSON.stringify(selectedData, null, 2);
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generateCSVBtn').disabled = false;
  }

  function showDataCard() {
    const card = document.getElementById('dataCard');
    const content = document.getElementById('dataCardContent');
    if (!selectedData) return;

    let html = '';
    const p = (l, v) => `<div class="data-row"><div class="data-label">${l}</div><div class="data-value">${v}</div></div>`;

    html += p('📅 วันที่', selectedData.date);
    if (selectedData.total_used !== undefined) html += p('📊 พลังงานรวม', selectedData.total_used.toFixed(2) + ' kWh');
    if (selectedData.total_money !== undefined) html += p('💰 ค่าไฟรวม', selectedData.total_money.toFixed(2) + ' THB');
    if (selectedData.device_id) {
      html += p('🔌 อุปกรณ์', `${selectedData.device_name} (#${selectedData.device_id})`);
      html += p('⚡ ใช้ไป', selectedData.used.toFixed(2) + ' kWh');
      html += p('💵 คิดเป็นเงิน', selectedData.money.toFixed(2) + ' THB');
    }

    content.innerHTML = html;
    card.style.display = 'block';
  }

  function hideDataCard() {
    document.getElementById('dataCard').style.display = 'none';
    selectedData = null;
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('generateCSVBtn').disabled = true;
  }

  function prepareDataForExport(templateId) {
    // Just pass the selectedData structure as is
    return selectedData;
  }

  async function generateExcel() {
    const templateId = document.getElementById('templateSelect').value;
    if (!templateId || !selectedData) return alert("Please select template and data");

    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ กำลังสร้าง...';
    btn.disabled = true;

    try {
      let dataToSend = prepareDataForExport(templateId);

      const res = await fetch('/api/report/report/render/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, data: dataToSend })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${selectedData.date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        btn.innerHTML = '✅ สำเร็จ!';
      } else {
        const txt = await res.text();
        alert("Server Error: " + txt);
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  async function generateCSV() {
    const templateId = document.getElementById('templateSelect').value;
    if (!templateId || !selectedData) return alert("Please select template and data");

    const btn = document.getElementById('generateCSVBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ กำลังสร้าง CSV...';
    btn.disabled = true;

    try {
      let dataToSend = prepareDataForExport(templateId);

      const res = await fetch('/api/report/report/render/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/csv'
        },
        body: JSON.stringify({ template_id: templateId, data: dataToSend })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${selectedData.date}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        btn.innerHTML = '✅ CSV Ready!';
      } else {
        const txt = await res.text();
        alert("Server Error: " + txt);
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  // Helper to update active nav state
  function highlightNav(key) {
    // Try to use global if available (from add_device.js), otherwise use local manual logic
    if (typeof window.highlightNav === 'function') {
      try { return window.highlightNav(key); } catch (e) { }
    }
    // Fallback manual implementation
    const items = document.querySelectorAll('.nav-menu .nav-item');
    items.forEach(el => {
      const t = el.textContent.trim().toLowerCase();
      if (t === key) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  // Hook
  const orig = window.showPage;
  window.showPage = function (page) {
    if (page === 'add_report') {
      renderAddReportPage();
      highlightNav('add_report');
      return;
    }
    return orig(page);
  };

})();
