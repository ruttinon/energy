
let activeProject = null;
let protocols = [];
let templates = [];
let config = { converters: [] };
let editingConverterIndex = null;

const API_BASE = (window.__CONFIG && window.__CONFIG.apiBase) ? String(window.__CONFIG.apiBase).replace(/\/$/, '') : '';
function api(path) { return (API_BASE ? API_BASE : '') + path; }

async function fetchJSON(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401) {
    window.location.href = '/frontend/login.html';
    throw new Error(`HTTP 401`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function injectAddDeviceStyles() {
  if (document.getElementById('adddev-style')) return;
  const style = document.createElement('style');
  style.id = 'adddev-style';
  style.textContent = `
    .adddev-container {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      height: calc(100vh - 120px);
    }
    
    .adddev-left, .adddev-right {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .panel {
      background: linear-gradient(180deg, rgba(20,30,40,.6), rgba(10,20,30,.6));
      border: 1px solid #26435a;
      border-radius: 16px;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,.3);
      padding: 20px;
      display: flex;
      flex-direction: column;
    }
    
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #26435a;
    }
    
    .panel-title {
      font-size: 18px;
      font-weight: 600;
      color: #63d1ff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .panel-title::before {
      content: '';
      width: 4px;
      height: 18px;
      background: linear-gradient(180deg, #63d1ff, #2c6b8a);
      border-radius: 2px;
    }
    
    .scrollable-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 8px;
    }
    
    .scrollable-content::-webkit-scrollbar {
      width: 8px;
    }
    
    .scrollable-content::-webkit-scrollbar-track {
      background: rgba(17,34,48,.5);
      border-radius: 4px;
    }
    
    .scrollable-content::-webkit-scrollbar-thumb {
      background: #26435a;
      border-radius: 4px;
    }
    
    .scrollable-content::-webkit-scrollbar-thumb:hover {
      background: #355e75;
    }
    
    .headline {
      font-size: 28px;
      color: #63d1ff;
      margin: 0 0 12px;
      text-align: center;
    }
    
    .primary-btn {
      border: 1px solid #2c6b8a;
      background: #113246;
      color: #cce8ff;
      border-radius: 12px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .primary-btn:hover {
      border-color: #63d1ff;
      color: #63d1ff;
      background: #1a4a66;
      transform: translateY(-1px);
    }
    
    .card {
      border: 1px solid #274b61;
      border-radius: 14px;
      padding: 14px;
      margin: 8px 0;
      background: radial-gradient(1200px 400px at 20% -10%, rgba(99,209,255,.08), transparent),
                  linear-gradient(180deg, rgba(17,34,48,.7), rgba(12,24,36,.7));
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .card:hover {
      border-color: #355e75;
      transform: translateX(4px);
      box-shadow: -4px 0 0 #63d1ff;
    }
    
    .card.active {
      border-color: #63d1ff;
      background: radial-gradient(1200px 400px at 20% -10%, rgba(99,209,255,.15), transparent),
                  linear-gradient(180deg, rgba(17,34,48,.9), rgba(12,24,36,.9));
      box-shadow: -4px 0 0 #63d1ff;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .card-title {
      flex: 1;
      color: #e0f4ff;
      font-weight: 600;
      font-size: 15px;
    }
    
    .chip {
      display: inline-block;
      padding: 4px 10px;
      border: 1px solid #355e75;
      border-radius: 999px;
      color: #9bd0e8;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .btn-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #355e75;
      background: #0f2232;
      color: #cce8ff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s;
    }
    
    .btn-icon:hover {
      border-color: #63d1ff;
      color: #63d1ff;
      background: #1a3a52;
    }
    
    .actions {
      position: relative;
    }
    
    .actions-menu {
      position: absolute;
      right: 0;
      top: 40px;
      background: #0b1f2f;
      border: 1px solid #355e75;
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(0,0,0,.4);
      padding: 6px;
      display: none;
      min-width: 160px;
      z-index: 10;
    }
    
    .actions-menu .menu-item {
      display: block;
      padding: 8px 10px;
      border-radius: 8px;
      color: #cce8ff;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    .actions-menu .menu-item:hover {
      background: #123047;
      color: #63d1ff;
    }
    
    .device-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      border: 1px dashed #274b61;
      border-radius: 10px;
      margin: 6px 0;
      background: rgba(17,34,48,.3);
      transition: all 0.2s;
    }
    
    .device-row:hover {
      border-color: #355e75;
      background: rgba(17,34,48,.5);
      border-style: solid;
    }
    
    .device-name {
      color: #d5ecff;
      font-size: 14px;
    }
    
    .tiny {
      font-size: 11px;
      color: #9bd0e8;
      margin-top: 4px;
    }
    
    .template-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border: 1px solid #274b61;
      border-radius: 12px;
      margin: 8px 0;
      background: linear-gradient(180deg, rgba(17,34,48,.7), rgba(12,24,36,.7));
      transition: all 0.2s;
    }
    
    .template-item:hover {
      border-color: #355e75;
      transform: translateX(2px);
    }
    
    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .search-box input,
    .search-box select {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #355e75;
      background: #0f2232;
      color: #cce8ff;
      font-size: 14px;
    }
    
    .search-box input {
      flex: 1;
    }
    
    .search-box select {
      min-width: 160px;
    }
    
    .search-box input:focus,
    .search-box select:focus {
      outline: none;
      border-color: #63d1ff;
      box-shadow: 0 0 0 3px rgba(99,209,255,.1);
    }
    
    .info-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(99,209,255,.08);
      border: 1px solid #26435a;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    
    .info-bar .label {
      color: #9bd0e8;
      font-size: 12px;
    }
    
    .info-bar .value {
      color: #63d1ff;
      font-weight: 600;
      font-size: 13px;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #9bd0e8;
      font-size: 14px;
    }
    
    .empty-state-icon {
      font-size: 48px;
      opacity: 0.3;
      margin-bottom: 12px;
    }
  `;
  document.head.appendChild(style);
}

function injectMenuButton() {
  const sections = document.querySelectorAll('.sidebar-section');
  let projectSection = null;
  sections.forEach(sec => {
    const t = sec.querySelector('.sidebar-title');
    if (t && t.textContent.trim().toUpperCase() === 'PROJECT') projectSection = sec;
  });
  if (!projectSection) return;
  if (projectSection.querySelector('[data-add-device-btn]')) return;
  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.textContent = '⚙️ Add Device';
  btn.setAttribute('data-add-device-btn', '1');
  btn.onclick = () => window.showPage('add_device');
  projectSection.appendChild(btn);
}

function extendShowPage() {
  if (window.__extendedShowPage) return;
  window.__extendedShowPage = true;
  const original = window.showPage;
  window.showPage = function (page) {
    if (page === 'add_device') {
      renderAddDevicePage();
      setupAddDevice();
      highlightNav('add_device');
      return;
    }
    return original(page);
  };
}

async function setupAddDevice() {
  try {
    const act = await fetchJSON(api('/api/active'));
    activeProject = act.active;
    if (!activeProject) {
      document.getElementById('content-area').innerHTML = '<p>ยังไม่ได้เลือกโปรเจค</p>';
      return;
    }
    const proto = await fetchJSON(api('/api/templates/protocols'));
    protocols = proto.protocols || [];
    const devs = await fetchJSON(api('/api/templates/devices'));
    templates = devs.templates || [];
    const cfg = await getConfig();
    config = cfg;
    if (!config.converters) config.converters = [];
    ensureIdsAndTypes();
    renderManufacturerFilter();
    renderConverters();
    renderTemplates();
    bindFilters();
    ensurePopupElements();
  } catch (e) {
    console.error(e);
  }
}

function renderAddDevicePage() {
  const area = document.getElementById('content-area');
  injectAddDeviceStyles();
  area.innerHTML = `

    <div class="adddev-container">
      <div class="adddev-left">
        <div class="panel" style="height: 100%;">
          <div class="panel-header">
            <div class="panel-title">🔌 Converters</div>
            <button class="primary-btn" id="add-converter">+ Add</button>
          </div>
          <div class="scrollable-content" id="converters"></div>
        </div>
      </div>
      
      <div class="adddev-right">
        <div class="panel" style="height: 100%;">
          <div class="panel-header">
            <div class="panel-title">📟 Device Templates</div>
          </div>
          <div class="search-box">
            <input id="search" type="text" placeholder="ค้นหา...">
            <select id="mfg-filter" class="popup-select"></select>
          </div>
          <div class="info-bar">
            <span class="label">Target converter:</span>
            <span class="value" id="active-conv-name">-</span>
          </div>
          <div class="scrollable-content" id="templates"></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('add-converter').onclick = () => openConverterPopup();
}

function renderProtocolDropdown() {
  const sel = document.getElementById('protocol-select');
  sel.innerHTML = '';
  protocols.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name || p.id}`;
    sel.appendChild(opt);
  });
}

function renderManufacturerFilter() {
  const sel = document.getElementById('mfg-filter');
  sel.innerHTML = '<option value="">ทั้งหมด</option>';
  const mf = Array.from(new Set(templates.map(t => t.manufacturer))).sort();
  mf.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

function renderConverters() {
  const root = document.getElementById('converters');
  if (!root) return;

  if (config.converters.length === 0) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔌</div>
        <div>ยังไม่มี Converter</div>
        <div style="margin-top: 8px; font-size: 12px;">กดปุ่ม "+ Add" เพื่อเพิ่ม</div>
      </div>
    `;
    return;
  }

  root.innerHTML = '';
  config.converters.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (editingConverterIndex === idx) {
      card.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = `${c.name || 'Converter'}`;

    const hostInfo = document.createElement('div');
    hostInfo.className = 'tiny';
    hostInfo.textContent = `${c.settings?.host || ''}:${c.settings?.port || ''}`;

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${(c.protocol || '').toUpperCase() || 'TCP'}`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const more = document.createElement('button');
    more.className = 'btn-icon';
    more.textContent = '⋯';

    const menu = document.createElement('div');
    menu.className = 'actions-menu';

    const mi1 = document.createElement('div');
    mi1.className = 'menu-item';
    mi1.textContent = 'Manage';
    mi1.onclick = (e) => {
      e.stopPropagation();
      openConverterManager(idx);
    };

    const mi2 = document.createElement('div');
    mi2.className = 'menu-item';
    mi2.textContent = 'Test Connection';
    mi2.onclick = (e) => {
      e.stopPropagation();
      testConverterConnection(idx);
    };

    const mi3 = document.createElement('div');
    mi3.className = 'menu-item';
    mi3.textContent = 'Delete';
    mi3.onclick = (e) => {
      e.stopPropagation();
      deleteConverter(idx);
    };

    menu.appendChild(mi1);
    menu.appendChild(mi2);
    menu.appendChild(mi3);

    more.onclick = (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    };

    actions.appendChild(more);
    actions.appendChild(menu);

    header.appendChild(title);
    header.appendChild(chip);
    header.appendChild(actions);

    const titleContainer = document.createElement('div');
    titleContainer.appendChild(hostInfo);

    card.appendChild(header);
    card.appendChild(titleContainer);

    card.onclick = (e) => {
      if (e.target !== more && !menu.contains(e.target)) {
        setActiveConverter(idx);
      }
    };

    const list = document.createElement('div');
    list.style.marginTop = '10px';

    if ((c.devices || []).length > 0) {
      (c.devices || []).forEach(d => {
        const row = document.createElement('div');
        row.className = 'device-row';
        row.onclick = (e) => {
          e.stopPropagation();
          openDevicePopup(idx, d);
        };

        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'device-name';
        name.textContent = `${d.manufacturer}/${d.model} — ${d.name || ''}`;

        const info = document.createElement('div');
        info.className = 'tiny';
        info.textContent = `addr ${d.modbus_slave ?? d.address ?? '-'} • ${d.modbus_ip || c.settings?.host || ''}:${d.modbus_port || c.settings?.port || ''}`;

        left.appendChild(name);
        left.appendChild(info);
        row.appendChild(left);
        list.appendChild(row);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'tiny';
      empty.style.textAlign = 'center';
      empty.style.padding = '12px';
      empty.style.opacity = '0.6';
      empty.textContent = 'ยังไม่มีอุปกรณ์';
      list.appendChild(empty);
    }

    card.appendChild(list);
    root.appendChild(card);
  });
}

function renderTemplates() {
  const root = document.getElementById('templates');
  if (!root) return;

  root.innerHTML = '';
  const q = (document.getElementById('search')?.value || '').toLowerCase();
  const mfg = document.getElementById('mfg-filter')?.value || '';

  const filtered = templates
    .filter(t => (!mfg || t.manufacturer === mfg))
    .filter(t => (t.model.toLowerCase().includes(q) || t.manufacturer.toLowerCase().includes(q)));

  if (filtered.length === 0) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📟</div>
        <div>ไม่พบ Template ที่ตรงกับการค้นหา</div>
      </div>
    `;
    return;
  }

  filtered.forEach(t => {
    const box = document.createElement('div');
    box.className = 'template-item';

    const left = document.createElement('div');
    left.innerHTML = `
      <span style="color:#cce8ff;font-weight:600">${t.manufacturer}</span> / ${t.model}
      <span class="tiny">(${t.registers_count} regs)</span>
    `;

    const btn = document.createElement('button');
    btn.className = 'primary-btn';
    btn.textContent = '+ Add';
    btn.onclick = () => addTemplateToConverter(t);

    box.appendChild(left);
    box.appendChild(btn);
    root.appendChild(box);
  });
}

function bindFilters() {
  const searchInput = document.getElementById('search');
  const mfgFilter = document.getElementById('mfg-filter');

  if (searchInput) {
    searchInput.addEventListener('input', renderTemplates);
  }

  if (mfgFilter) {
    mfgFilter.addEventListener('change', renderTemplates);
  }
}

function openConverterPopup(index = null) {
  editingConverterIndex = index;
  ensurePopupElements();
  const overlay = document.getElementById('conv-popup-overlay');
  overlay.classList.add('active');
  const selProto = document.getElementById('conv-protocol');
  selProto.innerHTML = '';
  let list = protocols && protocols.length ? protocols : [
    { id: 'Generic_ModbusTCP', name: 'Modbus TCP Driver' },
    { id: 'Generic_TCP', name: 'Universal TCP IP Driver' }
  ];
  list.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name || p.id; selProto.appendChild(opt); });
  let protoId = protocols[0]?.id || '';
  if (editingConverterIndex != null) {
    const c = config.converters[editingConverterIndex];
    if (c) {
      const pval = (c.protocol || '').toLowerCase();
      if (pval === 'tcp') protoId = 'Generic_TCP';
      else if (pval === 'modbus_tcp') protoId = 'Generic_ModbusTCP';
      else if (c.driver) { protoId = String(c.driver).replace(/\.json$/, ''); }
    }
  }
  selProto.value = protoId;
  const proto = protocols.find(p => p.id === protoId);
  document.getElementById('conv-popup-title').textContent = proto ? `Converter — ${proto.name}` : 'New Converter';

  const defHost = proto?.network_settings?.default_host || '';
  const defPort = proto?.network_settings?.default_port || '';

  document.getElementById('conv-name').value = '';
  document.getElementById('conv-desc').value = '';
  document.getElementById('conv-host').value = defHost;
  document.getElementById('conv-port').value = defPort;

  if (editingConverterIndex != null) {
    const c = config.converters[editingConverterIndex];
    document.getElementById('conv-name').value = c.name || '';
    document.getElementById('conv-desc').value = c.description || '';
    document.getElementById('conv-host').value = c.settings?.host || defHost;
    document.getElementById('conv-port').value = c.settings?.port || defPort;
  }

  selProto.onchange = () => {
    const pid = selProto.value;
    const p = protocols.find(x => x.id === pid);
    const h = p?.network_settings?.default_host || '';
    const pt = p?.network_settings?.default_port || '';
    document.getElementById('conv-host').value = h;
    document.getElementById('conv-port').value = pt;
    document.getElementById('conv-popup-title').textContent = p ? `Converter — ${p.name}` : 'New Converter';
  };

  overlay.addEventListener('click', function handler(e) {
    if (e.target === overlay) { closeConverterPopup(); overlay.removeEventListener('click', handler); }
  });
}

function resetConverterDefaults() {
  const selProto = document.getElementById('conv-protocol');
  const pid = selProto.value;
  const p = protocols.find(x => x.id === pid);
  const h = p?.network_settings?.default_host || '';
  const pt = p?.network_settings?.default_port || '';
  document.getElementById('conv-host').value = h;
  document.getElementById('conv-port').value = pt;
}

function closeConverterPopup() {
  document.getElementById('conv-popup-overlay').classList.remove('active');
}

async function saveConverter() {
  const sel = document.getElementById('conv-protocol');
  const protoId = sel.value;
  const proto = protocols.find(p => p.id === protoId);
  let protoMode = (protoId === 'Generic_TCP') ? 'tcp' : (protoId === 'Generic_ModbusTCP' ? 'modbus_tcp' : (protoId || '').toLowerCase());
  if (!protoId) {
    const portVal = Number(document.getElementById('conv-port').value || 0);
    const nameVal = String(document.getElementById('conv-name').value || '').toLowerCase();
    if (nameVal.includes('tcp') && !nameVal.includes('modbus')) { protoMode = 'tcp'; }
    else if (portVal === 502) { protoMode = 'modbus_tcp'; }
    else { protoMode = 'tcp'; }
  }
  const c = {
    id: editingConverterIndex != null ? (config.converters[editingConverterIndex].id || generateId()) : generateId(),
    type: 'converter',
    protocol: protoMode,
    name: document.getElementById('conv-name').value || proto?.name || protoId,
    description: document.getElementById('conv-desc').value || '',
    settings: {
      host: document.getElementById('conv-host').value || proto?.network_settings?.default_host || '',
      port: Number(document.getElementById('conv-port').value || proto?.network_settings?.default_port || 0)
    },
    driver: `${protoId || (protoMode === 'tcp' ? 'Generic_TCP' : 'Generic_ModbusTCP')}.json`
  };

  if (editingConverterIndex != null) {
    const prev = config.converters[editingConverterIndex] || {};
    const merged = { ...prev, ...c, devices: (prev.devices || []) };
    (merged.devices || []).forEach(d => {
      d.modbus_ip = merged.settings?.host || d.modbus_ip || '';
      d.modbus_port = merged.settings?.port || d.modbus_port || 502;
    });
    config.converters[editingConverterIndex] = merged;
  } else {
    config.converters.push(c);
  }

  await persistConfig();
  closeConverterPopup();
  renderConverters();
}

async function persistConfig() {
  await fetch(api(`/api/projects/${activeProject}/config`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ converters: config.converters })
  });
}

async function addTemplateToConverter(tpl) {
  if (config.converters.length === 0) {
    alert('โปรดสร้าง converter ก่อน');
    return;
  }
  const idx = editingConverterIndex ?? 0;
  const c = config.converters[idx];
  c.devices = c.devices || [];
  const newDev = {
    id: generateId(),
    type: 'meter',
    manufacturer: tpl.manufacturer,
    model: tpl.model,
    name: `${tpl.model}`,
    template_ref: tpl.path,
    template: `${tpl.manufacturer}/${tpl.model}`,
    driver: tpl.path.split('/').pop() || `${tpl.model}.json`,
    parent: c.id,
    address: 1,
    modbus_slave: 1,
    modbus_ip: c.settings?.host || '',
    modbus_port: c.settings?.port || 502
  };
  c.devices.push(newDev);
  await persistConfig();
  renderConverters();
  openDevicePopup(idx, newDev);
}

function ensurePopupElements() {
  if (document.getElementById('conv-popup-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'conv-popup-overlay';
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup small">
      <h2 id="conv-popup-title">New Converter</h2>
      <div class="row">
        <select id="conv-protocol" class="popup-select"></select>
      </div>
      <div class="row">
        <input id="conv-name" placeholder="Name">
        <input id="conv-desc" placeholder="Description">
      </div>
      <div class="row">
        <input id="conv-host" placeholder="Converter address">
        <input id="conv-port" placeholder="Port">
      </div>
      <div class="popup-buttons">
        <button class="popup-btn" id="conv-reset">Reset defaults</button>
        <button class="popup-btn" id="conv-save">Accept</button>
        <button class="popup-btn cancel" id="conv-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('conv-reset').onclick = resetConverterDefaults;
  document.getElementById('conv-save').onclick = saveConverter;
  document.getElementById('conv-cancel').onclick = closeConverterPopup;
}

function ensureConverterManager() {
  if (document.getElementById('convman-overlay')) return;
  const overlay = document.createElement('div'); overlay.id = 'convman-overlay'; overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup">
      <h2 id="convman-title">Manage Converter</h2>
      <div class="row"><select id="convman-protocol" class="popup-select"></select></div>
      <div class="row"><input id="convman-name" placeholder="Name"><input id="convman-desc" placeholder="Description"></div>
      <div class="row"><input id="convman-host" placeholder="Converter address"><input id="convman-port" placeholder="Port"></div>
      <h3 style="margin-top:10px;color:#90e0ef">Devices</h3>
      <div id="convman-devices" style="max-height:250px;overflow:auto;border:1px solid #234;border-radius:8px;padding:8px"></div>
      <div class="popup-buttons"><button class="popup-btn" id="convman-save">Save</button><button class="popup-btn cancel" id="convman-close">Close</button></div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('convman-close').onclick = () => { document.getElementById('convman-overlay').classList.remove('active'); };
  document.getElementById('convman-save').onclick = () => {
    // reuse saveConverter with values from manager
    const sel = document.getElementById('convman-protocol');
    const protoId = sel.value;
    const name = document.getElementById('convman-name').value;
    const desc = document.getElementById('convman-desc').value;
    const host = document.getElementById('convman-host').value;
    const port = document.getElementById('convman-port').value;
    // set fields in converter popup inputs and call saveConverter
    document.getElementById('conv-protocol').value = protoId;
    document.getElementById('conv-name').value = name;
    document.getElementById('conv-desc').value = desc;
    document.getElementById('conv-host').value = host;
    document.getElementById('conv-port').value = port;
    saveConverter();
    document.getElementById('convman-overlay').classList.remove('active');
  };
}

function openConverterManager(index) {
  editingConverterIndex = index;
  ensurePopupElements();
  ensureConverterManager();
  const overlay = document.getElementById('convman-overlay'); overlay.classList.add('active');
  const c = config.converters[index] || {};
  // protocol options
  const sel = document.getElementById('convman-protocol'); sel.innerHTML = '';
  const list = (protocols && protocols.length ? protocols : [{ id: 'Generic_ModbusTCP', name: 'Modbus TCP Driver' }, { id: 'Generic_TCP', name: 'Universal TCP IP Driver' }]);
  list.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name || p.id; sel.appendChild(opt); });
  let pid = 'Generic_TCP'; const pval = (c.protocol || '').toLowerCase(); if (pval === 'modbus_tcp') pid = 'Generic_ModbusTCP'; else if (c.driver) pid = String(c.driver).replace(/\.json$/, ''); sel.value = pid;
  document.getElementById('convman-title').textContent = 'Manage Converter';
  document.getElementById('convman-name').value = c.name || '';
  document.getElementById('convman-desc').value = c.description || '';
  document.getElementById('convman-host').value = (c.settings || {}).host || '';
  document.getElementById('convman-port').value = String((c.settings || {}).port || '');
  // devices list
  const dv = document.getElementById('convman-devices'); dv.innerHTML = '';
  (c.devices || []).forEach(d => {
    const row = document.createElement('div'); row.className = 'device-row'; row.onclick = () => openDevicePopup(index, d);
    const left = document.createElement('div'); const nm = document.createElement('div'); nm.className = 'device-name'; nm.textContent = `${d.manufacturer}/${d.model} — ${d.name || ''}`;
    const info = document.createElement('div'); info.className = 'tiny'; info.textContent = `addr ${d.modbus_slave ?? d.address ?? '-'} • ${d.modbus_ip || (c.settings || {}).host || ''}:${d.modbus_port || (c.settings || {}).port || ''}`;
    left.appendChild(nm); left.appendChild(info); row.appendChild(left); dv.appendChild(row);
  });
}

function ensureDevicePopupElements() {
  if (document.getElementById('dev-popup-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'dev-popup-overlay';
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup">
      <h2 id="dev-popup-title">Edit Device</h2>
      <div class="row">
        <input id="dev-id" placeholder="Device ID">
        <input id="dev-name" placeholder="ชื่ออุปกรณ์">
      </div>
      <div class="row">
        <select id="dev-template" class="popup-select"></select>
        <input id="dev-desc" placeholder="หมายเหตุ">
      </div>
      <div class="row">
        <input id="dev-ip" placeholder="IP Address">
        <input id="dev-port" placeholder="Port">
      </div>
      <div class="row">
        <input id="dev-slave" placeholder="Slave ID">
        <input id="dev-interval" placeholder="Polling Interval">
      </div>
      <h3 style="margin-top:10px;color:#90e0ef">Registers</h3>
      <div style="max-height:240px; overflow:auto; border:1px solid #234; border-radius:6px; padding:8px">
        <table style="width:100%">
          <thead><tr><th>Key</th><th>Address</th><th>Scale</th><th>Unit</th></tr></thead>
          <tbody id="dev-regs-table"></tbody>
        </table>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn" id="dev-save">Accept</button>
        <button class="popup-btn cancel" id="dev-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('dev-cancel').onclick = closeDevicePopup;
  document.getElementById('dev-save').onclick = saveDevice;
}

function openDevicePopup(convIdx, dev) {
  ensureDevicePopupElements();
  editingConverterIndex = convIdx;
  const overlay = document.getElementById('dev-popup-overlay');
  overlay.classList.add('active');
  document.getElementById('dev-popup-title').textContent = 'เพิ่ม / แก้ไขอุปกรณ์';
  document.getElementById('dev-id').value = String(dev.id || '');
  document.getElementById('dev-name').value = dev.name || '';
  document.getElementById('dev-ip').value = dev.modbus_ip || (config.converters[convIdx].settings?.host || '');
  document.getElementById('dev-port').value = String(dev.modbus_port || (config.converters[convIdx].settings?.port || 502));
  document.getElementById('dev-slave').value = String(dev.modbus_slave ?? dev.address ?? 1);
  document.getElementById('dev-interval').value = String(dev.polling_interval ?? '');
  document.getElementById('dev-desc').value = dev.description || '';
  // template dropdown
  const sel = document.getElementById('dev-template');
  sel.innerHTML = '<option value="">-- เลือก Template --</option>';
  templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.path;
    opt.textContent = `${t.manufacturer} / ${t.model}`;
    sel.appendChild(opt);
  });
  if (dev.template_ref) { sel.value = dev.template_ref; }
  sel.onchange = async () => { await updateRegsPreview(sel.value); };
  updateRegsPreview(sel.value);
  overlay.addEventListener('click', function handler(e) { if (e.target === overlay) { closeDevicePopup(); overlay.removeEventListener('click', handler); } });
  // stash current editing device id
  openDevicePopup._editingDeviceId = dev.id;
}

function closeDevicePopup() {
  document.getElementById('dev-popup-overlay').classList.remove('active');
}

async function updateRegsPreview(path) {
  const tbody = document.getElementById('dev-regs-table');
  tbody.innerHTML = '';
  if (!path) return;
  try {
    const res = await fetch(api(`/api/templates/device_content?path=${encodeURIComponent(path)}`));
    const j = await res.json();
    (j.registers || []).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.key}</td><td>${r.address}</td><td>${r.scale ?? ''}</td><td>${r.unit ?? ''}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) { console.error(e); }
}

async function testDeviceConnection(convIdx, dev) {
  try {
    const c = config.converters[convIdx] || {};
    const ip = dev.modbus_ip || (c.settings || {}).host || '';
    const port = Number(dev.modbus_port || (c.settings || {}).port || 502);
    const unit = Number(dev.modbus_slave ?? dev.address ?? 1);
    {
      const ping = await fetch(api(`/public/diagnostics/tcp_connect?ip=${encodeURIComponent(ip)}&port=${port}&timeout=5`));
      if (ping.status !== 200) { const t = await ping.text(); alert(`TCP connect failed: ${t}`); return; }
    }
    let addr = 0;
    let count = 2;
    let func = 3;
    try {
      const path = dev.template_ref || '';
      if (path) {
        const r = await fetch(api(`/api/templates/device_content?path=${encodeURIComponent(path)}`));
        if (r.status === 200) {
          const j = await r.json();
          const first = (j.registers || [])[0];
          if (first) {
            addr = Number(first.address || addr);
            count = Number(first.words || count);
            func = Number(first.function || func);
          }
        }
      }
    } catch (_) { }
    let res = await fetch(api(`/public/diagnostics/modbus_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${func}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    const alt = (func === 3 ? 4 : 3);
    res = await fetch(api(`/public/diagnostics/modbus_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${alt}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    res = await fetch(api(`/public/diagnostics/modbus_rtu_over_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${func}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK RTU/TCP ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    alert('Failed to read registers');
  } catch (e) { alert('Network error'); }
}

async function testConverterConnection(idx) {
  try {
    const c = config.converters[idx] || {};
    const ip = (c.settings || {}).host || '';
    const port = Number((c.settings || {}).port || 502);
    {
      const ping = await fetch(api(`/public/diagnostics/tcp_connect?ip=${encodeURIComponent(ip)}&port=${port}&timeout=5`));
      if (ping.status !== 200) { const t = await ping.text(); alert(`TCP connect failed: ${t}`); return; }
    }
    const dev = (c.devices || [])[0];
    if (dev) { await testDeviceConnection(idx, dev); return; }
    const unit = 1; let addr = 0; let count = 2; let func = 3;
    let res = await fetch(api(`/public/diagnostics/modbus_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${func}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    const alt = (func === 3 ? 4 : 3);
    res = await fetch(api(`/public/diagnostics/modbus_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${alt}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    res = await fetch(api(`/public/diagnostics/modbus_rtu_over_tcp?ip=${encodeURIComponent(ip)}&port=${port}&unit_id=${unit}&address=${addr}&count=${count}&function=${func}&timeout=5`));
    if (res.status === 200) { const j = await res.json(); alert(`OK RTU/TCP ${ip}:${port} unit ${unit}\n${JSON.stringify(j.registers)}`); return; }
    alert('Failed to read registers');
  } catch (e) { alert('Network error'); }
}

async function saveDevice() {
  const convIdx = editingConverterIndex ?? 0;
  const c = config.converters[convIdx];
  const id = openDevicePopup._editingDeviceId;
  const i = (c.devices || []).findIndex(x => x.id === id);
  if (i < 0) return closeDevicePopup();
  const tplPath = document.getElementById('dev-template').value || '';
  const tplObj = templates.find(t => t.path === tplPath);
  const payload = {
    ...c.devices[i],
    name: document.getElementById('dev-name').value || c.devices[i].name,
    modbus_ip: document.getElementById('dev-ip').value || c.devices[i].modbus_ip,
    modbus_port: Number(document.getElementById('dev-port').value || c.devices[i].modbus_port || 502),
    modbus_slave: Number(document.getElementById('dev-slave').value || c.devices[i].modbus_slave || 1),
    polling_interval: Number(document.getElementById('dev-interval').value || c.devices[i].polling_interval || 3),
    description: document.getElementById('dev-desc').value || c.devices[i].description || '',
    template_ref: tplPath || c.devices[i].template_ref,
    template: tplObj ? `${tplObj.manufacturer}/${tplObj.model}` : (c.devices[i].template || ''),
    driver: tplObj ? (tplObj.path.split('/').pop() || c.devices[i].driver) : c.devices[i].driver
  };
  c.devices[i] = payload;
  await persistConfig();
  closeDevicePopup();
  renderConverters();
}

(function start() {
  try {
    extendShowPage();
    bindNavMenu();
  } catch (e) { console.error(e); }
})();

function bindNavMenu() {
  const items = document.querySelectorAll('.nav-menu .nav-item');
  const map = {
    'add_device': 'add_device',
    'add_report': 'add_report',
    'add_screen': 'add_screen',
    'billing_admin': 'billing_admin',
    'alert_admin': 'alert_admin',
    'information': 'information'
  };
  items.forEach(el => {
    el.style.cursor = 'pointer';
    const key = el.textContent.trim().toLowerCase();
    if (map[key]) {
      el.onclick = () => window.showPage(map[key]);
    }
  });
}

function highlightNav(key) {
  document.querySelectorAll('.nav-menu .nav-item').forEach(el => {
    const t = el.textContent.trim().toLowerCase();
    if (t === key) el.classList.add('active'); else el.classList.remove('active');
  });
}

function generateId() {
  let maxId = 0;
  config.converters.forEach(cv => {
    if (typeof cv.id === 'number') maxId = Math.max(maxId, cv.id);
    (cv.devices || []).forEach(d => { if (typeof d.id === 'number') maxId = Math.max(maxId, d.id); });
  });
  return maxId + 1;
}

function ensureIdsAndTypes() {
  let changed = false;
  config.converters.forEach((cv, i) => {
    if (cv.id == null) cv.id = generateId();
    if (!cv.type) cv.type = 'converter';
    if (typeof cv.protocol === 'string') {
      const p = cv.protocol.toLowerCase();
      if (p.includes('generic_modbustcp')) { cv.protocol = 'modbus_tcp'; changed = true; }
      else if (p.includes('generic_tcp')) { cv.protocol = 'tcp'; changed = true; }
    }
    cv.devices = cv.devices || [];
    cv.devices.forEach(d => {
      if (d.id == null) d.id = generateId();
      if (!d.type) d.type = 'meter';
      if (d.parent == null) d.parent = cv.id;
    });
  });
  if (changed) { persistConfig(); }
}

function setActiveConverter(idx) {
  editingConverterIndex = idx;
  const name = config.converters[idx]?.name || config.converters[idx]?.protocol || '-';
  const label = document.getElementById('active-conv-name');
  if (label) label.textContent = name;
  // Also re-render devices list if needed, but the UI is all in the renderConverters now.
  // wait, setActiveConverter is called when clicking the CARD (not the menu).
  // In the new UI, there is no separate "active converter devices list". The devices are INSIDE the card.
  // The 'target converter' info bar in the right panel needs this update though.
  renderConverters(); // to show active state
}

async function deleteConverter(idx) {
  if (!confirm('Delete this converter?')) return;
  config.converters.splice(idx, 1);
  await persistConfig();
  renderConverters();
}

async function editDevice(convIdx, dev) {
  // Legacy support, but we use openDevicePopup now
  openDevicePopup(convIdx, dev);
}

async function deleteDevice(convIdx, dev) {
  if (!confirm('Delete this device?')) return;
  const c = config.converters[convIdx];
  c.devices = (c.devices || []).filter(x => x.id !== dev.id);
  await persistConfig();
  renderConverters();
}

async function getConfig() {
  try {
    return await fetchJSON(api(`/api/projects/${activeProject}/config`));
  } catch (e) {
    if (String(e.message).includes('HTTP 404')) {
      const d = { version: '1.0', project_id: activeProject, converters: [] };
      await fetch(api(`/api/projects/${activeProject}/config`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ converters: [] })
      });
      return d;
    }
    throw e;
  }
}
