(function () {
  if (window.renderDashboardShell) return;

  function el(id) { return document.getElementById(id); }
  function active(btn) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  // ✅ CSS Modules (ลบ io ออกแล้ว)
  const cssModules = {
    summary: "/frontend/monitor/dashboard/styles/summary-module.css",
    ui: "/frontend/monitor/dashboard/styles/ui-module.css",
    power: "/frontend/monitor/dashboard/styles/power-module.css",
    energy: "/frontend/monitor/dashboard/styles/energy-module.css",
    quality: "/frontend/monitor/dashboard/styles/quality-module.css",
    overview: "/frontend/monitor/dashboard/styles/overview-module.css",
  };

  const loadedCSS = new Set();

  window.loadModuleCSS = function (moduleName) {
    return new Promise((resolve) => {
      const cssPath = cssModules[moduleName];
      if (!cssPath || loadedCSS.has(moduleName)) return resolve();
      const existing = document.getElementById(moduleName + "-css");
      if (existing) existing.remove();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssPath + "?v=" + Date.now();
      link.id = moduleName + "-css";
      link.onload = () => { loadedCSS.add(moduleName); resolve(); };
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  };

  function loadBaseCSS() {
    if (document.getElementById("base-ui-css")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "base-ui-css";
    link.href = "/frontend/user.css";
    document.head.appendChild(link);
  }

  loadBaseCSS();

  function updateFilterDropdowns(isOverview) {
    const convSel = document.getElementById('conv');
    const devSel = document.getElementById('dev');
    
    if (convSel) {
      const allOption = convSel.querySelector('option[value=""]');
      if (isOverview && !allOption) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'All';
        convSel.insertBefore(opt, convSel.firstChild);
      } else if (!isOverview && allOption) {
        allOption.remove();
        if (convSel.value === '') {
          const first = convSel.options[0];
          if (first) convSel.value = first.value;
        }
      }
    }
    
    if (devSel) {
      const allOption = devSel.querySelector('option[value=""]');
      if (isOverview && !allOption) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'All';
        devSel.insertBefore(opt, devSel.firstChild);
      } else if (!isOverview && allOption) {
        allOption.remove();
        if (devSel.value === '') {
          const first = devSel.options[0];
          if (first) devSel.value = first.value;
        }
      }
    }
    
    if (!isOverview && window.MON && window.MON.populateDevicesByConverter) {
      window.MON.populateDevicesByConverter();
    }
  }

  // ============================================================
  // LOAD TAB (ลบ I/O ออกทั้งหมดแล้ว)
  // ============================================================
  async function loadTab(name) {
    const host = el("dash-content");
    if (!host) return;

    console.log(`📄 Loading tab: ${name}`);
    
    const isOverview = name === 'overview';
    updateFilterDropdowns(isOverview);

    if (window.__summaryTimer) {
      clearInterval(window.__summaryTimer);
      window.__summaryTimer = null;
    }
    if (window.stopEnergyModule) {
      window.stopEnergyModule();
    }
    try {
      const overviewMod = await import("/frontend/monitor/dashboard/overview.js").catch(() => null);
      if (overviewMod && overviewMod.stopOverview) {
        overviewMod.stopOverview();
      }
    } catch (e) {}

    host.innerHTML = '<div style="padding:20px;text-align:center;">Loading...</div>';

    await window.loadModuleCSS(name);

    // -------------------- SUMMARY --------------------
    if (name === "summary") {
      console.log("📊 Rendering Summary");
      host.innerHTML = '';
      if (!window.renderSummary) {
        await import("/frontend/monitor/dashboard/summary_view.js?v=" + Date.now());
      }
      setTimeout(() => {
        if (window.renderSummary) {
          window.renderSummary(host);
        }
      }, 50);
      return;
    }

    // -------------------- UI --------------------
    if (name === "ui") {
      console.log("⚡ Rendering UI");
      host.innerHTML = `
        <div class="cards">
          <div class="card" style="flex:2">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <h3 id="ui-title">Voltage & Current Monitoring</h3>
                <div id="ui-subtitle" style="opacity:.7">Select measurement mode and type</div>
              </div>
              <div id="status-badge" class="pill"><span class="status-text">Idle</span></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin:12px 0">
              <button class="control-btn mode btn" data-mode="Inst">Inst</button>
              <button class="control-btn mode btn" data-mode="Avg">Avg</button>
              <div style="width:20px"></div>
              <button class="control-btn type btn" data-type="I">I</button>
              <button class="control-btn type btn" data-type="V">V</button>
              <button class="control-btn type btn" data-type="U">U</button>
              <div style="width:20px"></div>
              <button class="btn" onclick="refreshUI()">Refresh</button>
            </div>
            <div class="card" style="height:360px"><div id="bar-container"></div></div>
            <div id="table-card" class="card" style="margin-top:12px">
              <table id="info-table" style="width:100%"></table>
            </div>
          </div>
        </div>
      `;
      const mod = await import("/frontend/monitor/dashboard/ui.js?v=" + Date.now());
      if (mod.initUI) mod.initUI();
      return;
    }

    // -------------------- POWER --------------------
    if (name === "power") {
      console.log("🔌 Rendering Power");
      host.innerHTML = `
      <div class="power-wrapper">
        <div class="power-sidebar">
          <div class="sidebar-group">
            <button class="pbtn mode" data-mode="Inst">INST</button>
            <button class="pbtn mode" data-mode="Avg">AVG</button>
          </div>
          <div class="sidebar-divider"></div>
          <div class="sidebar-group">
            <button class="pbtn type" data-type="P">P</button>
            <button class="pbtn type" data-type="Q">Q</button>
            <button class="pbtn type" data-type="S">S</button>
          </div>
          <div class="sidebar-group">
            <button class="pbtn type" data-type="PF">PF</button>
            <button class="pbtn type" data-type="cosφ">COS(Φ)</button>
            <button class="pbtn type" data-type="tanφ">TAN(Φ)</button>
          </div>
        </div>
        <div class="power-main">
          <div class="power-header"><div id="power-status-text">⚡ SELECT MODE FIRST</div></div>
          <div class="gauges-container">
            <div class="gauge-column">
              <div class="gauge-label-top">L1</div>
              <div class="gauge-track">
                <div class="gauge-fill" id="fill-L1"></div>
                <div class="gauge-cursor" id="cursor-L1"></div>
              </div>
              <div class="gauge-value-box" id="val-L1">--</div>
            </div>
            <div class="gauge-column">
              <div class="gauge-label-top">L2</div>
              <div class="gauge-track">
                <div class="gauge-fill" id="fill-L2"></div>
                <div class="gauge-cursor" id="cursor-L2"></div>
              </div>
              <div class="gauge-value-box" id="val-L2">--</div>
            </div>
            <div class="gauge-column">
              <div class="gauge-label-top">L3</div>
              <div class="gauge-track">
                <div class="gauge-fill" id="fill-L3"></div>
                <div class="gauge-cursor" id="cursor-L3"></div>
              </div>
              <div class="gauge-value-box" id="val-L3">--</div>
            </div>
            <div class="gauge-column">
              <div class="gauge-label-top">TOTAL</div>
              <div class="gauge-track">
                <div class="gauge-fill" id="fill-Total"></div>
                <div class="gauge-cursor" id="cursor-Total"></div>
              </div>
              <div class="gauge-value-box" id="val-Total">--</div>
            </div>
          </div>
        </div>
      </div>
    `;
      await import("/frontend/monitor/dashboard/power.js?v=" + Date.now());
      return;
    }

    // -------------------- ENERGY --------------------
    if (name === "energy") {
      console.log("🔋 Rendering Energy");
      host.innerHTML = `
        <div class="energy-wrapper" style="padding:10px;">
          <div class="card">
            <div class="energy-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
              <div class="energy-tabs" style="display:flex; gap:8px;">
                <button class="ebtn tab active" data-tab="general">📊 General Energy</button>
                <button class="ebtn tab" data-tab="tariff">💰 Tariff Energy</button>
              </div>
              <button class="btn" onclick="if(window.resetEnergyPartial) window.resetEnergyPartial()">Refresh</button>
            </div>

            <div id="energy-general-section" class="energy-section active">
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <h4 style="margin:0;">Total Energy</h4>
                    <span id="general-duration" style="font-family:monospace; color:#8ecae6;">--</span>
                  </div>
                  <table style="width:100%; border-collapse: collapse;">
                    <thead style="background:rgba(255,255,255,0.05);">
                      <tr>
                        <th style="padding:8px; text-align:left;">Parameter</th>
                        <th style="padding:8px;">Import (kWh)</th>
                        <th style="padding:8px;">Export (Wh)</th>
                        <th style="padding:8px;">Q+ (kvarh)</th>
                        <th style="padding:8px;">Q- (kvarh)</th>
                        <th style="padding:8px;">S (kVAh)</th>
                      </tr>
                    </thead>
                    <tbody id="energy-total-body">
                      <tr>
                        <td style="padding:8px;">Total</td>
                        <td id="energy-ea-plus" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-ea-minus" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-er-plus" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-er-minus" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-es" style="padding:8px; text-align:center;">0.000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <h4 style="margin:0;">Partial Energy</h4>
                    <span id="partial-duration" style="font-family:monospace; color:#8ecae6;">--</span>
                  </div>
                  <table style="width:100%; border-collapse: collapse;">
                    <thead style="background:rgba(255,255,255,0.05);">
                      <tr>
                        <th style="padding:8px; text-align:left;">Parameter</th>
                        <th style="padding:8px;">Import (kWh)</th>
                        <th style="padding:8px;">Export (Wh)</th>
                        <th style="padding:8px;">Q+ (kvarh)</th>
                        <th style="padding:8px;">Q- (kvarh)</th>
                        <th style="padding:8px;">S (kVAh)</th>
                      </tr>
                    </thead>
                    <tbody id="energy-partial-body">
                      <tr>
                        <td style="padding:8px;">Partial</td>
                        <td id="energy-ea-plus-partial" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-ea-minus-partial" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-er-plus-partial" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-er-minus-partial" style="padding:8px; text-align:center;">0.000</td>
                        <td id="energy-es-partial" style="padding:8px; text-align:center;">0.000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div id="energy-tariff-section" class="energy-section">
              <div>
                <h4 style="margin-bottom:10px;">Tariff Total</h4>
                <table style="width:100%; border-collapse: collapse;">
                  <thead style="background:rgba(255,255,255,0.05);">
                    <tr>
                      <th style="padding:8px;">#</th>
                      <th style="padding:8px; text-align:left;">Name</th>
                      <th style="padding:8px;">Imp (kWh)</th>
                      <th style="padding:8px;">Exp (Wh)</th>
                      <th style="padding:8px;">Lag (kvarh)</th>
                      <th style="padding:8px;">Lead (kvarh)</th>
                      <th style="padding:8px;">Total (kvarh)</th>
                      <th style="padding:8px;">Q- (kvarh)</th>
                      <th style="padding:8px;">S (kVAh)</th>
                    </tr>
                  </thead>
                  <tbody id="energy-tariff-total-body"></tbody>
                </table>
              </div>

              <div style="margin-top:20px;">
                <h4 style="margin-bottom:10px;">Tariff Partial</h4>
                <table style="width:100%; border-collapse: collapse;">
                  <thead style="background:rgba(255,255,255,0.05);">
                    <tr>
                      <th style="padding:8px;">#</th>
                      <th style="padding:8px; text-align:left;">Name</th>
                      <th style="padding:8px;">Imp (kWh)</th>
                      <th style="padding:8px;">Exp (Wh)</th>
                      <th style="padding:8px;">Lag (kvarh)</th>
                      <th style="padding:8px;">Lead (kvarh)</th>
                      <th style="padding:8px;">Total (kvarh)</th>
                      <th style="padding:8px;">Q- (kvarh)</th>
                      <th style="padding:8px;">S (kVAh)</th>
                    </tr>
                  </thead>
                  <tbody id="energy-tariff-partial-body"></tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        <style>
          .ebtn.tab {
            padding: 10px 20px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #8ecae6;
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.3s;
            font-weight: 600;
          }
          .ebtn.tab:hover {
            background: rgba(6,182,212,0.2);
            border-color: #06b6d4;
          }
          .ebtn.tab.active {
            background: linear-gradient(135deg, #0e7490, #0891b2);
            color: white;
            border-color: #06b6d4;
          }
          .energy-section {
            display: none;
          }
          .energy-section.active {
            display: block;
          }
        </style>
      `;

      const mapID = { general: 'energy-general-section', tariff: 'energy-tariff-section' };
      document.querySelectorAll(".ebtn.tab").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".ebtn.tab").forEach(b => b.classList.remove("active"));
          document.querySelectorAll(".energy-section").forEach(s => s.classList.remove("active"));
          
          btn.classList.add("active");
          const tab = btn.dataset.tab;
          const section = document.getElementById(mapID[tab]);
          if (section) section.classList.add("active");
        });
      });

      const mod = await import("/frontend/monitor/dashboard/energy.js?v=" + Date.now());
      if (mod.initEnergy) mod.initEnergy();
      return;
    }

    // -------------------- QUALITY --------------------
    if (name === "quality") {
      console.log("📈 Rendering Quality");
      
      if (!window.Chart) {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/chart.js";
        document.body.appendChild(s);
        await new Promise((r) => (s.onload = r));
      }

      host.innerHTML = `<div class="premium-quality quality-wrapper">
        <div class="animated-bg"></div>
        <div class="quality-content-wrapper">
          <div class="quality-header">
            <div class="header-left">
              <div class="header-icon">📊</div>
              <div class="header-text">
                <h2>Power Quality Intelligence</h2>
                <p class="desc">Advanced harmonic distortion & waveform analysis</p>
              </div>
            </div>
          </div>
          <div class="quality-layout">
            <aside class="quality-menu">
              <button class="qbtn tab active" data-tab="thdi"><span class="tab-icon">⚡</span><span class="tab-label">THDi</span></button>
              <button class="qbtn tab" data-tab="thdu"><span class="tab-icon">🔌</span><span class="tab-label">THDu</span></button>
              <button class="qbtn tab" data-tab="thdv"><span class="tab-icon">📊</span><span class="tab-label">THDv</span></button>
              <button class="qbtn tab" data-tab="tdd"><span class="tab-icon">📈</span><span class="tab-label">TDD</span></button>
              <button class="qbtn tab" data-tab="kfactor"><span class="tab-icon">🔧</span><span class="tab-label">K-Factor</span></button>
              <button class="qbtn tab" data-tab="crest"><span class="tab-icon">📍</span><span class="tab-label">Crest Factor</span></button>
            </aside>
            <div class="quality-main">
              <div id="thdi-section" class="quality-section active">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">⚡</div>
                      <div><h3>THDi – Total Harmonic Distortion (Current)</h3><p class="section-desc">Harmonic distortion measurement in current waveforms</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>THD (%)</th><th>Status</th></tr></thead>
                    <tbody id="thdi-table-body">
                      <tr><td class="phase-label">L1</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L2</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L3</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="thdi-chart"></canvas></div>
                </div>
              </div>
              <div id="thdu-section" class="quality-section">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">🔌</div>
                      <div><h3>THDu – Total Harmonic Distortion (Phase Voltage)</h3><p class="section-desc">Phase-to-phase voltage harmonic analysis</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>THD (%)</th><th>Status</th></tr></thead>
                    <tbody id="thdu-table-body">
                      <tr><td class="phase-label">U12</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">U23</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">U31</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="thdu-chart"></canvas></div>
                </div>
              </div>
              <div id="thdv-section" class="quality-section">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">📊</div>
                      <div><h3>THDv – Total Harmonic Distortion (Line Voltage)</h3><p class="section-desc">Line-to-neutral voltage distortion metrics</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>THD (%)</th><th>Status</th></tr></thead>
                    <tbody id="thdv-table-body">
                      <tr><td class="phase-label">V1</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">V2</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">V3</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="thdv-chart"></canvas></div>
                </div>
              </div>
              <div id="tdd-section" class="quality-section">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">📈</div>
                      <div><h3>TDD – Total Demand Distortion</h3><p class="section-desc">Distortion relative to maximum demand current</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>TDD (%)</th><th>Status</th></tr></thead>
                    <tbody id="tdd-table-body">
                      <tr><td class="phase-label">L1</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L2</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L3</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="tdd-chart"></canvas></div>
                </div>
              </div>
              <div id="kfactor-section" class="quality-section">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">🔧</div>
                      <div><h3>K-Factor – Transformer Harmonic Stress</h3><p class="section-desc">Transformer derating factor analysis</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>K-Factor</th><th>Status</th></tr></thead>
                    <tbody id="kfactor-table-body">
                      <tr><td class="phase-label">L1</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L2</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">L3</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="kfactor-chart"></canvas></div>
                </div>
              </div>
              <div id="crest-section" class="quality-section">
                <div class="data-card">
                  <div class="card-header">
                    <div class="section-title">
                      <div class="title-icon">📍</div>
                      <div><h3>Crest Factor – Peak-to-RMS Ratio</h3><p class="section-desc">Waveform quality indicator metrics</p></div>
                    </div>
                  </div>
                  <table class="premium-table">
                    <thead><tr><th>Phase</th><th>Crest Factor</th><th>Status</th></tr></thead>
                    <tbody id="crest-table-body">
                      <tr><td class="phase-label">V1</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">V2</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                      <tr><td class="phase-label">V3</td><td class="value-cell">-</td><td class="badge-cell"><span class="badge badge-loading">Loading...</span></td></tr>
                    </tbody>
                  </table>
                  <div class="chart-box"><canvas id="crest-chart"></canvas></div
            <table class="premium-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Crest Factor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="crest-table-body">
                <tr>
                  <td class="phase-label">V1</td>
                  <td class="value-cell">-</td>
                  <td class="badge-cell"><span class="badge badge-loading">Loading...</span></td>
                </tr>
                <tr>
                  <td class="phase-label">V2</td>
                  <td class="value-cell">-</td>
                  <td class="badge-cell"><span class="badge badge-loading">Loading...</span></td>
                </tr>
                <tr>
                  <td class="phase-label">V3</td>
                  <td class="value-cell">-</td>
                  <td class="badge-cell"><span class="badge badge-loading">Loading...</span></td>
                </tr>
              </tbody>
            </table>

            <div class="chart-box">
              <canvas id="crest-chart"></canvas>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
  `;

  const mod = await import("/frontend/monitor/dashboard/quality.js?v=" + Date.now());
  if (mod.initQuality) mod.initQuality();
  return;
}

    // -------------------- OVERVIEW --------------------
    if (name === "overview") {
      console.log("📊 Rendering Overview");
      
      host.innerHTML = `
        <section class="premium-overview panel-inner">
          <!-- Animated Background -->
          <div class="animated-bg"></div>
          
          <div class="overview-content">
            <!-- Header Card -->
            <div class="overview-header">
              <div class="header-left">
                <div class="robot-icon">🤖</div>
                <div class="header-text">
                  <h2>Realtime Overview</h2>
                  <p class="header-desc">AI-powered system monitoring & analytics</p>
                </div>
              </div>
            </div>

            <!-- Control Panel -->
            <div class="control-card">
              <div class="control-group">
                <label class="control-label">🔍 Search Parameters</label>
                <input
                  id="searchBox"
                  type="text"
                  placeholder="Search: Voltage, Current, Power..."
                  class="search-input"
                />
              </div>

              <div class="control-group">
                <label class="control-label">📁 Filter Category</label>
                <select id="filterCategory" class="filter-select">
                  <option value="all">All Parameters</option>
                  <option value="voltage">⚡ Voltage</option>
                  <option value="current">🔌 Current</option>
                  <option value="power">💡 Power</option>
                  <option value="other">📊 Other</option>
                </select>
              </div>

              <div class="control-group">
                <label class="control-label">🕐 Last Update</label>
                <div id="timestamp" class="timestamp-badge">--:--:--</div>
              </div>
            </div>

            <!-- Data Table Card -->
            <div class="data-table-card">
              <div class="table-header">
                <div class="table-title">
                  <div class="title-icon">📊</div>
                  <span>System Parameters</span>
                </div>
                <div class="status-indicator">
                  <div class="pulse-dot"></div>
                  <span class="status-text">Live Data</span>
                </div>
              </div>

              <div class="table-wrapper">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th class="col-converter">Converter</th>
                      <th class="col-device">Device/Meter</th>
                      <th class="col-name">Parameter Name</th>
                      <th class="col-value">Value</th>
                      <th class="col-unit">Unit</th>
                      <th class="col-desc">Description</th>
                    </tr>
                  </thead>
                  <tbody id="overview-body">
                    <tr class="loading-row">
                      <td colspan="6">
                        <div class="loading-cell">
                          <div class="loading-spinner"></div>
                          <span>Loading realtime data...</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      `;

      const mod = await import("/frontend/monitor/dashboard/overview.js");
      if (mod.updateOverview) {
        await mod.updateOverview();
      }
      return;
    }
  }

  // ============================================================
  // RENDER DASHBOARD SHELL
  // ============================================================
window.renderDashboardShell = function (content) {
    if (!content) {
      console.error("❌ Content container not found!");
      return;
    }
    // ใช้แท็บบาร์จาก index.html; ที่นี่เพียงแค่เคลียร์และเตรียมโหลดแท็บ
    const host = el("dash-content");
    if (host) {
      host.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Loading...</div>';
    }
    setTimeout(() => loadTab("summary"), 50);
  };

  // API สำหรับแท็บบาร์ภายนอก
  window.TAB = window.TAB || {};
  window.TAB.switchTo = function(name){
    const isOverview = name === 'overview';
    updateFilterDropdowns(isOverview);
    loadTab(name);
  };
})();
