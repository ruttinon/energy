import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import { ShieldCheck, Power, Zap, RefreshCw, Radio, PlugZap, Server, File, Globe } from 'lucide-react';

const ExtensionControl = () => {
  const { showAlert } = useDialog();
  const { selectedProject, devices, readingsByDevice, selectedConverter, setSelectedConverter, selectedDevice, setSelectedDevice } = useApp();
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({ mode: 'api', api_base: '', db_path: '', file_path: '' });
  const [probe, setProbe] = useState(null);

  const converters = useMemo(() => {
    const uniqueConverters = [...new Set(devices.map(d => d.converter))].sort();
    return ['ทั้งหมด', ...uniqueConverters];
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (selectedConverter === 'ทั้งหมด' || !selectedConverter) return devices;
    return devices.filter(d => d.converter === selectedConverter);
  }, [devices, selectedConverter]);

  const API = getApiBase();

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API.replace(/\/api$/, '')}/api/powerstudio/status`, { 
        credentials: 'include',
        headers
      });
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data);
      if (data.config) setCfg({
        mode: data.config.mode || 'api',
        api_base: data.config.api_base || '',
        db_path: data.config.db_path || '',
        file_path: data.config.file_path || ''
      });
    } catch (e) {
      console.warn('Failed to load status:', e);
      setStatus({ connected: false, error: String(e) });
    }
  };

  const loadQueue = async () => {
    if (!selectedDevice) return;
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const url = `${API.replace(/\/api$/, '')}/api/extension/commands/list?device_id=${encodeURIComponent(selectedDevice)}`;
      const res = await fetch(url, { 
        credentials: 'include',
        headers
      });
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setQueue(data.commands || []);
    } catch (e) {
      console.warn('Failed to load queue:', e);
      setQueue([]);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [selectedProject]);

  useEffect(() => {
    loadQueue();
  }, [selectedDevice]);

  const saveConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API.replace(/\/api$/, '')}/api/powerstudio/config/${selectedProject}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(cfg)
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      await loadStatus();
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const probeSource = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API.replace(/\/api$/, '')}/api/powerstudio/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...cfg, mode: cfg.mode }),
        credentials: 'include'
      });
      const data = await res.json();
      setProbe(data);
    } catch (e) {
      setProbe({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (action) => {
        if (!selectedDevice) {
            showAlert('Warning', 'กรุณาเลือกมิเตอร์/อุปกรณ์ก่อน');
            return;
        }
        setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API.replace(/\/api$/, '')}/api/powerstudio/control/test`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ device_id: selectedDevice, action, reason: 'admin_panel' })
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      await loadQueue();
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const latest = selectedDevice ? (readingsByDevice[selectedDevice] || {}) : {};

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto scrollbar-hide bg-slate-50/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-yellow-600 opacity-80">Extension Overlay</div>
          <h2 className="text-2xl font-bold font-orbitron text-slate-800 mt-1">Power Studio Integration & Remote Control</h2>
          <p className="text-xs text-slate-500 font-rajdhani uppercase tracking-widest mt-1">ไม่แตะ Meter โดยตรง — ใช้ Relay/Breaker ผ่าน Command Queue</p>
        </div>
        <button onClick={() => { loadStatus(); loadQueue(); }} className="p-3 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-200 shadow-sm transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck size={18} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Power Studio Status</div>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <span className="text-slate-400">Mode</span>
              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{status?.mode || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <span className="text-slate-400">Connected</span>
              <span className={`font-mono font-bold ${status?.connected ? 'text-emerald-600' : 'text-red-500'}`}>{String(status?.connected || false).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <span className="text-slate-400">Active Project</span>
              <span className="font-mono text-yellow-600">{status?.source_summary?.active_project || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <span className="text-slate-400">Devices</span>
              <span className="font-mono text-slate-800">{(status?.source_summary?.devices || []).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Latest TS</span>
              <span className="font-mono text-slate-600 text-xs">{status?.source_summary?.latest_timestamp || '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
              <Server size={18} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Power Studio Source Config</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Mode</label>
              <select
                value={cfg.mode}
                onChange={(e) => setCfg({ ...cfg, mode: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-yellow-500"
              >
                <option value="api">API</option>
                <option value="db">DB</option>
                <option value="file">File</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2"><Globe size={12} /> API Base</label>
              <input
                type="text"
                value={cfg.api_base}
                onChange={(e) => setCfg({ ...cfg, api_base: e.target.value })}
                placeholder="http://localhost:8080/api/readings"
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2"><File size={12} /> File / DB Path</label>
              <input
                type="text"
                value={cfg.mode === 'db' ? cfg.db_path : cfg.file_path}
                onChange={(e) => setCfg({ ...cfg, [cfg.mode === 'db' ? 'db_path' : 'file_path']: e.target.value })}
                placeholder={cfg.mode === 'db' ? 'c:\\data\\powerstudio.db' : 'c:\\data\\ps_readings.json'}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveConfig}
              className="px-4 py-2 bg-cyan-50 text-cyan-600 border border-cyan-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-100 transition-all shadow-sm"
            >
              Save Config
            </button>
            <button
              onClick={probeSource}
              className="px-4 py-2 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-100 transition-all shadow-sm"
            >
              Probe Source
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
            {probe ? JSON.stringify(probe) : 'ผลการทดสอบจะแสดงที่นี่'}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
              <Radio size={18} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Select Converter / Meter</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Converter</label>
              <select
                value={selectedConverter || 'ทั้งหมด'}
                onChange={(e) => setSelectedConverter(e.target.value === 'ทั้งหมด' ? '' : e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-yellow-500"
              >
                {converters.map((conv) => (
                  <option key={conv} value={conv}>{conv}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Meter</label>
              <select
                value={selectedDevice || 'ทั้งหมด'}
                onChange={(e) => setSelectedDevice(e.target.value === 'ทั้งหมด' ? '' : e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-yellow-500"
              >
                <option value="ทั้งหมด">ทั้งหมด</option>
                {filteredDevices.map((dev) => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
              <PlugZap size={18} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Remote Actions</div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => sendCommand('trip')}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-100 transition-all shadow-sm"
            >
              <Power size={14} /> ตัดไฟ (Trip)
            </button>
            <button
              onClick={() => sendCommand('close')}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-100 transition-all shadow-sm"
            >
              <Zap size={14} /> ต่อไฟ (Close)
            </button>
          </div>
          <div className="text-[10px] text-slate-400 mt-3 bg-slate-50 p-2 rounded">คำสั่งจะถูกส่งไปยัง Relay/Breaker ผ่าน Agent โดยไม่แตะ Meter</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Queued Commands</div>
          <div className="text-[10px] text-slate-500">Device: <span className="font-mono text-yellow-600 font-bold">{selectedDevice || '-'}</span></div>
        </div>
        <div className="overflow-x-auto">
          {queue.length === 0 ? (
            <div className="text-slate-400 text-sm italic p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">ไม่มีคำสั่งคิวในอุปกรณ์นี้</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="p-3 rounded-l-lg">ID</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 rounded-r-lg">Queued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-slate-700">{q.id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${q.cmd?.action === 'trip' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {q.cmd?.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{q.cmd?.reason}</td>
                    <td className="p-3 font-mono text-slate-500 text-xs">{q.queued_at || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Meter Feedback (Evidence)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Voltage LL Avg', value: ((latest.Voltage_L1L2 || 0) + (latest.Voltage_L2L3 || 0) + (latest.Voltage_L3L1 || 0)) / 3, unit: 'V' },
            { label: 'Current Avg', value: ((latest.Current_L1 || 0) + (latest.Current_L2 || 0) + (latest.Current_L3 || 0)) / 3, unit: 'A' },
            { label: 'Active Power', value: latest.ActivePower_Total || 0, unit: 'W' },
            { label: 'Energy Wh', value: latest.ActiveEnergy_Import || latest.ActiveEnergy || 0, unit: 'Wh' },
          ].map((k, i) => (
            <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-yellow-300 transition-colors">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">{k.label}</div>
              <div className="flex items-baseline gap-1">
                <div className="text-xl font-mono font-bold text-slate-800">{Number(k.value || 0).toFixed(2)}</div>
                <div className="text-xs text-slate-400 font-mono">{k.unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExtensionControl;
