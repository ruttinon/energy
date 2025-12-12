(() => {
  if (window.__billingUserLoaded) return; window.__billingUserLoaded = true;

  function injectBillingUserStyles() {
    if (document.getElementById('billing-user-styles')) return;
    const style = document.createElement('style'); style.id = 'billing-user-styles';
    style.textContent = `
      .bu-container { padding: 20px; color: #cce8ff; max-height: calc(100vh - 140px); overflow-y: auto; }
      .bu-header { background: linear-gradient(135deg, #113246 0%, #0f2232 100%); border: 1px solid #2c6b8a; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
      .bu-title { font-size: 22px; color: #63d1ff; font-weight: 600; }
      .bu-actions { display: flex; gap: 8px; }
      .btn { background: #113246; border: 1px solid #2c6b8a; color: #cce8ff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500; }
      .btn:hover { border-color: #63d1ff; color: #63d1ff; box-shadow: 0 0 12px rgba(99, 209, 255, 0.3); }
      .btn-primary { background: #2c6b8a; border-color: #3da9d4; color: #fff; }
      .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
      .stat-card { background: linear-gradient(180deg, rgba(17,50,70,0.8), rgba(15,34,50,0.8)); border: 1px solid #274b61; border-radius: 10px; padding: 12px; text-align: center; }
      .stat-label { color: #9bd0e8; font-size: 12px; margin-bottom: 6px; }
      .stat-value { font-size: 22px; font-weight: bold; color: #63d1ff; }
      .main-card { background: linear-gradient(180deg, rgba(17,50,70,0.7), rgba(15,34,50,0.7)); border: 1px solid #274b61; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .card-title { color: #63d1ff; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
      .chart-controls { display: flex; gap: 8px; align-items: center; }
      .chart-wrap { height: 280px; position: relative; }
      @media (max-width: 900px) { .stats-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  const BILLING_USER_HTML = `
    <section class="bu-container">
      <section class="bu-header">
        <div class="bu-title">💡 Billing (User)</div>
        <div class="bu-actions">
          <button class="btn" onclick="window.BillingUser.reload()">🔄 รีเฟรช</button>
        </div>
      </section>
      <section class="stats-grid">
        <div class="stat-card"><div class="stat-label">พลังงานวันนี้</div><div class="stat-value"><span id="buToday">0.00</span> kWh</div></div>
        <div class="stat-card"><div class="stat-label">พลังงานเดือน</div><div class="stat-value"><span id="buMonth">0.00</span> kWh</div></div>
        <div class="stat-card"><div class="stat-label">ค่าไฟเดือน</div><div class="stat-value"><span id="buCost">0.00</span> บาท</div></div>
      </section>
      <section class="main-card">
        <div class="card-header">
          <div class="card-title"><span>📈</span> กราฟการใช้พลังงาน</div>
          <div class="chart-controls">
            <select id="buRange"><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select>
            <input id="buMonthPicker" type="month" />
            <input id="buYearPicker" type="number" min="2000" max="2100" style="width:80px" />
          </div>
        </div>
        <div class="chart-wrap"><canvas id="buChart"></canvas></div>
      </section>
    </section>
  `;

  window.BillingUser = {
    _chart: null,
    _pid: null,
    init: async function () {
      const mp = document.getElementById('buMonthPicker'); if (mp && !mp.value) mp.value = new Date().toISOString().slice(0,7);
      const yp = document.getElementById('buYearPicker'); if (yp && !yp.value) yp.value = new Date().getFullYear();
      this._pid = await this.getActiveProject();
      await this.loadSummary();
      await this.renderChart();
      document.getElementById('buRange').addEventListener('change', () => this.renderChart());
      document.getElementById('buMonthPicker').addEventListener('change', () => { document.getElementById('buRange').value = 'day'; this.renderChart(); });
      document.getElementById('buYearPicker').addEventListener('change', () => { const r = document.getElementById('buRange'); if (r.value === 'day') r.value = 'month'; this.renderChart(); });
    },
    reload: function () { this.init(); },
    getActiveProject: async function () { try { const r = await fetch('/api/active'); const j = await r.json(); return j.active || null; } catch(e) { return null; } },
    loadSummary: async function () {
      try { const r = await fetch(`/api/billing/summary?project_id=${encodeURIComponent(this._pid)}`); const j = await r.json(); const d = j.data || j || {}; document.getElementById('buToday').innerText = Number(d.today_units||0).toFixed(2); document.getElementById('buMonth').innerText = Number(d.month_units||0).toFixed(2); document.getElementById('buCost').innerText = new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(d.month_money||0)); } catch(e) {}
    },
    renderChart: async function () {
      const cvs = document.getElementById('buChart'); if (!cvs || typeof Chart === 'undefined') return;
      const range = document.getElementById('buRange').value || 'day';
      const mp = document.getElementById('buMonthPicker').value || new Date().toISOString().slice(0,7);
      const yp = document.getElementById('buYearPicker').value || new Date().getFullYear();
      try {
        let url = '';
        if (range === 'day') url = `/api/billing/chart/daily?project_id=${encodeURIComponent(this._pid)}&month=${mp}`;
        else if (range === 'month') url = `/api/billing/chart/monthly?project_id=${encodeURIComponent(this._pid)}&year=${yp}`;
        else url = `/api/billing/chart/yearly?project_id=${encodeURIComponent(this._pid)}&year=${yp}`;
        const r = await fetch(url); const j = await r.json(); const rows = j.data || [];
        const labels = rows.map(v => String(v.day ?? v.month ?? v.year ?? ''));
        const energy = rows.map(v => Number(v.value || 0));
        const cost = rows.map(v => Number(v.cost || 0));
        if (this._chart) this._chart.destroy();
        const ctx = cvs.getContext('2d');
        this._chart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [
          { label: 'พลังงาน (kWh)', data: energy, yAxisID: 'y', backgroundColor: 'rgba(99, 209, 255, 0.3)', borderColor: '#63d1ff', borderWidth: 2 },
          { label: 'ค่าใช้จ่าย (บาท)', data: cost, yAxisID: 'y1', backgroundColor: 'rgba(229, 9, 20, 0.25)', borderColor: '#E50914', borderWidth: 2 }
        ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99,209,255,0.1)' } }, y1: { beginAtZero: true, position: 'right', ticks: { color: '#9bd0e8' }, grid: { drawOnChartArea: false } }, x: { ticks: { color: '#9bd0e8' }, grid: { color: 'rgba(99,209,255,0.1)' } } } } });
      } catch(e) {}
    }
  };

  function renderBillingUserPage() {
    const area = document.getElementById('content-area'); injectBillingUserStyles(); area.innerHTML = BILLING_USER_HTML;
    if (!document.querySelector('script[src*="chart.js"]')) { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = () => window.BillingUser.init(); document.head.appendChild(s); } else { window.BillingUser.init(); }
    if (window.highlightNav) window.highlightNav('billing_user');
  }

  window.renderBillingUserPage = renderBillingUserPage;
  const oldShow = window.showPage;
  window.showPage = function (page) { if (page === 'billing_user') { renderBillingUserPage(); if (window.highlightNav) window.highlightNav('billing_user'); return; } if (oldShow) return oldShow(page); };
})();

