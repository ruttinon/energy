(function () {
  if (window.__billingAdminLoaded) return;
  window.__billingAdminLoaded = true;

  function injectBillingStyles() {
    if (document.getElementById('billing-pro-styles')) return;
    const style = document.createElement('style');
    style.id = 'billing-pro-styles';
    style.textContent = `
            .billing-container { padding: 20px; color: #cce8ff; max-height: calc(100vh - 140px); overflow-y: auto; }
            
            .billing-header {
                background: linear-gradient(135deg, #113246 0%, #0f2232 100%);
                border: 1px solid #2c6b8a;
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .billing-title { font-size: 24px; color: #63d1ff; font-weight: 600; }
            
            /* Stats Grid - Compact */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }
            .stat-card {
                background: linear-gradient(180deg, rgba(17,50,70,0.8), rgba(15,34,50,0.8));
                border: 1px solid #274b61;
                border-radius: 10px;
                padding: 12px;
                text-align: center;
            }
            .stat-card.highlight {
                border-color: #63d1ff;
                box-shadow: 0 0 15px rgba(99, 209, 255, 0.2);
            }
            .stat-label { color: #9bd0e8; font-size: 12px; margin-bottom: 6px; }
            .stat-value { font-size: 22px; font-weight: bold; color: #63d1ff; }
            .stat-unit { font-size: 12px; color: #9bd0e8; margin-left: 3px; }
            
            /* 2-Column Layout: Controls | Chart */
            .main-grid {
                display: grid;
                grid-template-columns: 320px 1fr;
                gap: 16px;
                margin-bottom: 16px;
                height: auto;
                min-height: 420px;
            }
            
            /* Left Panel: Controls */
            .control-panel {
                background: linear-gradient(180deg, rgba(17,50,70,0.7), rgba(15,34,50,0.7));
                border: 1px solid #274b61;
                border-radius: 12px;
                padding: 16px;
                overflow-y: auto;
            }
            .control-panel h3 {
                color: #63d1ff;
                font-size: 15px;
                margin: 0 0 12px 0;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .price-section, .export-section { margin-bottom: 16px; }
            .price-input-group {
                display: flex;
                gap: 8px;
            }
            .price-input-group input {
                flex: 1;
                background: #0f2232;
                border: 1px solid #355e75;
                border-radius: 8px;
                padding: 8px;
                color: #cce8ff;
                font-size: 13px;
            }
            
            .export-buttons {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .export-section h4 {
                margin: 12px 0 6px;
                color: #9bd0e8;
                font-size: 12px;
                font-weight: 600;
            }
            .export-btn {
                background: linear-gradient(135deg, #113246 0%, #0f2232 100%);
                border: 1px solid #274b61;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .export-btn:hover {
                border-color: #63d1ff;
                transform: translateX(3px);
                box-shadow: 0 2px 8px rgba(99, 209, 255, 0.2);
            }
            .export-btn.primary {
                border-color: #3da9d4;
                background: linear-gradient(135deg, #2c6b8a 0%, #1a4a5f 100%);
            }
            .export-btn .icon { font-size: 16px; }
            .export-btn .text {
                flex: 1;
                text-align: left;
                color: #cce8ff;
                font-weight: 500;
                font-size: 13px;
            }
            .export-btn .text span {
                display: block;
                font-size: 10px;
                color: #9bd0e8;
                margin-top: 1px;
            }
            
            /* Right Panel: Chart */
            .chart-section {
                background: linear-gradient(180deg, rgba(17,50,70,0.7), rgba(15,34,50,0.7));
                border: 1px solid #274b61;
                border-radius: 12px;
                padding: 16px;
                display: flex;
                flex-direction: column;
            }
            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .card-title {
                color: #63d1ff;
                font-size: 16px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .chart-tabs {
                display: flex;
                gap: 6px;
            }
            .chart-tab {
                background: #0f2232;
                border: 1px solid #274b61;
                color: #9bd0e8;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 12px;
            }
            .chart-tab.active {
                background: #2c6b8a;
                border-color: #3da9d4;
                color: white;
            }
            .chart-container {
                flex: 1;
                position: relative;
                min-height: 0;
            }
            
            /* Tabs Section */
            .tabs-section { margin: 16px 0 12px; }
            .tabs-nav {
                display: flex;
                gap: 8px;
                border-bottom: 2px solid #274b61;
            }
            .tab-btn {
                background: transparent;
                border: none;
                color: #9bd0e8;
                padding: 10px 16px;
                cursor: pointer;
                position: relative;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
            }
            .tab-btn:hover { color: #63d1ff; }
            .tab-btn.active { color: #63d1ff; }
            .tab-btn.active::after {
                content: '';
                position: absolute;
                bottom: -2px;
                left: 0;
                right: 0;
                height: 2px;
                background: #63d1ff;
            }
            .badge {
                background: #2c6b8a;
                color: white;
                padding: 1px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: bold;
            }
            
            /* Table Section */
            .tabContent { margin-top: 12px; }
            .tabContent.hidden { display: none; }
            .table-card {
                background: linear-gradient(180deg, rgba(17,50,70,0.7), rgba(15,34,50,0.7));
                border: 1px solid #274b61;
                border-radius: 12px;
                padding: 16px;
                max-height: none;
                overflow-y: auto;
            }
            .table-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .table-title {
                color: #63d1ff;
                font-size: 16px;
                font-weight: 600;
            }
            .table-actions {
                display: flex;
                gap: 8px;
            }
            
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            thead {
                background: #0f2232;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            th {
                color: #9bd0e8;
                text-align: left;
                padding: 10px;
                font-weight: 600;
                border-bottom: 2px solid #274b61;
            }
            td {
                padding: 10px;
                border-bottom: 1px solid #1a3a4f;
                color: #cce8ff;
            }
            tbody tr:hover { background: rgba(99, 209, 255, 0.05); }
            .text-muted { color: #9bd0e8; }
            
            /* Buttons */
            .btn {
                background: #113246;
                border: 1px solid #2c6b8a;
                color: #cce8ff;
                padding: 8px 14px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                font-weight: 500;
            }
            .btn:hover {
                border-color: #63d1ff;
                color: #63d1ff;
                box-shadow: 0 0 12px rgba(99, 209, 255, 0.3);
            }
            .btn-primary {
                background: #2c6b8a;
                border-color: #3da9d4;
                color: white;
            }
            .btn-primary:hover {
                background: #3da9d4;
            }
            .btn-secondary {
                background: #1a3a4f;
            }
            .btn-sm {
                padding: 5px 10px;
                font-size: 11px;
            }
            .btn-icon {
                width: 32px;
                padding: 8px;
            }
            
            /* Modal */
            .modal-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.75);
                z-index: 1000;
                justify-content: center;
                align-items: center;
            }
            .modal-overlay.active { display: flex; }
            .modal {
                background: linear-gradient(180deg, #0f2232, #0b1821);
                border: 1px solid #63d1ff;
                border-radius: 14px;
                padding: 20px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 10px;
                border-bottom: 1px solid #274b61;
            }
            .modal-header h2 {
                color: #63d1ff;
                margin: 0;
                font-size: 18px;
            }
            .modal-close {
                background: none;
                border: none;
                color: #9bd0e8;
                font-size: 22px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
            }
            .modal-close:hover { color: #63d1ff; }
            .modal-footer {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 16px;
                padding-top: 10px;
                border-top: 1px solid #274b61;
            }
            
            /* Scrollbar */
            .billing-container::-webkit-scrollbar,
            .control-panel::-webkit-scrollbar,
            .table-card::-webkit-scrollbar,
            .modal::-webkit-scrollbar {
                width: 8px;
            }
            .billing-container::-webkit-scrollbar-track,
            .control-panel::-webkit-scrollbar-track,
            .table-card::-webkit-scrollbar-track,
            .modal::-webkit-scrollbar-track {
                background: #0f2232;
                border-radius: 4px;
            }
            .billing-container::-webkit-scrollbar-thumb,
            .control-panel::-webkit-scrollbar-thumb,
            .table-card::-webkit-scrollbar-thumb,
            .modal::-webkit-scrollbar-thumb {
                background: #2c6b8a;
                border-radius: 4px;
            }
        `;
    document.head.appendChild(style);
  }

  const BILLING_HTML = `
  <div class="billing-container">
    
    <div class="billing-header">
      <div class="billing-title">💰 Billing Administration</div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" onclick="window.BillingApp.openTemplateManager()">🎨 เทมเพลต</button>
        <button class="btn btn-secondary" onclick="window.BillingApp.reload()">🔄 รีเฟรช</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">พลังงานวันนี้</div>
        <div class="stat-value"><span id="sumTodayUnit">0.000</span> <span class="stat-unit">kWh</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ค่าไฟวันนี้</div>
        <div class="stat-value"><span id="sumTodayMoney">0.00</span> <span class="stat-unit">บาท</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">พลังงานเดือน</div>
        <div class="stat-value"><span id="sumMonthUnit">0.000</span> <span class="stat-unit">kWh</span></div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-label">ค่าไฟเดือน</div>
        <div class="stat-value"><span id="sumMonthMoney">0.00</span> <span class="stat-unit">บาท</span></div>
      </div>
    </div>

    <div class="main-grid">
      
      <div class="control-panel">
        <div class="price-section">
          <h3>💰 ราคาค่าไฟ</h3>
          <div class="price-input-group">
            <input type="number" id="priceInput" placeholder="บาท/หน่วย" step="0.01">
            <button class="btn btn-primary btn-icon" onclick="window.BillingApp.savePrice()" title="บันทึก">✓</button>
          </div>
        </div>

        <div class="export-section">
          <h3>📄 ส่งออก PDF</h3>
          <h4>📊 สรุปผลการใช้ไฟ</h4>
          <div class="export-buttons">
            <button class="export-btn" onclick="window.BillingApp.exportSummary('day')">
              <div class="icon">📅</div>
              <div class="text">รายวัน<span>สรุปเฉพาะวันนี้</span></div>
            </button>
            <button class="export-btn" onclick="window.BillingApp.exportSummary('month')">
              <div class="icon">🗓️</div>
              <div class="text">รายเดือน<span>สรุปทั้งเดือน</span></div>
            </button>
            <button class="export-btn" onclick="window.BillingApp.exportSummary('year')">
              <div class="icon">📆</div>
              <div class="text">รายปี<span>สรุปทั้งปี</span></div>
            </button>
          </div>
          
          <h4>📚 รายงานรวม (PDF รวม)</h4>
          <div class="export-buttons">
            <button class="export-btn primary" onclick="window.BillingApp.exportMerged('day')">
              <div class="icon">📄</div>
              <div class="text">รายวัน<span>สรุป + บิลทุกเครื่อง</span></div>
            </button>
            <button class="export-btn primary" onclick="window.BillingApp.exportMerged('month')">
              <div class="icon">📘</div>
              <div class="text">รายเดือน<span>รวมทั้งเดือน</span></div>
            </button>
          </div>
        </div>
      </div>

      <div class="chart-section">
        <div class="card-header">
          <div class="card-title"><span>📈</span> กราฟการใช้พลังงาน</div>
          <div class="chart-tabs">
            <button class="chart-tab active" onclick="window.BillingApp.switchChart('day')">รายวัน</button>
            <button class="chart-tab" onclick="window.BillingApp.switchChart('month')">รายเดือน</button>
            <button class="chart-tab" onclick="window.BillingApp.switchChart('year')">รายปี</button>
            <input id="monthPicker" type="month" style="margin-left:8px;" onchange="window.BillingApp.switchChart('day')" />
            <input id="yearPicker" type="number" min="2000" max="2100" style="width:80px;margin-left:8px;" onchange="window.BillingApp.switchChart('month')" />
          </div>
        </div>
        <div class="chart-container">
          <canvas id="energyChart"></canvas>
        </div>
      </div>

    </div>

    <div class="tabs-section">
      <div class="tabs-nav">
        <button class="tab-btn active" onclick="window.BillingApp.switchTab('tabDevices')">
          💡 รายเครื่อง <span class="badge" id="deviceCount">0</span>
        </button>
        <button class="tab-btn" onclick="window.BillingApp.switchTab('tabConvertors')">
          ⚙️ รายกลุ่ม <span class="badge" id="convertorCount">0</span>
        </button>
        <button class="tab-btn" onclick="window.BillingApp.switchTab('tabTotal')">
          📦 สรุปรวม
        </button>
      </div>
    </div>

    <div id="tabDevices" class="tabContent">
      <div class="table-card">
        <div class="table-header">
          <div class="table-title">รายการอุปกรณ์ทั้งหมด</div>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.BillingApp.loadDevicesTable()">🔄</button>
            <button class="btn btn-secondary btn-sm" onclick="window.BillingApp.exportExcelToday()">📤 ส่งออก Excel วันนี้</button>
            <button class="btn btn-primary btn-sm" onclick="window.BillingApp.generateAllBills()">📑 ออกบิลทั้งหมด</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>อุปกรณ์</th>
              <th>มิเตอร์ก่อน</th>
              <th>มิเตอร์ปัจจุบัน</th>
              <th>ใช้วันนี้ (kWh)</th>
              <th>ค่าไฟวันนี้</th>
              <th>อัปเดต</th>
              <th>ออกบิล</th>
            </tr>
          </thead>
          <tbody id="tbDevicesBody">
            <tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">กำลังโหลด...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="tabConvertors" class="tabContent hidden">
      <div class="table-card">
        <div class="table-header">
          <div class="table-title">กลุ่ม Convertor</div>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.BillingApp.loadConvertorTable()">🔄</button>
            <button class="btn btn-primary btn-sm" onclick="window.BillingApp.generateAllConvertorBills()">📑 ออกบิลกลุ่ม</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Convertor</th>
              <th>อุปกรณ์</th>
              <th>ใช้วันนี้</th>
              <th>ค่าไฟวันนี้</th>
              <th>ใช้เดือน</th>
              <th>ค่าไฟเดือน</th>
              <th>ออกบิล</th>
            </tr>
          </thead>
          <tbody id="tbConvertorsBody">
            <tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="tabTotal" class="tabContent hidden">
      <div class="table-card">
        <div class="table-header">
          <div class="table-title">สรุปรวมทั้งระบบ</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ประเภท</th>
              <th>พลังงาน (kWh)</th>
              <th>ค่าใช้จ่าย (บาท)</th>
            </tr>
          </thead>
          <tbody id="tbTotalBody">
            <tr><td colspan="3" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="templateManager" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>🎨 จัดการเทมเพลต</h2>
          <button class="modal-close" onclick="window.BillingApp.closeTemplateManager()">×</button>
        </div>
        <div class="modal-body">
          <div id="templateManagerList"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.BillingApp.closeTemplateManager()">ปิด</button>
          <button class="btn btn-primary" onclick="window.BillingApp.createNewTemplate()">➕ สร้างเทมเพลต</button>
        </div>
      </div>
    </div>

  </div>
  `;

  window.BillingApp = {
    defaultTemplate: null,
    _chart: null,
    init: function () {
      this.loadPrice();
      this.loadSummary();
      this.loadDevicesTable();
      this.initChart();
      this.loadDefaultTemplate();
      const mp = document.getElementById('monthPicker');
      if (mp && !mp.value) mp.value = new Date().toISOString().slice(0,7);
      const yp = document.getElementById('yearPicker');
      if (yp && !yp.value) yp.value = new Date().getFullYear();
    },
    reload: function () { this.init(); },
    loadDefaultTemplate: async function () {
      try {
        const r = await fetch('/api/report_template/default');
        const j = await r.json();
        this.defaultTemplate = j?.default_template || null;
      } catch (e) {
        this.defaultTemplate = null;
      }
    },
    switchTab: function (tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabContent').forEach(c => c.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick').includes(tabId)) b.classList.add('active');
      });
      document.getElementById(tabId)?.classList.remove('hidden');
      if (tabId === 'tabDevices') this.loadDevicesTable();
      if (tabId === 'tabConvertors') this.loadConvertorTable();
      if (tabId === 'tabTotal') this.loadTotalTable();
    },
    loadPrice: async function () {
      try {
        const r = await fetch('/api/billing/get_price');
        const j = await r.json();
        document.getElementById('priceInput').value = j?.price_per_unit ?? j?.price ?? 0;
      } catch (e) {
        document.getElementById('priceInput').value = 0;
      }
    },
    savePrice: async function () {
      const v = parseFloat(document.getElementById('priceInput').value);
      if (isNaN(v)) { alert('กรุณาใส่ราคาให้ถูกต้อง'); return; }
      try {
        const r = await fetch('/api/billing/set_price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: v }) });
        const j = await r.json();
        if (j.status === 'success') { alert('บันทึกราคาเรียบร้อย'); this.loadSummary(); this.loadDevicesTable(); }
      } catch (e) { alert('เซิร์ฟเวอร์ขัดข้อง'); }
    },
    loadSummary: async function () {
      try {
        const r = await fetch('/api/billing/summary');
        const j = await r.json();
        const d = j.data ?? j;
        document.getElementById('sumTodayUnit').innerText = Number(d.today_units || 0).toFixed(3);
        document.getElementById('sumTodayMoney').innerText = new Intl.NumberFormat('th-TH').format(Number(d.today_money || 0).toFixed(2));
        document.getElementById('sumMonthUnit').innerText = Number(d.month_units || 0).toFixed(3);
        document.getElementById('sumMonthMoney').innerText = new Intl.NumberFormat('th-TH').format(Number(d.month_money || 0).toFixed(2));
      } catch (e) {}
    },
    loadDevicesTable: async function () {
      const tbody = document.getElementById('tbDevicesBody');
      try {
        const r = await fetch('/api/billing/device_usage');
        const j = await r.json();
        const data = j.data || {};
        const keys = Object.keys(data);
        document.getElementById('deviceCount').innerText = keys.length;
        if (keys.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล กำลังซิงก์...</td></tr>';
          try {
            await fetch('/api/billing/sync', { method: 'POST' });
            await new Promise(r => setTimeout(r, 800));
            const r2 = await fetch('/api/billing/device_usage');
            const j2 = await r2.json();
            const d2 = j2.data || {};
            const k2 = Object.keys(d2);
            document.getElementById('deviceCount').innerText = k2.length;
            if (k2.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล</td></tr>'; return; }
            tbody.innerHTML = k2.map(dev => {
              const d = d2[dev];
              const prev = Number(d.meter_now || 0) - Number(d.total_used_today || 0);
              return `
                <tr>
                  <td><strong>${d.device_name || dev}</strong></td>
                  <td class="font-mono">${prev.toFixed(3)}</td>
                  <td class="font-mono">${Number(d.meter_now || 0).toFixed(3)}</td>
                  <td class="font-mono text-primary">${Number(d.total_used_today || 0).toFixed(3)}</td>
                  <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(d.money_today || 0).toFixed(2))} ฿</td>
                  <td class="text-muted">${d.last_update || '-'}</td>
                  <td><button class="btn btn-sm" onclick="window.BillingApp.generateBill('${dev}')">📄</button></td>
                </tr>`;
            }).join('');
            const br = await fetch('/api/billing/all_bills');
            const bj = await br.json();
            window.allDeviceBills = bj.data || [];
            return;
          } catch (e) { return; }
        }
        tbody.innerHTML = keys.map(dev => {
          const d = data[dev];
          const prev = Number(d.meter_now || 0) - Number(d.total_used_today || 0);
          return `
            <tr>
              <td><strong>${d.device_name || dev}</strong></td>
              <td class="font-mono">${prev.toFixed(3)}</td>
              <td class="font-mono">${Number(d.meter_now || 0).toFixed(3)}</td>
              <td class="font-mono text-primary">${Number(d.total_used_today || 0).toFixed(3)}</td>
              <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(d.money_today || 0).toFixed(2))} ฿</td>
              <td class="text-muted">${d.last_update || '-'}</td>
              <td><button class="btn btn-sm" onclick="window.BillingApp.generateBill('${dev}')">📄</button></td>
            </tr>`;
        }).join('');
        const br = await fetch('/api/billing/all_bills');
        const bj = await br.json();
        window.allDeviceBills = bj.data || [];
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">โหลดไม่สำเร็จ</td></tr>';
      }
    },
    loadConvertorTable: async function () {
      const tbody = document.getElementById('tbConvertorsBody');
      try {
        const r = await fetch('/api/billing/convertor_summary');
        const j = await r.json();
        let data = j.data || {};
        let keys = Object.keys(data);
        document.getElementById('convertorCount').innerText = keys.length;
        if (keys.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล กำลังซิงก์...</td></tr>';
          try {
            await fetch('/api/billing/sync', { method: 'POST' });
            await new Promise(r => setTimeout(r, 800));
            const r2 = await fetch('/api/billing/convertor_summary');
            const j2 = await r2.json();
            data = j2.data || {};
            keys = Object.keys(data);
            document.getElementById('convertorCount').innerText = keys.length;
            if (keys.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล</td></tr>'; return; }
          } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">ไม่มีข้อมูล</td></tr>'; return; }
        }
        tbody.innerHTML = keys.map(cid => {
          const v = data[cid];
          return `
            <tr>
              <td><strong>${v.convertor_name || cid}</strong></td>
              <td class="text-muted">${(v.meters || []).length} เครื่อง</td>
              <td class="font-mono text-primary">${Number(v.today_units || 0).toFixed(3)}</td>
              <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(v.today_money || 0).toFixed(2))} ฿</td>
              <td class="font-mono">${Number(v.month_units || 0).toFixed(3)}</td>
              <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(v.month_money || 0).toFixed(2))} ฿</td>
              <td><button class="btn btn-sm" onclick="window.BillingApp.generateConvertorBill('${cid}')">📄</button></td>
            </tr>`;
        }).join('');
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;" class="text-muted">โหลดไม่สำเร็จ</td></tr>';
      }
    },
    generateBill: async function (id) {
      try {
        const r = await fetch(`/api/billing/device_bill/${id}`);
        const j = await r.json();
        if (j.status !== 'ok') { alert('ไม่พบบิลของอุปกรณ์นี้'); return; }
        const ctx = (function build(a){
          const d = a.devices && a.devices[0] ? a.devices[0] : a;
          const ms = Number(d.meter_start || a.meter_start || a.meter_prev || 0);
          const me = Number(d.meter_end || d.meter_now || a.meter_end || a.meter_now || ms);
          const en = Number(d.energy || d.used || d.total_used_today || a.energy || a.used || (me - ms));
          const ppu = Number(d.price_per_unit || a.price_per_unit || (a.price||{}).price_per_unit || 5.0);
          const money = Number(d.total_money || d.money || d.money_today || a.total_money || a.money || (en*ppu));
          const date = d.date || a.date || (a.meta||{}).date || new Date().toISOString().slice(0,10);
          const did = d.device_id || a.device_id || 'UNKNOWN';
          const dname = d.device_name || a.device_name || did;
          return {
            date, device_id: did, device_name: dname, convertor_id: d.convertor_id || a.convertor_id || '',
            meter_prev: ms.toFixed(3), meter_now: me.toFixed(3), meter_start: ms.toFixed(3), meter_end: me.toFixed(3),
            energy: en.toFixed(3), used: en.toFixed(3), total_used_today: en.toFixed(3),
            money: money.toFixed(2), total_money: money.toFixed(2), money_today: money.toFixed(2), total_cost: money.toFixed(2),
            price_per_unit: ppu.toFixed(2), invoice: { id: `INV-${did}-${date}`, date, total: money.toFixed(2) },
            summary_today: { units: en.toFixed(3), money: money.toFixed(2) }, _original: a
          };
        })(j.data);
        const tpl = this.defaultTemplate;
        const res = await fetch('/api/report_template/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: tpl, data: ctx }) });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `bill_${id}.html`; a.click(); URL.revokeObjectURL(url);
      } catch (e) { alert('ออกบิลล้มเหลว'); }
    },
    generateAllBills: async function () {
      try {
        const rs = await fetch('/api/billing/all_bills');
        const js = await rs.json();
        const bills = js.data || [];
        if (!bills.length) { alert('ไม่มีบิลวันนี้'); return; }
        const tplId = this.defaultTemplate;
        let ok = 0;
        for (const b of bills) {
          const ctx = (function build(a){
            const ms = Number(a.meter_start || 0), me = Number(a.meter_end || ms), en = Number(a.energy_used || a.energy || (me-ms));
            const ppu = Number(a.price_per_unit || 5.0); const money = Number(a.total_money || a.money || (en*ppu));
            return { date: a.date, device_id: a.device_id, device_name: a.device_name,
              meter_prev: ms.toFixed(3), meter_now: me.toFixed(3), energy: en.toFixed(3), total_money: money.toFixed(2), price_per_unit: ppu.toFixed(2) };
          })(b);
          const res = await fetch('/api/report_template/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: tplId, data: ctx }) });
          if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bill_${b.device_id}.html`; a.click(); URL.revokeObjectURL(url); ok++; }
          await new Promise(r=>setTimeout(r,200));
        }
        alert(`ออกบิลสำเร็จ ${ok}/${bills.length}`);
      } catch (e) { alert('เกิดข้อผิดพลาด'); }
    },
    generateAllConvertorBills: async function () {
      try {
        const r = await fetch('/api/billing/convertor_summary');
        const j = await r.json();
        const data = j.data || {};
        const keys = Object.keys(data);
        if (!keys.length) { alert('ไม่มีข้อมูลคอนเวอร์เตอร์'); return; }
        const tplId = this.defaultTemplate;
        let ok = 0;
        for (const cid of keys) {
          const v = data[cid];
          const ctx = { convertor_id: cid, convertor_name: v.convertor_name || cid, date: new Date().toISOString().slice(0,10), devices: v.devices || [], today_units: Number(v.today_units||0).toFixed(3), today_money: Number(v.today_money||0).toFixed(2), month_units: Number(v.month_units||0).toFixed(3), month_money: Number(v.month_money||0).toFixed(2) };
          const res = await fetch('/api/report_template/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: tplId, data: ctx }) });
          if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `convertor_${cid}.html`; a.click(); URL.revokeObjectURL(url); ok++; }
          await new Promise(r=>setTimeout(r,200));
        }
        alert(`สำเร็จ ${ok}/${keys.length}`);
      } catch (e) { alert('ออกบิลไม่สำเร็จ'); }
    },
    exportSummary: async function (mode) {
      let query = ''; let filename = '';
      if (mode === 'day') { query = '/api/billing/all_bills'; filename = 'summary_day'; }
      else if (mode === 'month') { const month = prompt('กรุณาใส่เดือน (รูปแบบ: 2025-11)'); if (!month) return; query = `/api/billing/history?month=${month}`; filename = `summary_month_${month}`; }
      else if (mode === 'year') { const year = prompt('กรุณาใส่ปี เช่น 2025'); if (!year) return; query = `/api/billing/history?year=${year}`; filename = `summary_year_${year}`; }
      const r = await fetch(query); const j = await r.json(); const rows = j.data || [];
      if (!rows.length) { alert('ไม่มีข้อมูลในช่วงเวลานี้'); return; }
      const totalEnergy = rows.reduce((s, r) => s + Number(r.energy_used || r.energy || 0), 0);
      const totalCost = rows.reduce((s, r) => s + Number(r.total_cost || r.money || 0), 0);
      const ctx = { date: new Date().toISOString().slice(0,10), total_energy: totalEnergy.toFixed(3), total_cost: totalCost.toFixed(2), items: rows };
      const res = await fetch('/api/report_template/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: this.defaultTemplate, data: ctx }) });
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${filename}.html`; a.click(); URL.revokeObjectURL(url);
    },
    exportMerged: async function (mode) {
      let query = ''; let filename = '';
      if (mode === 'day') { query = '/api/billing/all_bills'; filename = 'merged_day'; }
      else if (mode === 'month') { const month = prompt('กรุณาใส่เดือน เช่น 2025-11'); if (!month) return; query = `/api/billing/history?month=${month}`; filename = `merged_month_${month}`; }
      else if (mode === 'year') { const year = prompt('กรุณาใส่ปี เช่น 2025'); if (!year) return; query = `/api/billing/history?year=${year}`; filename = `merged_year_${year}`; }
      const r = await fetch(query); const j = await r.json(); const items = j.data || [];
      if (!items.length) { alert('ไม่มีข้อมูลในช่วงเวลานี้'); return; }
      const mr = await fetch('/api/report_template/billing_merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: new Date().toISOString().slice(0,10), items: items, template_id: this.defaultTemplate }) });
      const blob = await mr.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${filename}.html`; a.click(); URL.revokeObjectURL(url);
    },
    exportExcelToday: async function () {
      try {
        const r = await fetch('/api/billing/export_excel_today', { method: 'POST' });
        const j = await r.json();
        alert('ส่งออก Excel สำเร็จ');
      } catch (e) { alert('ส่งออก Excel ไม่สำเร็จ'); }
    },
    loadTotalTable: async function () {
      const tbody = document.getElementById('tbTotalBody');
      try {
        const r = await fetch('/api/billing/total_summary');
        const j = await r.json();
        const d = j.data || {};
        tbody.innerHTML = `
          <tr>
            <td><strong>🔹 รวมวันนี้</strong></td>
            <td class="font-mono text-primary">${Number(d.today_units || 0).toFixed(3)} kWh</td>
            <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(d.today_money || 0).toFixed(2))} บาท</td>
          </tr>
          <tr>
            <td><strong>🔸 รวมเดือนนี้</strong></td>
            <td class="font-mono text-primary">${Number(d.month_units || 0).toFixed(3)} kWh</td>
            <td class="font-mono">${new Intl.NumberFormat('th-TH').format(Number(d.month_money || 0).toFixed(2))} บาท</td>
          </tr>`;
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;" class="text-muted">โหลดไม่สำเร็จ</td></tr>';
      }
    },
    openTemplateManager: function () {
      document.getElementById('templateManager').classList.add('active');
    },
    closeTemplateManager: function () {
      document.getElementById('templateManager').classList.remove('active');
    },
    createNewTemplate: async function () {
      const name = prompt('ชื่อเทมเพลต:'); if (!name) return;
      try {
        const r = await fetch('/api/report_template/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: name, name: name, desc: '' }) });
        if (r.ok) { alert('สร้างเทมเพลตสำเร็จ'); }
        else { alert('สร้างเทมเพลตล้มเหลว'); }
      } catch (e) { alert('เกิดข้อผิดพลาด'); }
    },
    initChart: async function () {
      const ctx = document.getElementById('energyChart');
      if (!ctx || typeof Chart === 'undefined') return;
      try {
        const mp = document.getElementById('monthPicker');
        const month = mp?.value || new Date().toISOString().slice(0,7);
        const r = await fetch(`/api/billing/chart/daily?month=${month}`);
        const j = await r.json();
        const rows = j.data || [];
        const labels = rows.map(v => v.day || '-');
        const values = rows.map(v => Number(v.value || 0));
        const costs = rows.map(v => Number(v.cost || 0));
        if (this._chart) this._chart.destroy();
        this._chart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [
          { label: 'พลังงาน (kWh)', data: values, yAxisID: 'y', backgroundColor: 'rgba(99, 209, 255, 0.3)', borderColor: '#63d1ff', borderWidth: 2 },
          { label: 'ค่าใช้จ่าย (บาท)', data: costs, yAxisID: 'y1', backgroundColor: 'rgba(229, 9, 20, 0.25)', borderColor: '#E50914', borderWidth: 2 }
        ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cce8ff' } } }, scales: { y: { beginAtZero: true, ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99, 209, 255, 0.1)' } }, y1: { beginAtZero: true, position: 'right', ticks: { color: '#9bd0e8' }, grid: { drawOnChartArea: false } }, x: { ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99, 209, 255, 0.1)' } } } } });
      } catch (e) {}
    },
    switchChart: async function (mode) {
      const ctx = document.getElementById('energyChart');
      if (!ctx || typeof Chart === 'undefined') return;
      let endpoint = 'daily'; let query = '';
      if (mode === 'month') { endpoint = 'monthly'; const yp = document.getElementById('yearPicker'); const y = yp?.value || new Date().getFullYear(); query = `?year=${y}`; }
      else if (mode === 'year') { endpoint = 'yearly'; const yp = document.getElementById('yearPicker'); const y = yp?.value || new Date().getFullYear(); query = `?year=${y}`; }
      else { const mp = document.getElementById('monthPicker'); const m = mp?.value || new Date().toISOString().slice(0,7); query = `?month=${m}`; }
      try {
        const r = await fetch(`/api/billing/chart/${endpoint}${query}`);
        const j = await r.json();
        const rows = j.data || [];
        const labels = rows.map(v => v.day ?? v.month ?? v.year ?? '-');
        const values = rows.map(v => Number(v.value ?? 0));
        const costs = rows.map(v => Number(v.cost ?? 0));
        if (this._chart) this._chart.destroy();
        this._chart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [
          { label: 'พลังงาน (kWh)', data: values, yAxisID: 'y', backgroundColor: 'rgba(99, 209, 255, 0.3)', borderColor: '#63d1ff', borderWidth: 2 },
          { label: 'ค่าใช้จ่าย (บาท)', data: costs, yAxisID: 'y1', backgroundColor: 'rgba(229, 9, 20, 0.25)', borderColor: '#E50914', borderWidth: 2 }
        ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cce8ff' } } }, scales: { y: { beginAtZero: true, ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99, 209, 255, 0.1)' } }, y1: { beginAtZero: true, position: 'right', ticks: { color: '#9bd0e8' }, grid: { drawOnChartArea: false } }, x: { ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99, 209, 255, 0.1)' } } } } });
        document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        const btns = document.querySelectorAll('.chart-tab');
        if (mode === 'day') btns[0]?.classList.add('active');
        else if (mode === 'month') btns[1]?.classList.add('active');
        else btns[2]?.classList.add('active');
      } catch (e) {}
    }
  };

  function renderBillingAdminPage() {
    const area = document.getElementById('content-area');
    injectBillingStyles();
    area.innerHTML = BILLING_HTML;

    if (!document.querySelector('script[src*="chart.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = () => window.BillingApp.init();
      document.head.appendChild(s);
    } else {
      window.BillingApp.init();
    }

    if (window.highlightNav) window.highlightNav('billing_admin');
  }

  window.renderBillingAdminPage = renderBillingAdminPage;

  const oldShow = window.showPage;
  window.showPage = function (page) {
    if (page === 'billing_admin') {
      renderBillingAdminPage();
      if (window.highlightNav) window.highlightNav('billing_admin');
      return;
    }
    if (oldShow) return oldShow(page);
  };

})();
