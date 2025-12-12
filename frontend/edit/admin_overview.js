window.AdminOverview = {
  _chart: null,
  render: async function () {
    const body = document.getElementById('ovBody');
    if (!body) return;
    try {
      const pr = await fetch('/public/projects');
      const pj = await pr.json();
      const projects = pj.projects || [];
      const pCountEl = document.getElementById('ovProjects');
      const devEl = document.getElementById('ovDevices');
      const alertEl = document.getElementById('ovAlertCount');
      const monthEl = document.getElementById('ovMonth');
      
      let totalAlerts = 0, totalOnline = 0, totalDevices = 0, monthEnergy = 0, monthCost = 0;
      const rows = [];
      
      const tasks = projects.map(async (p) => {
        const pid = p.project_id;
        const [sumRes, alertRes, statusRes] = await Promise.all([
          fetch(`/api/billing/summary?project_id=${encodeURIComponent(pid)}`),
          fetch(`/api/alert/logs?project_id=${encodeURIComponent(pid)}`),
          fetch(`/api/alert/device/status?project_id=${encodeURIComponent(pid)}`)
        ]);
        const sumJs = await sumRes.json().catch(()=>({}));
        const d = sumJs.data || sumJs || {};
        const alerts = await alertRes.json().catch(()=>[]);
        const status = await statusRes.json().catch(()=>({}));
        const devIds = Object.keys(status || {});
        const online = devIds.filter(id => (status[id]||{}).online).length;
        totalOnline += online; totalDevices += devIds.length;
        const mE = Number(d.month_units || 0); const mC = Number(d.month_money || 0);
        monthEnergy += mE; monthCost += mC; totalAlerts += (alerts||[]).length;
        
        const statusClass = online === devIds.length ? 'status-online' : online > 0 ? 'status-partial' : 'status-offline';
        const alertClass = (alerts||[]).length > 0 ? 'has-alerts' : '';
        
        rows.push(`
          <tr class="table-row">
            <td class="cell-project">
              <div class="project-wrapper">
                <div class="project-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <div class="project-content">
                  <div class="project-title">${p.project_name}</div>
                  <div class="project-subtitle">${pid}</div>
                </div>
              </div>
            </td>
            <td class="cell-status">
              <span class="status-pill ${statusClass}">
                <span class="status-indicator"></span>
                ${online}/${devIds.length}
              </span>
            </td>
            <td class="cell-alerts">
              <span class="alert-badge ${alertClass}">
                ${(alerts||[]).length}
              </span>
            </td>
            <td class="cell-numeric">
              <div class="metric-display energy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span class="value">${mE.toFixed(3)}</span>
                <span class="label">kWh</span>
              </div>
            </td>
            <td class="cell-numeric">
              <div class="metric-display cost">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                  <path d="M12 18V6"></path>
                </svg>
                <span class="value">${new Intl.NumberFormat('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(mC)}</span>
                <span class="label">฿</span>
              </div>
            </td>
          </tr>`);
      });
      
      await Promise.all(tasks);
      
      if (pCountEl) pCountEl.textContent = projects.length;
      if (alertEl) alertEl.textContent = totalAlerts;
      if (devEl) devEl.textContent = `${totalOnline}/${totalDevices}`;
      if (monthEl) monthEl.textContent = `${new Intl.NumberFormat('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(monthCost)} ฿`;
      
      // Update stat cards with proper structure
      const pCountCard = document.getElementById('ovProjects')?.closest('.stat-card');
      if (pCountCard) {
        pCountCard.innerHTML = `
          <div class="stat-label">Total Projects</div>
          <div class="stat-value">${projects.length}</div>
        `;
      }
      
      const devCard = document.getElementById('ovDevices')?.closest('.stat-card');
      if (devCard) {
        devCard.innerHTML = `
          <div class="stat-label">Devices Online</div>
          <div class="stat-value">${totalOnline}/${totalDevices}</div>
        `;
      }
      
      const alertCard = document.getElementById('ovAlertCount')?.closest('.stat-card');
      if (alertCard) {
        alertCard.innerHTML = `
          <div class="stat-label">Active Alerts</div>
          <div class="stat-value stat-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            ${totalAlerts}
          </div>
        `;
      }
      
      const monthCard = document.getElementById('ovMonth')?.closest('.stat-card');
      if (monthCard) {
        monthCard.innerHTML = `
          <div class="stat-label">Monthly Cost</div>
          <div class="stat-value">${new Intl.NumberFormat('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(monthCost)} ฿</div>
        `;
      }
      
      body.innerHTML = rows.join('') || '<tr><td colspan="5" class="no-data">ไม่มีโปรเจกต์ในระบบ</td></tr>';
      
      const badge = document.querySelector('.notification-badge');
      if (badge) badge.textContent = totalAlerts > 0 ? String(totalAlerts) : '';
      
      this.renderAlerts(projects);
      this.renderTopProjects(projects);
      this.renderOfflineDevices(projects);
      this.injectStyles();
      this.injectMiniStyles();
    } catch (e) {
      body.innerHTML = '<tr><td colspan="5" class="error-state">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
  },
  renderTopProjects: async function (projects) {
    const wrap = document.getElementById('ovTopProjects'); if (!wrap) return;
    try {
      const items = [];
      await Promise.all((projects||[]).map(async (p) => {
        const r = await fetch(`/api/billing/summary?project_id=${encodeURIComponent(p.project_id)}`);
        const j = await r.json().catch(()=>({})); const d = j.data || j || {};
        items.push({ name: p.project_name, id: p.project_id, cost: Number(d.month_money||0), energy: Number(d.month_units||0) });
      }));
      items.sort((a,b)=>b.cost-a.cost);
      const top = items.slice(0,5);
      wrap.innerHTML = top.map(t => `
        <div class="mini-item">
          <div class="mini-left">
            <div class="mini-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
            <div class="mini-info">
              <div class="mini-name">${t.name}</div>
              <div class="mini-id">${t.id}</div>
            </div>
          </div>
          <div class="mini-right">
            <div class="mini-cost">${new Intl.NumberFormat('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2}).format(t.cost)} ฿</div>
            <div class="mini-energy">${t.energy.toFixed(3)} kWh</div>
          </div>
        </div>`).join('') || '<div class="no-data">No data</div>';
    } catch (e) { wrap.innerHTML = '<div class="error-state">Failed</div>'; }
  },
  renderOfflineDevices: async function (projects) {
    const wrap = document.getElementById('ovOfflineDevices'); if (!wrap) return;
    try {
      const items = [];
      await Promise.all((projects||[]).map(async (p) => {
        const r = await fetch(`/api/alert/device/status?project_id=${encodeURIComponent(p.project_id)}`);
        const st = await r.json().catch(()=>({}));
        Object.keys(st||{}).forEach(id => { const v = st[id]||{}; if (!v.online) items.push({ project: p.project_name, device: v.device_name||id, last: v.last_seen||'-' }); });
      }));
      const top = items.slice(0,8);
      wrap.innerHTML = top.map(t => `
        <div class="mini-item offline">
          <div class="mini-left">
            <div class="mini-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div class="mini-info">
              <div class="mini-name">${t.device}</div>
              <div class="mini-id">${t.project}</div>
            </div>
          </div>
          <div class="mini-right">
            <div class="mini-last">${t.last}</div>
          </div>
        </div>`).join('') || '<div class="no-data">No offline devices</div>';
    } catch (e) { wrap.innerHTML = '<div class="error-state">Failed</div>'; }
  },
  
  renderAlerts: async function (projects) {
    const tbody = document.getElementById('ovAlertsList');
    if (!tbody) return;
    try {
      const items = [];
      const tasks = (projects||[]).map(async (p) => {
        const r = await fetch(`/api/alert/logs?project_id=${encodeURIComponent(p.project_id)}`);
        const logs = await r.json().catch(()=>[]);
        logs.forEach(a => items.push({
          time: a.time,
          project: p.project_name,
          device: a.device_name,
          severity: a.severity,
          message: a.message
        }));
      });
      await Promise.all(tasks);
      items.sort((x,y) => String(y.time||'').localeCompare(String(x.time||'')));
      
      const severityIcon = (sev) => {
        const icons = {
          critical: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
          warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
          info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };
        return icons[sev] || icons.info;
      };
      
      const rows = items.slice(0, 20).map(a => `
        <tr class="alert-row">
          <td class="cell-time">
            <span class="timestamp">${a.time || '-'}</span>
          </td>
          <td class="cell-text">
            <span class="text-primary">${a.project}</span>
          </td>
          <td class="cell-text">
            <span class="text-secondary">${a.device || '-'}</span>
          </td>
          <td class="cell-severity">
            <span class="severity-label ${a.severity || 'info'}">
              ${severityIcon(a.severity)}
              <span>${a.severity || 'info'}</span>
            </span>
          </td>
          <td class="cell-message">
            <span class="message-text">${a.message || '-'}</span>
          </td>
        </tr>`);
      tbody.innerHTML = rows.join('') || '<tr><td colspan="5" class="no-data">ไม่มีการแจ้งเตือน</td></tr>';
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="error-state">เกิดข้อผิดพลาดในการโหลดการแจ้งเตือน</td></tr>';
    }
  },
  
  initChart: function () {
    if (!window.Chart) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = () => this.renderChart();
      document.head.appendChild(s);
    } else {
      this.renderChart();
    }
  },
  
  renderChart: async function () {
    const cvs = document.getElementById('ovChart'); 
    if (!cvs || !window.Chart) return;
    const range = document.getElementById('ovRange')?.value || 'day';
    const mp = document.getElementById('ovMonthPicker')?.value || new Date().toISOString().slice(0,7);
    const yp = document.getElementById('ovYearPicker')?.value || new Date().getFullYear();
    try {
      const pr = await fetch('/public/projects');
      const pj = await pr.json();
      const projects = pj.projects || [];
      let labels = [], energy = [], cost = [];
      
      if (range === 'day') {
        const map = {};
        await Promise.all(projects.map(async (p) => {
          const r = await fetch(`/api/billing/chart/daily?project_id=${encodeURIComponent(p.project_id)}&month=${mp}`);
          const j = await r.json().catch(()=>({data:[]}));
          (j.data||[]).forEach(row => {
            const dlabel = String(row.day);
            if (!map[dlabel]) map[dlabel] = { value: 0, cost: 0 };
            map[dlabel].value += Number(row.value||0);
            map[dlabel].cost += Number(row.cost||0);
          });
        }));
        labels = Object.keys(map).sort((a,b)=>Number(a)-Number(b));
        energy = labels.map(k => map[k].value);
        cost = labels.map(k => map[k].cost);
      } else if (range === 'month') {
        const map = {};
        await Promise.all(projects.map(async (p) => {
          const r = await fetch(`/api/billing/chart/monthly?project_id=${encodeURIComponent(p.project_id)}&year=${yp}`);
          const j = await r.json().catch(()=>({data:[]}));
          (j.data||[]).forEach(row => {
            const m = String(row.month);
            if (!map[m]) map[m] = { value: 0, cost: 0 };
            map[m].value += Number(row.value||0);
            map[m].cost += Number(row.cost||0);
          });
        }));
        labels = Object.keys(map).sort();
        energy = labels.map(k => map[k].value);
        cost = labels.map(k => map[k].cost);
      } else {
        const y = String(yp);
        let totalE = 0, totalC = 0;
        await Promise.all(projects.map(async (p) => {
          const r = await fetch(`/api/billing/chart/yearly?project_id=${encodeURIComponent(p.project_id)}&year=${y}`);
          const j = await r.json().catch(()=>({data:[]}));
          (j.data||[]).forEach(row => { totalE += Number(row.value||0); totalC += Number(row.cost||0); });
        }));
        labels = [y]; energy = [totalE]; cost = [totalC];
      }
      
      const ctx = cvs.getContext('2d');
      if (this._chart) this._chart.destroy();
      this._chart = new Chart(ctx, { 
        type: 'bar', 
        data: { 
          labels, 
          datasets: [
            { 
              label: 'พลังงาน (kWh)', 
              data: energy, 
              yAxisID: 'y', 
              backgroundColor: 'rgba(0, 245, 255, 0.2)', 
              borderColor: 'rgba(0, 245, 255, 0.8)', 
              borderWidth: 2,
              borderRadius: 6,
              hoverBackgroundColor: 'rgba(0, 245, 255, 0.4)'
            },
            { 
              label: 'ค่าใช้จ่าย (บาท)', 
              data: cost, 
              yAxisID: 'y1', 
              backgroundColor: 'rgba(138, 43, 226, 0.2)', 
              borderColor: 'rgba(138, 43, 226, 0.8)', 
              borderWidth: 2,
              borderRadius: 6,
              hoverBackgroundColor: 'rgba(138, 43, 226, 0.4)'
            }
          ] 
        }, 
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          plugins: { 
            legend: { 
              labels: { 
                color: '#e0f4ff',
                font: { size: 13, weight: '500' },
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle'
              } 
            },
            tooltip: {
              backgroundColor: 'rgba(10, 15, 30, 0.95)',
              titleColor: '#e0f4ff',
              bodyColor: '#a0d0ff',
              borderColor: 'rgba(0, 245, 255, 0.3)',
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8
            }
          }, 
          scales: { 
            y: { 
              beginAtZero: true, 
              ticks: { color: '#7eb8e0', font: { size: 11 } }, 
              grid: { color: 'rgba(0, 245, 255, 0.08)' },
              border: { display: false }
            }, 
            y1: { 
              beginAtZero: true, 
              position: 'right', 
              ticks: { color: '#b89fd9', font: { size: 11 } }, 
              grid: { drawOnChartArea: false },
              border: { display: false }
            }, 
            x: { 
              ticks: { color: '#7eb8e0', font: { size: 11 } }, 
              grid: { color: 'rgba(0, 245, 255, 0.08)' },
              border: { display: false }
            } 
          } 
        } 
      });
    } catch (e) { /* ignore */ }
  },
  
  exportAggregates: async function () {
    try {
      const pr = await fetch('/public/projects'); 
      const pj = await pr.json(); 
      const projects = pj.projects||[];
      let ok = 0;
      await Promise.all(projects.map(async (p) => {
        const r = await fetch(`/api/billing/export_excel_aggregates?project_id=${encodeURIComponent(p.project_id)}`, { method: 'POST' });
        if (r.ok) ok++;
      }));
      alert(`ส่งออกข้อมูลสำเร็จ ${ok}/${projects.length} โปรเจกต์`);
    } catch (e) { 
      alert('ส่งออกข้อมูลไม่สำเร็จ'); 
    }
  },
  
  clearAllAlerts: async function () {
    try {
      const pr = await fetch('/public/projects'); 
      const pj = await pr.json(); 
      const projects = pj.projects||[];
      await Promise.all(projects.map(p => fetch(`/api/alert/logs/clear?project_id=${encodeURIComponent(p.project_id)}`, { method: 'POST' })));
      this.render();
      alert('ล้างการแจ้งเตือนทั้งหมดแล้ว');
    } catch (e) { 
      alert('ล้างการแจ้งเตือนไม่สำเร็จ'); 
    }
  },
  
  injectStyles: function () {},
  
  injectMiniStyles: function () {}
};
