(() => {
  if (window.renderPhotoUser) return;

  function injectStyles() {
    if (document.getElementById('photoview-user-styles')) return;
    const s = document.createElement('style');
    s.id = 'photoview-user-styles';
    s.textContent = `
      .pv-wrapper { display:flex; flex-direction:column; gap:12px; }
      .pv-tabs { display:flex; gap:8px; overflow-x:auto; padding:8px; background: rgba(6,182,212,0.05); border:1px solid rgba(6,182,212,0.2); border-radius:8px; }
      .pv-tab { padding:8px 14px; border:1px solid rgba(6,182,212,0.2); border-radius:8px; cursor:pointer; color:#cbd5e1; white-space:nowrap; }
      .pv-tab.active { border-color:#06b6d4; color:#e0f2fe; background: rgba(6,182,212,0.1); }
      .pv-main { display:flex; flex-direction:column; gap:12px; }
      .pv-toolbar { display:flex; gap:8px; justify-content:space-between; align-items:center; }
      .pv-view { position:relative; border:1px solid rgba(6,182,212,0.2); border-radius:8px; background: rgba(6,182,212,0.03); height:520px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
      .pv-wrap { position:relative; display:inline-block; }
      .pv-img { width:100%; height:auto; display:block; }
      .pv-overlay { position:absolute; inset:0; pointer-events:none; }
      .pv-marker { position:absolute; width:14px; height:14px; border-radius:50%; background:#06b6d4; box-shadow:0 0 10px rgba(6,182,212,.8); transform:translate(-50%,-50%); }
      .pv-label { position:absolute; transform:translate(-50%, -120%); color:#e0f2fe; font-size:12px; background: rgba(15,23,42,.8); padding:2px 6px; border-radius:6px; border:1px solid rgba(6,182,212,.3); }
      .pv-box { position:absolute; transform:translate(-50%,-50%); background: rgba(15,23,42,.85); color:#e0f2fe; border:1px solid rgba(6,182,212,.35); border-radius:8px; padding:8px 10px; min-width:120px; min-height:60px; display:flex; flex-direction:column; gap:6px; justify-content:center; align-items:center; }
      .pv-box-title { font-size:12px; color:#8ecae6; }
      .pv-box-value { font-size:18px; font-weight:700; color:#63d1ff; }
      .pv-canvas { position:absolute; inset:0; }
      .pv-status { font-size:12px; color:#94a3b8; }
    `;
    document.head.appendChild(s);
  }

  async function getActivePid() {
    try { const r = await fetch('/public/projects', { credentials: 'include' }); const j = await r.json(); return j.active || ((j.projects||[])[0]||{}).project_id || ''; } catch(e) { return ''; }
  }

  async function fetchJSON(url) {
    try { const r = await fetch(url, { credentials: 'include' }); if (!r.ok) return null; return await r.json(); } catch(e) { return null; }
  }

  function fmtVal(v, decimals, unit) { const n = Number(v||0); const f = new Intl.NumberFormat('th-TH',{minimumFractionDigits:decimals??2,maximumFractionDigits:decimals??2}).format(n); return unit ? `${f} ${unit}` : f; }
  function normalizeStyle(pageStyle, markerStyle) {
    const ps = pageStyle || {};
    const base = {
      bg: ps.marker_bg ?? ps.bg ?? '#ffffff',
      color: ps.marker_color ?? ps.color ?? '#000000',
      font: ps.font_size ?? ps.font ?? 14,
      radius: ps.border_radius ?? ps.radius ?? 8,
      padding: ps.padding_x ?? ps.padding ?? 6,
      opacity: ps.opacity ?? 100,
      transparent: ps.transparent ?? ps.transparentBg ?? false,
      shadow: ps.shadow ?? false,
      label_color: ps.label_color,
      value_color: ps.value_color,
      icon_size: ps.icon_size ?? 28,
    };
    return { ...base, ...(markerStyle || {}) };
  }
  function drawMarkers(overlay, markers, style, devVals) {
    overlay.innerHTML = '';
    (markers||[]).forEach(m => {
      const x = Number(m.x || m.left || 0);
      const y = Number(m.y || m.top || 0);
      const label = m.label || m.name || m.title || m.text || '';
      const t = (m.type || '').toLowerCase();
      const defaultBox = !!(style && (style.default_marker === 'box' || style.marker_mode === 'box' || style.force_box));
      const vkey = m.value_key || m.key || m.k || m.reading_key || (m.param && m.param.key);
      const isBox = t === 'text' || t === 'box' || m.box === true || m.label_box === true || vkey || m.text || m.title || (defaultBox && (label || m.title));
      const s = normalizeStyle(style, m.style);
      if (isBox) {
        const box = document.createElement('div'); box.className = 'pv-box'; box.style.left = x + '%'; box.style.top = y + '%';
        // apply style
        if (!s.transparent) {
          box.style.background = s.bg;
          box.style.boxShadow = s.shadow ? '0 6px 20px rgba(0,0,0,0.35)' : 'none';
        } else {
          box.style.background = 'transparent';
          // no border by default when transparent; only show if admin specified
          box.style.border = 'none';
        }
        box.style.borderRadius = (s.radius ?? 8) + 'px';
        box.style.padding = (s.padding ?? 6) + 'px';
        box.style.opacity = ((s.opacity ?? 100) / 100).toString();
        if (m.border) { box.style.border = `1px solid ${m.border}`; }
        if (m.width) box.style.width = (String(m.width).endsWith('%')||String(m.width).endsWith('px'))?String(m.width):m.width+'px';
        if (m.height) box.style.height = (String(m.height).endsWith('%')||String(m.height).endsWith('px'))?String(m.height):m.height+'px';
        const title = document.createElement('div'); title.className = 'pv-box-title'; title.textContent = label || (m.title||''); title.style.color = m.label_color || s.label_color || '#8ecae6'; title.style.fontSize = (s.font ? s.font : 14) + 'px'; box.appendChild(title);
        const valEl = document.createElement('div'); valEl.className = 'pv-box-value'; valEl.style.color = m.value_color || s.value_color || s.color || '#63d1ff'; valEl.style.fontSize = (s.font ? s.font : 14) + 'px';
        let val = m.value;
        if (m.device_id && vkey && devVals && devVals[m.device_id]) { const vs = devVals[m.device_id]; val = vs != null ? vs[vkey] : undefined; }
        if (val === undefined || val === null) val = 0;
        const decimals = (m.format === 'int') ? 0 : (m.decimals ?? (s.decimals ?? 2));
        valEl.textContent = fmtVal(val, decimals, m.unit);
        if (s.color && !m.value_color) valEl.style.color = s.color;
        box.appendChild(valEl);
        overlay.appendChild(box);
        return;
      }
      if (!(style && (style.hide_dots || style.no_marker_dots)) && m.dot !== false) {
        if (t === 'icon' || m.icon) {
          const img = document.createElement('img'); img.src = `/api/photoview/${encodeURIComponent(window.renderPhotoUserPid||'')}/images/${encodeURIComponent(m.icon)}`; img.style.position = 'absolute'; img.style.left = x + '%'; img.style.top = y + '%'; img.style.transform = 'translate(-50%,-50%)'; img.style.width = (m.style?.icon_size || s.icon_size || 28) + 'px'; img.style.height = 'auto'; overlay.appendChild(img);
        } else {
          const dot = document.createElement('div'); dot.className = 'pv-marker'; dot.style.left = x + '%'; dot.style.top = y + '%'; dot.style.background = m.color || s.color || '#06b6d4'; const dsz = m.size || (m.style?.size) || s.icon_size || 14; dot.style.width = dsz+'px'; dot.style.height = dsz+'px'; overlay.appendChild(dot);
        }
      }
      if (label) { const lb = document.createElement('div'); lb.className = 'pv-label'; lb.style.left = x + '%'; lb.style.top = y + '%'; lb.textContent = label; if (m.label_color) lb.style.color = m.label_color; if (m.label_bg) lb.style.background = m.label_bg; overlay.appendChild(lb); }
    });
  }

  function drawShapes(canvas, drawings, style) {
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight; canvas.width = w; canvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.lineWidth = (style && style.line_width) || 2; ctx.strokeStyle = (style && style.line_color) || '#63d1ff'; ctx.fillStyle = (style && style.fill_color) || 'rgba(99,209,255,0.12)';
    (drawings||[]).forEach(d => {
      const t = (d.type || '').toLowerCase();
      if (t === 'text') {
        const x = Number(d.x || 0) * w / 100; const y = Number(d.y || 0) * h / 100; ctx.fillStyle = (d.color || (style && style.text_color) || '#e0f2fe'); ctx.font = (d.font || '14px Inter'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(d.text||''), x, y); ctx.fillStyle = (style && style.fill_color) || 'rgba(99,209,255,0.12)'; return;
      }
      const pts = d.points || d.path || [];
      if (!pts.length) return;
      ctx.beginPath();
      pts.forEach((p,i) => { const x = (p.x ?? p[0] ?? 0) * w / 100; const y = (p.y ?? p[1] ?? 0) * h / 100; if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      if (d.closed) { ctx.closePath(); if (d.fill_color) { ctx.fillStyle = d.fill_color; } ctx.fill(); }
      if (d.line_color) ctx.strokeStyle = d.line_color; if (d.line_width) ctx.lineWidth = d.line_width;
      ctx.stroke();
      // reset defaults
     
    });
  }

  window.renderPhotoUser = async function(host) {
    injectStyles();
    if (!host) return;
    host.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Loading Photoview...</div>';
    const pid = await getActivePid(); if (!pid) { host.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No active project</div>'; return; }
    window.renderPhotoUserPid = pid;
    const pagesRes = await fetchJSON(`/api/photoview/${encodeURIComponent(pid)}/pages`);
    const pages = (pagesRes && pagesRes.pages) || [];
    const wrap = document.createElement('div'); wrap.className = 'pv-wrapper';
    const main = document.createElement('div'); main.className = 'pv-main';
    const tabs = document.createElement('div'); tabs.className = 'pv-tabs'; tabs.id = 'pvTabs';
    main.innerHTML = `
      <div class="pv-toolbar">
        <div class="pv-status" id="pvInfo">Select a page</div>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="btn" id="pvRefresh">Refresh</button>
          <button class="btn" id="pvFullscreen">Fullscreen</button>
        </div>
      </div>
      <div class="pv-tabs" id="pvTabsDup"></div>
      <div class="pv-view">
        <div class="pv-wrap" id="pvWrap">
          <img class="pv-img" id="pvImg" alt="map"/>
          <canvas class="pv-canvas" id="pvCanvas"></canvas>
          <div class="pv-overlay" id="pvOverlay"></div>
        </div>
      </div>
    `;
    wrap.appendChild(tabs); wrap.appendChild(main); host.innerHTML=''; host.appendChild(wrap);
    const tabsEl = tabs; const wrapEl = main.querySelector('#pvWrap'); const imgEl = main.querySelector('#pvImg'); const canvasEl = main.querySelector('#pvCanvas'); const overlayEl = main.querySelector('#pvOverlay'); const infoEl = main.querySelector('#pvInfo');
    let current = null;
    function syncLayers() {
      const imgRect = imgEl.getBoundingClientRect();
      wrapEl.style.width = imgRect.width + 'px';
      wrapEl.style.height = imgRect.height + 'px';
      overlayEl.style.width = '100%';
      overlayEl.style.height = '100%';
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      // set canvas internal size for accurate drawing
      const cw = Math.max(1, Math.floor(imgRect.width));
      const ch = Math.max(1, Math.floor(imgRect.height));
      canvasEl.width = cw; canvasEl.height = ch;
    }
    function renderTabs() {
      tabsEl.innerHTML = (pages||[]).map(p => `<div class="pv-tab${current && current.id===p.id ? ' active':''}" data-id="${p.id}">${p.name}</div>`).join('') || '<div class="pv-status">No pages</div>';
      tabsEl.querySelectorAll('.pv-tab').forEach(it => {
        it.addEventListener('click', async () => { current = (pages||[]).find(x=>x.id===it.dataset.id); renderTabs(); await loadPage(); });
      });
    }
    let refreshTimer = null;
    async function loadPage() {
      if (!current) { imgEl.removeAttribute('src'); infoEl.textContent='Select a page'; overlayEl.innerHTML=''; const ctx = canvasEl.getContext('2d'); ctx.clearRect(0,0,canvasEl.width,canvasEl.height); return; }
      infoEl.textContent = `${current.name}`;
      const cfg = await fetchJSON(`/api/photoview/${encodeURIComponent(pid)}/page_config/${encodeURIComponent(current.id)}?t=${Date.now()}`);
      const page = (cfg && cfg.page) || current;
      const markers = (cfg && cfg.markers) || [];
      const drawings = (cfg && cfg.drawings) || [];
      const style = (cfg && cfg.style) || {};
      imgEl.src = `/api/photoview/${encodeURIComponent(pid)}/images/${encodeURIComponent(page.image || current.image)}`;
      await new Promise(resolve => { if (imgEl.complete) resolve(); else imgEl.onload = () => resolve(); });
      syncLayers();
      const devIds = Array.from(new Set((markers||[]).map(m => m.device_id).filter(Boolean)));
      const devVals = {};
      await Promise.all(devIds.map(async id => { const r = await fetchJSON(`/api/photoview/${encodeURIComponent(pid)}/device_data/${encodeURIComponent(id)}`); devVals[id] = (r && r.data) || {}; }));
      drawMarkers(overlayEl, markers || [], style, devVals);
      drawShapes(canvasEl, drawings || [], style);
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      if (devIds.length) {
        refreshTimer = setInterval(async () => {
          const devVals2 = {};
          await Promise.all(devIds.map(async id => { const r = await fetchJSON(`/api/photoview/${encodeURIComponent(pid)}/device_data/${encodeURIComponent(id)}?t=${Date.now()}`); devVals2[id] = (r && r.data) || {}; }));
          drawMarkers(overlayEl, markers || [], style, devVals2);
        }, 2000);
      }
    }
    renderTabs();
    main.querySelector('#pvRefresh').addEventListener('click', async ()=>{ await loadPage(); });
    // fullscreen
    main.querySelector('#pvFullscreen').addEventListener('click', ()=>{
      const el = document.querySelector('.pv-view');
      if (!document.fullscreenElement) { el.requestFullscreen?.(); } else { document.exitFullscreen?.(); }
      setTimeout(syncLayers, 300);
    });
    if (pages.length) { current = pages[0]; await loadPage(); }
    window.addEventListener('resize', ()=>{ syncLayers(); const d = overlayEl.children.length; if (d) { drawShapes(canvasEl, []); } });
  };
})();

