(function () {
  if (window.MON) return;
  const MON = {
    pid: null,
    devices: [],
    latestByDev: {},
    init() {
      const logout = document.getElementById('logout'); if (logout) logout.onclick = () => { location.href = '/frontend/user.html'; };
      const sidebar = document.querySelector('.sidebar'); const toggleBtn = document.getElementById('toggleSidebar');
      const proj = document.getElementById('proj'); const dev = document.getElementById('dev'); const conv = document.getElementById('conv');
      if (proj) proj.onchange = () => { this.loadDevices(); if (window.renderDashboardShell) { window.renderDashboardShell(document.getElementById('dash-content')); } else this.loadDashboard(); };
      if (dev) dev.onchange = () => {
        try {
          localStorage.setItem('selectedDevice', String(dev.value || ''));
          document.dispatchEvent(new CustomEvent('deviceConfirmed', { detail: { device: String(dev.value || '') } }));
        } catch (e) { }

        // ✅ ตรวจสอบ active tab (ตรวจหลายวิธีเพื่อความแน่ใจ)
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const activeTab = activeTabBtn?.dataset?.tab || activeTabBtn?.getAttribute('data-tab');
        const isOverview = activeTab === 'overview';

        console.log("🔄 Device filter changed, activeTab:", activeTab, "isOverview:", isOverview);

        // ✅ ถ้าอยู่ใน Overview tab ให้ dispatch event เท่านั้น (ไม่ reload)
        if (isOverview) {
          document.dispatchEvent(new CustomEvent('filterChanged', { detail: { device: String(dev.value || ''), converter: conv?.value || '' } }));
          return; // ✅ หยุดที่นี่ ไม่ reload หน้า
        }

        // ✅ ถ้าไม่ได้อยู่ใน Overview tab ให้รีเฟรชตามปกติ
        if (window.renderDashboardShell) { window.renderDashboardShell(document.getElementById('dash-content')); }
        else this.loadDashboard();
      };
      if (conv) conv.onchange = () => {
        this.populateDevicesByConverter();

        // ✅ ตรวจสอบ active tab (ตรวจหลายวิธีเพื่อความแน่ใจ)
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const activeTab = activeTabBtn?.dataset?.tab || activeTabBtn?.getAttribute('data-tab');
        const isOverview = activeTab === 'overview';

        console.log("🔄 Converter filter changed, activeTab:", activeTab, "isOverview:", isOverview);

        // ✅ ถ้าอยู่ใน Overview tab ให้ dispatch event เท่านั้น (ไม่ reload)
        if (isOverview) {
          document.dispatchEvent(new CustomEvent('filterChanged', { detail: { device: document.getElementById('dev')?.value || '', converter: String(conv.value || '') } }));
          return; // ✅ หยุดที่นี่ ไม่ reload หน้า
        }

        // ✅ ถ้าไม่ได้อยู่ใน Overview tab ให้รีเฟรชตามปกติ
        this.loadDashboard();
      };
      const navs = {
        '#dashboard': async () => {
          const tabNav = document.getElementById('tabNav'); if (tabNav) tabNav.style.display = '';
          if (!window.renderDashboardShell) {
            await import('/frontend/monitor/dashboard/tabs.js');
          }
          if (window.renderDashboardShell) {
            window.renderDashboardShell(document.getElementById('dash-content'));
          } else {
            this.loadDashboard();
          }
        },
        '#alarms': async () => {
          const tabNav = document.getElementById('tabNav'); if (tabNav) tabNav.style.display = 'none';
          if (!window.renderAlarms) {
            await import('/frontend/monitor/Alarms/alarms.js');
          }
          if (window.renderAlarms) {
            window.renderAlarms(document.getElementById('dash-content'), this);
          }
        },
        '#trends': async () => {
          const tabNav = document.getElementById('tabNav'); if (tabNav) tabNav.style.display = 'none';
          if (!window.renderTrends) {
            await import('/frontend/monitor/trend.js');
          }
          if (window.renderTrends) {
            window.renderTrends(document.getElementById('dash-content'));
          }
        },
        '#consumption': async () => {
          const tabNav = document.getElementById('tabNav'); if (tabNav) tabNav.style.display = 'none';
          if (!window.renderConsumption) {
            await import('/frontend/monitor/Consumption/consumption.js');
          }
          if (window.renderConsumption) {
            window.renderConsumption(document.getElementById('dash-content'), this);
          }
        },
        '#photo': async () => {
          const tabNav = document.getElementById('tabNav'); if (tabNav) tabNav.style.display = 'none';
          if (!window.renderPhotoUser) {
            await import('/frontend/monitor/photoview/photoview_user.js?v=' + Date.now());
          }
          if (window.renderPhotoUser) {
            window.renderPhotoUser(document.getElementById('dash-content'));
          }
        }
      };
      this.navs = navs;
      ['nav-dashboard', 'nav-alarms', 'nav-trends', 'nav-consumption', 'nav-photo'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = (e) => { e.preventDefault(); document.querySelectorAll('.tile').forEach(x => x.classList.remove('active')); el.classList.add('active'); const hash = { 'nav-dashboard': '#dashboard', 'nav-alarms': '#alarms', 'nav-trends': '#trends', 'nav-consumption': '#consumption', 'nav-photo': '#photo' }[id]; location.hash = hash; const fn = navs[hash]; if (fn) fn(); };
      });
      this.loadProjects();
    },
    fmtTs(s) { if (!s) return ''; const d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return s; return d.toLocaleString(); },
    isRecent(s, sec) { if (!s) return false; const d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return false; return ((Date.now() - d.getTime()) / 1000) < sec; },
    async loadProjects() {
      const res = await fetch('/public/projects'); const j = await res.json();
      const urlPid = new URLSearchParams(location.search).get('pid');
      let pid = null; let pname = '';
      if (urlPid) { pid = urlPid; pname = ((j.projects || []).find(p => p.project_id === urlPid) || {}).project_name || urlPid; }
      else if (j.active) { pid = j.active; pname = ((j.projects || []).find(p => p.project_id === pid) || {}).project_name || pid; }
      else if ((j.projects || []).length) { pid = j.projects[0].project_id; pname = j.projects[0].project_name; }
      this.pid = pid;
      const nameEl = document.getElementById('projName'); if (nameEl) nameEl.textContent = pname || pid || '';
      await this.loadDevices();
      const hash = location.hash || '';
      if (this.navs[hash]) {
        await this.navs[hash]();
      } else if (window.renderDashboardShell) {
        window.renderDashboardShell(document.getElementById('dash-content'));
        const tabMap = { '#energy': 'energy', '#power': 'power', '#ui': 'ui', '#quality': 'quality', '#io': 'io', '#overview': 'overview' };
        const tab = tabMap[hash];
        if (tab) {
          const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
          if (btn) btn.click();
        }
      } else {
        await this.loadDashboard();
      }
    },
    async loadDevices() {
      const pid = document.getElementById('proj')?.value || this.pid; if (!pid) return; const res = await fetch(`/public/projects/${encodeURIComponent(pid)}/devices`); const j = await res.json(); this.devices = j.devices || [];
      const convSel = document.getElementById('conv');
      if (convSel) {
        // ✅ ตรวจสอบว่า activeTab เป็น "overview" หรือไม่ (ตรวจหลายวิธี)
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const activeTab = activeTabBtn?.dataset?.tab || activeTabBtn?.getAttribute('data-tab');
        const isOverview = activeTab === 'overview';

        // ✅ ถ้าเป็น Overview tab ให้มี "All" option, ถ้าไม่ใช่ให้ไม่มี
        const currentValue = convSel.value; // เก็บค่าเดิมไว้
        convSel.innerHTML = isOverview ? '<option value="">All</option>' : '';

        const set = new Set();
        this.devices.forEach(d => { if (d.converter) set.add(String(d.converter)); });
        Array.from(set).sort().forEach(cv => {
          const o = document.createElement('option');
          o.value = cv;
          o.textContent = cv;
          convSel.appendChild(o);
        });

        // ✅ ถ้ามีค่าเดิมและยังมีอยู่ใน options ให้ตั้งค่าใหม่
        if (currentValue && Array.from(convSel.options).some(o => o.value === currentValue)) {
          convSel.value = currentValue;
        } else if (!isOverview && convSel.options.length > 0) {
          // ✅ ถ้าไม่ใช่ overview และไม่มีค่าเดิม ให้เลือกตัวแรก
          convSel.value = convSel.options[0].value;
        }
      }
      this.populateDevicesByConverter();
      // ✅ ตั้งค่า device เริ่มต้น หากยังไม่มีใน localStorage
      const devSel = document.getElementById('dev');
      const saved = localStorage.getItem('selectedDevice') || '';
      if (devSel) {
        if (saved && Array.from(devSel.options).some(o => o.value === saved)) {
          devSel.value = saved;
        } else {
          const first = Array.from(devSel.options).find(o => o.value);
          if (first) {
            devSel.value = first.value;
            try { localStorage.setItem('selectedDevice', String(first.value)); document.dispatchEvent(new CustomEvent('deviceConfirmed', { detail: { device: String(first.value) } })); } catch (e) { }
          }
        }
      }
    },
    populateDevicesByConverter() {
      const devSel = document.getElementById('dev'); if (!devSel) return;
      const convSel = document.getElementById('conv');
      const cv = convSel?.value || '';

      // ✅ ตรวจสอบว่า activeTab เป็น "overview" หรือไม่ (ตรวจหลายวิธี)
      const activeTabBtn = document.querySelector('.tab-btn.active');
      const activeTab = activeTabBtn?.dataset?.tab || activeTabBtn?.getAttribute('data-tab');
      const isOverview = activeTab === 'overview';

      // ✅ ถ้าเป็น Overview tab ให้มี "All" option, ถ้าไม่ใช่ให้ไม่มี
      const currentValue = devSel.value; // เก็บค่าเดิมไว้
      devSel.innerHTML = isOverview ? '<option value="">All</option>' : '';

      (cv ? this.devices.filter(d => String(d.converter) === cv) : this.devices).forEach(d => {
        const o = document.createElement('option');
        o.value = String(d.id);
        o.textContent = d.name ? `${d.name} (#${d.id})` : `Device #${d.id}`;
        devSel.appendChild(o);
      });

      // ✅ ถ้ามีค่าเดิมและยังมีอยู่ใน options ให้ตั้งค่าใหม่
      if (currentValue && Array.from(devSel.options).some(o => o.value === currentValue)) {
        devSel.value = currentValue;
      } else {
        const savedDev = localStorage.getItem('selectedDevice') || '';
        if (savedDev && Array.from(devSel.options).some(o => o.value === savedDev)) {
          devSel.value = savedDev;
        } else if (!isOverview && devSel.options.length > 0) {
          devSel.value = devSel.options[0].value;
        }
      }
    },
    async loadDashboard() {
      const pid = document.getElementById('proj')?.value || this.pid; if (!pid) return;
      const res = await fetch(`/public/projects/${encodeURIComponent(pid)}/readings`); const j = await res.json(); const items = j.items || [];
      const latest = {}; items.forEach(r => { const id = String(r.device_id); const t = r.timestamp; if (!latest[id] || ((latest[id] || '') < (t || ''))) latest[id] = t; }); this.latestByDev = latest;
      const devSel = document.getElementById('dev'); const convSel = document.getElementById('conv'); const filterId = devSel?.value || ''; const filterConv = convSel?.value || '';
      const list = this.devices.filter(d => (!filterConv || String(d.converter) === filterConv) && (!filterId || String(d.id) === filterId));
      let online = 0, offline = 0, lastUpdate = '';
      const tbody = document.getElementById('tbl'); if (tbody) tbody.innerHTML = '';
      list.forEach(d => { const ts = latest[String(d.id)] || ''; const ok = this.isRecent(ts, 180); if (ok) online++; else offline++; if (ts && (!lastUpdate || ts > lastUpdate)) lastUpdate = ts; });
      const fmt = this.fmtTs.bind(this);
      if (tbody) { if (window.renderDeviceTable) window.renderDeviceTable(tbody, list, latest, fmt, (s) => this.isRecent(s, 180)); else { list.forEach(d => { const ts = latest[String(d.id)] || ''; const ok = this.isRecent(ts, 180); const tr = document.createElement('tr'); const ip = d.modbus_ip || ''; const port = d.modbus_port || ''; const ipDisp = ip ? `${ip}:${port}` : ''; tr.innerHTML = `<td>${d.converter || ''}</td><td>${d.name || d.id}</td><td>${ipDisp}</td><td>${fmt(ts)}</td><td class="${ok ? 'status-ok' : 'status-fail'}">${ok ? 'ONLINE' : 'OFFLINE'}</td>`; tbody.appendChild(tr); }); } }
      const mOnline = document.getElementById('m-online'); const mOffline = document.getElementById('m-offline'); const mTotal = document.getElementById('m-total'); const mLast = document.getElementById('m-last');
      if (mOnline) mOnline.textContent = String(online);
      if (mOffline) mOffline.textContent = String(offline);
      if (mTotal) mTotal.textContent = String(list.length);
      if (mLast) mLast.textContent = lastUpdate ? fmt(lastUpdate) : '–';
    }
  };
  window.MON = MON;
})();
