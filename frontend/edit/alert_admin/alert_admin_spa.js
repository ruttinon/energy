(function () {
  if (window.__alertAdminLoaded) return;
  window.__alertAdminLoaded = true;

  function injectAlertStyles() {
    if (document.getElementById('alert-cyber-styles')) return;
    const style = document.createElement('style');
    style.id = 'alert-cyber-styles';
    style.textContent = `
            .alert-container {
                padding: 20px;
                color: #cce8ff;
                max-height: calc(100vh - 140px);
                overflow-y: auto;
            }
            
            .alert-header {
                background: linear-gradient(135deg, #8b1a1a 0%, #5a0f0f 100%);
                border: 1px solid #c43a3a;
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .alert-title {
                font-size: 24px;
                color: #ffcaca;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            /* Summary Cards */
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }
            .summary-card {
                background: linear-gradient(180deg, rgba(17,50,70,0.8), rgba(15,34,50,0.8));
                border: 1px solid #274b61;
                border-radius: 10px;
                padding: 14px;
                text-align: center;
                transition: all 0.3s;
            }
            .summary-card:hover {
                border-color: #63d1ff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(99, 209, 255, 0.2);
            }
            .summary-card.critical {
                border-color: #d32f2f;
                background: linear-gradient(180deg, rgba(139,26,26,0.3), rgba(90,15,15,0.3));
            }
            .summary-card.warning {
                border-color: #f57c00;
                background: linear-gradient(180deg, rgba(245,124,0,0.2), rgba(200,100,0,0.2));
            }
            .summary-number {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 6px;
            }
            .summary-card.critical .summary-number { color: #ff5555; }
            .summary-card.warning .summary-number { color: #ffb74d; }
            .summary-card.info .summary-number { color: #64b5f6; }
            .summary-card .summary-number { color: #63d1ff; }
            .summary-label {
                color: #9bd0e8;
                font-size: 12px;
            }
            
            /* 2-Column Layout: Live Alerts | Device Status */
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                height: calc(100vh - 400px);
            }
            
            .panel {
                background: linear-gradient(180deg, rgba(17,50,70,0.7), rgba(15,34,50,0.7));
                border: 1px solid #274b61;
                border-radius: 12px;
                padding: 16px;
                display: flex;
                flex-direction: column;
            }
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 2px solid #274b61;
            }
            .panel-title {
                font-size: 16px;
                color: #63d1ff;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .live-badge {
                background: #d32f2f;
                color: white;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            .panel-content {
                flex: 1;
                overflow-y: auto;
                background: #0f2232;
                border: 1px solid #1a3a4f;
                border-radius: 8px;
                padding: 12px;
            }
            
            /* Alert Item */
            .alert-item {
                background: linear-gradient(135deg, rgba(17,34,48,0.8), rgba(12,24,36,0.8));
                border: 1px solid #274b61;
                border-left: 4px solid #63d1ff;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
                transition: all 0.2s;
            }
            .alert-item:hover {
                border-color: #63d1ff;
                transform: translateX(3px);
            }
            .alert-item.critical {
                border-left-color: #d32f2f;
                background: linear-gradient(135deg, rgba(139,26,26,0.2), rgba(90,15,15,0.2));
            }
            .alert-item.warning {
                border-left-color: #f57c00;
                background: linear-gradient(135deg, rgba(245,124,0,0.15), rgba(200,100,0,0.15));
            }
            .alert-header-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            .alert-device {
                font-weight: 600;
                color: #e0f4ff;
                font-size: 13px;
            }
            .alert-time {
                font-size: 11px;
                color: #9bd0e8;
            }
            .alert-message {
                color: #cce8ff;
                font-size: 12px;
                line-height: 1.4;
            }
            
            /* Device Status Table */
            .status-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .status-table thead {
                background: #0d1f2f;
                position: sticky;
                top: 0;
            }
            .status-table th {
                color: #9bd0e8;
                text-align: left;
                padding: 10px 8px;
                font-weight: 600;
                border-bottom: 2px solid #274b61;
            }
            .status-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #1a3a4f;
                color: #cce8ff;
            }
            .status-table tbody tr:hover {
                background: rgba(99, 209, 255, 0.05);
            }
            .status-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
            }
            .status-online {
                background: #4caf50;
                color: white;
            }
            .status-offline {
                background: #d32f2f;
                color: white;
            }
            .status-warning {
                background: #f57c00;
                color: white;
            }
            
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
            .btn-sm {
                padding: 5px 10px;
                font-size: 11px;
            }
            
            /* Empty State */
            .empty-state {
                text-align: center;
                padding: 40px;
                color: #9bd0e8;
            }
            .empty-state-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            /* Scrollbar */
            .panel-content::-webkit-scrollbar,
            .alert-container::-webkit-scrollbar {
                width: 8px;
            }
            .panel-content::-webkit-scrollbar-track,
            .alert-container::-webkit-scrollbar-track {
                background: #0f2232;
                border-radius: 4px;
            }
            .panel-content::-webkit-scrollbar-thumb,
            .alert-container::-webkit-scrollbar-thumb {
                background: #2c6b8a;
                border-radius: 4px;
            }
        `;
    document.head.appendChild(style);
  }

  const ALERT_HTML = `
  <div class="alert-container">
    
    <div class="alert-header">
      <div class="alert-title">
        🚨 Alert & Event Management
      </div>
      <button class="btn" onclick="window.AlertApp.reload()">🔄 Refresh</button>
    </div>

    <div class="summary-grid">
      <div class="summary-card critical">
        <div class="summary-number" id="sumCritical">0</div>
        <div class="summary-label">Critical Alerts</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-number" id="sumWarning">0</div>
        <div class="summary-label">Warnings</div>
      </div>
      <div class="summary-card info">
        <div class="summary-number" id="sumInfo">0</div>
        <div class="summary-label">Info Alerts</div>
      </div>
      <div class="summary-card">
        <div class="summary-number" id="sumTotal">0</div>
        <div class="summary-label">Total Alerts</div>
      </div>
    </div>

    <div class="main-grid">
      
      <!-- LEFT: Live Alerts -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            📡 Live Alerts
            <span class="live-badge" id="liveBadge">0 Active</span>
          </div>
        </div>
        <div class="panel-content" id="liveContainer">
          <div class="empty-state">
            <div class="empty-state-icon">✓</div>
            <div>No active alerts</div>
            <small>System is operating normally</small>
          </div>
        </div>
      </div>

      <!-- RIGHT: Device Status -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            🖥️ Device Status Monitor
          </div>
          <button class="btn btn-sm" onclick="window.AlertApp.refreshDeviceStatus()">🔄</button>
        </div>
        <div class="panel-content">
          <table class="status-table">
            <thead>
              <tr>
                <th>DEVICE</th>
                <th>IP ADDRESS</th>
                <th style="text-align:center">STATUS</th>
                <th>LAST SEEN</th>
              </tr>
            </thead>
            <tbody id="deviceStatusTableBody">
              <tr>
                <td colspan="4" class="empty-state">Loading device status...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

  </div>
  `;

  window.AlertApp = {
    timer: null,

    init: function () {
      this.loadLiveAlerts();
      this.refreshDeviceStatus();

      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.loadLiveAlerts();
      }, 5000);
    },

    reload: function () {
      this.init();
    },
    loadLiveAlerts: async function () {
      const container = document.getElementById('liveContainer');
      if (!container) return;

      try {
        // Get active project ID
        let project_id = null;
        try {
          const activeRes = await fetch('/api/active');
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            project_id = activeData.active;
          }
        } catch (e) {
          console.log('Could not get active project:', e);
        }

        const url = project_id ? `/api/alert/logs?project_id=${project_id}` : '/api/alert/logs';
        const res = await fetch(url);

        if (!res.ok) throw new Error('Failed to fetch alerts');
        const logs = await res.json();

        // Filter only active alerts (not ONLINE recovery messages unless recent)
        const now = new Date();
        const activeAlerts = logs.filter(alert => {
          // Show OFFLINE and critical alerts always
          if (alert.event === 'OFFLINE' || alert.severity === 'critical') {
            return true;
          }

          // Show ONLINE recovery only if within last 5 minutes
          if (alert.event === 'ONLINE') {
            try {
              const alertTime = new Date(alert.time);
              const diffMinutes = (now - alertTime) / 1000 / 60;
              return diffMinutes <= 5;
            } catch (e) {
              return false;
            }
          }

          // Show other alerts (warnings, etc)
          return true;
        });

        // Update summary counts
        const critical = logs.filter(a => a.severity === 'critical').length;
        const warning = logs.filter(a => a.severity === 'warning').length;
        const info = logs.filter(a => a.severity === 'info').length;

        document.getElementById('sumCritical').textContent = critical;
        document.getElementById('sumWarning').textContent = warning;
        document.getElementById('sumInfo').textContent = info;
        document.getElementById('sumTotal').textContent = logs.length;

        if (activeAlerts.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">✓</div>
              <div>No active alerts</div>
              <small>System is operating normally</small>
            </div>
          `;
          document.getElementById('liveBadge').textContent = '0 Active';
          return;
        }

        document.getElementById('liveBadge').textContent = activeAlerts.length + ' Active';

        container.innerHTML = activeAlerts.map(alert => {
          // Map severity to CSS class
          let levelClass = 'info';
          const sev = (alert.severity || 'info').toLowerCase();
          if (sev === 'critical' || sev === 'error') levelClass = 'critical';
          else if (sev === 'warning') levelClass = 'warning';
          else levelClass = 'info';

          // Format message
          let message = alert.message || '-';
          if (alert.metric && alert.value != null) {
            message = `${alert.metric} ${alert.operator || ''} ${alert.threshold || ''} (current: ${alert.value})`;
          }

          // Add icon based on event type
          let icon = '⚠️';
          if (alert.event === 'OFFLINE') icon = '🔴';
          else if (alert.event === 'ONLINE') icon = '🟢';
          else if (sev === 'critical') icon = '🚨';
          else if (sev === 'warning') icon = '⚠️';
          else icon = 'ℹ️';

          return `
            <div class="alert-item ${levelClass}">
              <div class="alert-header-row">
                <div class="alert-device">${icon} ${alert.device_name || alert.device_id || 'Unknown Device'}</div>
                <div class="alert-time">${alert.time || '-'}</div>
              </div>
              <div class="alert-message">${message}</div>
              ${alert.rule_name ? `<div style="font-size:11px;color:#9bd0e8;margin-top:4px">Rule: ${alert.rule_name}</div>` : ''}
            </div>
          `;
        }).join('');

      } catch (e) {
        console.error('Error loading alerts:', e);
        container.innerHTML = `<div class="empty-state" style="color:#f88">Error loading alerts: ${e.message}</div>`;
      }
    },

    refreshDeviceStatus: async function () {
      const tbody = document.getElementById('deviceStatusTableBody');
      if (!tbody) return;

      try {
        const res = await fetch('/api/alert/device/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const statusMap = await res.json();
        const devices = Object.keys(statusMap).map(k => ({ id: k, ...statusMap[k] }));

        if (devices.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No devices configured</td></tr>';
          // Update summary to 0
          document.getElementById('sumCritical').textContent = '0';
          document.getElementById('sumWarning').textContent = '0';
          document.getElementById('sumInfo').textContent = '0';
          document.getElementById('sumTotal').textContent = '0';
          return;
        }

        tbody.innerHTML = devices.map(dev => {
          const isOnline = dev.online === true;
          const statusClass = isOnline ? 'status-online' : 'status-offline';
          const statusText = isOnline ? 'ONLINE' : 'OFFLINE';

          return `
            <tr>
              <td>
                <strong>${dev.device_name || dev.id}</strong>
                <div style="font-size:10px;color:#63d1ff">${dev.convertor_name || '-'}</div>
              </td>
              <td>${dev.ip || '-'}</td>
              <td style="text-align:center">
                <span class="status-badge ${statusClass}">
                  ${statusText}
                </span>
              </td>
              <td>${dev.last_seen || '-'}</td>
            </tr>
          `;
        }).join('');

        // Update summary
        const critical = devices.filter(d => !d.online).length;
        const info = devices.filter(d => d.online).length;
        // We don't have a distinct 'warning' state in the simplistic status API yet, usually it's just online/offline
        // unless we add logic. For now, let's map offline->critical, online->info.

        document.getElementById('sumCritical').textContent = critical;
        document.getElementById('sumWarning').textContent = '0';
        document.getElementById('sumInfo').textContent = info;
        document.getElementById('sumTotal').textContent = devices.length;

      } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#f88">Error loading status: ${e.message}</td></tr>`;
      }
    },

    renderRulesPage: async function () {
      const area = document.querySelector('.main-grid');
      if (!area) return;

      // Clear existing grid content to show rules instead
      area.innerHTML = `
            <div class="panel" style="grid-column: 1 / -1;">
                <div class="panel-header">
                    <div class="panel-title">📏 Alert Rules</div>
                    <button class="btn btn-primary" onclick="window.AlertApp.openRuleModal()">+ Add Rule</button>
                </div>
                <div class="panel-content" id="rulesListContainer">
                    <div class="empty-state">Loading rules...</div>
                </div>
            </div>
        `;

      this.loadRules();
    },

    loadRules: async function () {
      const container = document.getElementById('rulesListContainer');
      if (!container) return;

      try {
        const res = await fetch('/api/alert/rules');
        if (!res.ok) throw new Error('Failed to load rules');
        const rules = await res.json();

        if (rules.length === 0) {
          container.innerHTML = `
                    <div class="empty-state">
                        <div>No alert rules defined</div>
                        <small>Create a rule to monitor device parameters</small>
                    </div>
                `;
          return;
        }

        container.innerHTML = `
                <table class="status-table">
                    <thead>
                        <tr>
                            <th>Rule Name</th>
                            <th>Condition</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rules.map(r => `
                            <tr>
                                <td>
                                    <div style="font-weight:bold;color:#e0f4ff">${r.rule_name || 'Untitled'}</div>
                                    <div style="font-size:11px;color:#9bd0e8">${r.message || ''}</div>
                                </td>
                                <td>
                                    <span style="color:#63d1ff">${r.metric}</span> 
                                    <span style="color:#ccc">${r.operator}</span> 
                                    <span style="color:#ffb74d">${r.threshold}</span>
                                </td>
                                <td>
                                    <span class="status-badge" style="background:${this.getSeverityColor(r.severity)}">
                                        ${(r.severity || 'info').toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    ${r.is_active ? '<span style="color:#4caf50">Active</span>' : '<span style="color:#f44">Disabled</span>'}
                                </td>
                                <td>
                                    <button class="btn btn-sm" onclick="window.AlertApp.openRuleModal(${r.id})">✏️</button>
                                    <button class="btn btn-sm" style="border-color:#d32f2f;color:#d32f2f" onclick="window.AlertApp.deleteRule(${r.id})">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

      } catch (e) {
        container.innerHTML = `<div class="empty-state" style="color:#f88">Error: ${e.message}</div>`;
      }
    },

    getSeverityColor: function (sev) {
      switch ((sev || '').toLowerCase()) {
        case 'critical': return '#d32f2f';
        case 'warning': return '#f57c00';
        default: return '#1976d2';
      }
    },

    openRuleModal: async function (ruleId = null) {
      let rule = {
        rule_name: '', metric: '', operator: '>', threshold: 0, severity: 'warning', message: '', is_active: true
      };

      if (ruleId) {
        try {
          const rules = await (await fetch('/api/alert/rules')).json();
          rule = rules.find(r => r.id == ruleId) || rule;
        } catch (e) { }
      }

      const overlay = document.createElement('div');
      overlay.id = 'rule-modal-overlay';
      overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(5px);
        `;

      overlay.innerHTML = `
            <div class="panel" style="width: 500px; max-width: 90%; background: #0f2232; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <div class="panel-header">
                    <div class="panel-title">${ruleId ? 'Edit Rule' : 'New Rule'}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; padding: 10px 0;">
                    
                    <label>Rule Name</label>
                    <input id="fr-name" class="popup-input" value="${rule.rule_name}" placeholder="e.g. High Voltage Warning">
                    
                    <label>Parameter (Metric Key)</label>
                    <input id="fr-metric" class="popup-input" value="${rule.metric}" placeholder="e.g. voltage_l1, temp_c">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label>Operator</label>
                            <select id="fr-op" class="popup-select" style="width:100%">
                                <option value=">" ${rule.operator == '>' ? 'selected' : ''}>&gt; (Greater)</option>
                                <option value="<" ${rule.operator == '<' ? 'selected' : ''}>&lt; (Less)</option>
                                <option value=">=" ${rule.operator == '>=' ? 'selected' : ''}>&gt;= (GTE)</option>
                                <option value="<=" ${rule.operator == '<=' ? 'selected' : ''}>&lt;= (LTE)</option>
                                <option value="==" ${rule.operator == '==' ? 'selected' : ''}>== (Equal)</option>
                                <option value="!=" ${rule.operator == '!=' ? 'selected' : ''}>!= (Not Equal)</option>
                            </select>
                        </div>
                        <div>
                            <label>Threshold</label>
                            <input id="fr-th" type="number" step="any" class="popup-input" value="${rule.threshold}">
                        </div>
                    </div>

                    <label>Severity</label>
                    <select id="fr-sev" class="popup-select" style="width:100%">
                        <option value="info" ${rule.severity == 'info' ? 'selected' : ''}>Info (Blue)</option>
                        <option value="warning" ${rule.severity == 'warning' ? 'selected' : ''}>Warning (Orange)</option>
                        <option value="critical" ${rule.severity == 'critical' ? 'selected' : ''}>Critical (Red)</option>
                    </select>

                    <label>Alert Message</label>
                    <input id="fr-msg" class="popup-input" value="${rule.message}" placeholder="Message to display in alert log">

                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button class="btn" onclick="document.getElementById('rule-modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-rule">Save</button>
                </div>
            </div>
        `;

      if (!document.getElementById('popup-styles-extra')) {
        const s = document.createElement('style');
        s.id = 'popup-styles-extra';
        s.textContent = `
                .popup-input, .popup-select {
                    background: #1a3a4f; border: 1px solid #274b61; color: #fff;
                    padding: 8px; border-radius: 6px; width: 100%; box-sizing: border-box;
                    margin-bottom: 5px;
                }
                .popup-input:focus, .popup-select:focus { outline: none; border-color: #63d1ff; }
            `;
        document.head.appendChild(s);
      }

      document.body.appendChild(overlay);

      document.getElementById('btn-save-rule').onclick = async () => {
        const data = {
          rule_name: document.getElementById('fr-name').value,
          metric: document.getElementById('fr-metric').value,
          operator: document.getElementById('fr-op').value,
          threshold: parseFloat(document.getElementById('fr-th').value) || 0,
          severity: document.getElementById('fr-sev').value,
          message: document.getElementById('fr-msg').value,
          is_active: true
        };

        try {
          const url = ruleId ? `/api/alert/rules/update/${ruleId}` : '/api/alert/rules/add';
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (!r.ok) throw new Error('Save failed');

          document.getElementById('rule-modal-overlay').remove();
          this.loadRules();
        } catch (e) {
          alert('Error saving rule: ' + e.message);
        }
      };
    },

    deleteRule: async function (id) {
      if (!confirm('Delete this rule?')) return;
      try {
        await fetch(`/api/alert/rules/delete/${id}`, { method: 'DELETE' });
        this.loadRules();
      } catch (e) {
        alert('Delete failed');
      }
    },

    switchView: function (view) {
      if (view === 'dashboard') {
        this.init();
        const area = document.querySelector('.main-grid');
        if (area && !document.getElementById('liveContainer')) {
          renderAlertAdminPage();
        }
      } else if (view === 'rules') {
        this.renderRulesPage();
      }
    }
  };



  function renderAlertAdminPage() {
    const area = document.getElementById('content-area');
    injectAlertStyles();
    // Update Header to have Tabs
    const headerHTML = `
    <div class="alert-container">
        <div class="alert-header">
          <div class="alert-title">
            🚨 Alert & Event Management
          </div>
          <div style="display:flex; gap:10px;">
              <button class="btn" onclick="window.AlertApp.switchView('dashboard')">📊 Dashboard</button>
              <button class="btn" onclick="window.AlertApp.switchView('rules')">⚙️ Rules Logic</button>
              <button class="btn" onclick="window.AlertApp.reload()">🔄 Refresh</button>
          </div>
        </div>

        <div class="summary-grid" id="summaryGrid">
           <!-- (Summary cards code logic inside dashboard reload) -->
           <!-- For simplicity, render dashboard by default structure -->
           <div class="summary-card critical"><div class="summary-number" id="sumCritical">0</div><div class="summary-label">Critical Alerts</div></div>
           <div class="summary-card warning"><div class="summary-number" id="sumWarning">0</div><div class="summary-label">Warnings</div></div>
           <div class="summary-card info"><div class="summary-number" id="sumInfo">0</div><div class="summary-label">Info Alerts</div></div>
           <div class="summary-card"><div class="summary-number" id="sumTotal">0</div><div class="summary-label">Total Alerts</div></div>
        </div>

        <div class="main-grid">
           <!-- LEFT: Live Alerts -->
           <div class="panel" id="panel-live">
             <div class="panel-header">
               <div class="panel-title">📡 Live Alerts <span class="live-badge" id="liveBadge">0 Active</span></div>
             </div>
             <div class="panel-content" id="liveContainer"><div class="empty-state">Loading...</div></div>
           </div>

           <!-- RIGHT: Device Status -->
           <div class="panel" id="panel-status">
             <div class="panel-header">
               <div class="panel-title">🖥️ Device Status Monitor</div>
               <button class="btn btn-sm" onclick="window.AlertApp.refreshDeviceStatus()">🔄</button>
             </div>
             <div class="panel-content">
               <table class="status-table">
                 <thead><tr><th>DEVICE</th><th>IP ADDRESS</th><th style="text-align:center">STATUS</th><th>LAST SEEN</th></tr></thead>
                 <tbody id="deviceStatusTableBody"><tr><td colspan="4">Loading...</td></tr></tbody>
               </table>
             </div>
           </div>
        </div>
    </div>
    `;

    area.innerHTML = headerHTML;
    window.AlertApp.init(); // Load dashboard data by default
    if (window.highlightNav) window.highlightNav('alert_admin');
  }

  window.renderAlertAdminPage = renderAlertAdminPage;

  const oldShow = window.showPage;
  window.showPage = function (page) {
    if (page === 'alert_admin') {
      renderAlertAdminPage();
      if (window.highlightNav) window.highlightNav('alert_admin');
      return;
    }
    if (oldShow) return oldShow(page);
  };

})();