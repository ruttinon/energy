import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import { CheckCircle2, XCircle, Radio, Power, Zap, RefreshCw } from 'lucide-react';

const ExtensionQuickControl = () => {
  const { devices, selectedConverter, setSelectedConverter, selectedDevice, setSelectedDevice } = useApp();
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const timerRef = useRef(null);

  const converters = useMemo(() => {
    const uniqueConverters = [...new Set(devices.map(d => d.converter))].sort();
    return ['ทั้งหมด', ...uniqueConverters];
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (selectedConverter === 'ทั้งหมด' || !selectedConverter) return devices;
    return devices.filter(d => d.converter === selectedConverter);
  }, [devices, selectedConverter]);

  const API = getApiBase();
  const origin = API.replace(/\/api$/, '');

  const readLatest = async () => {
    if (!selectedDevice) return null;
    try {
      const res = await fetch(`${origin}/api/json_latest/${encodeURIComponent(selectedDevice)}`, { credentials: 'include' });
      const data = await res.json();
      if (data.status !== 'ok') return null;
      const v = data.latest || {};
      const Iavg = ((v.Current_L1 || 0) + (v.Current_L2 || 0) + (v.Current_L3 || 0)) / 3;
      const P = v.ActivePower_Total || ((v.ActivePower_L1 || 0) + (v.ActivePower_L2 || 0) + (v.ActivePower_L3 || 0));
      return { Iavg, P, raw: v };
    } catch (e) {
      return null;
    }
  };

  const verify = async (mode) => {
    setResult(null);
    const base = await readLatest();
    setBaseline(base);
    let ok = false;
    let last = null;
    const start = Date.now();
    const timeoutMs = 10000;
    const tick = async () => {
      last = await readLatest();
      if (mode === 'trip') {
        // success เมื่อ Iavg < 0.2A หรือ P < 5W
        if (last && (Number(last.Iavg) < 0.2 || Number(last.P) < 5)) ok = true;
      } else {
        // success เมื่อ Iavg > 0.5A หรือ P > 20W หรือมากกว่าฐาน 50%
        if (last && (Number(last.Iavg) > 0.5 || Number(last.P) > 20 ||
          (base && Number(last.Iavg) > Number(base.Iavg) * 1.5))) ok = true;
      }
      const elapsed = Date.now() - start;
      if (ok || elapsed >= timeoutMs) {
        clearInterval(timerRef.current);
        setResult({ ok, last, base, elapsed });
      }
    };
    timerRef.current = setInterval(tick, 1000);
  };

  const sendCommand = async (action) => {
    if (!selectedDevice) {
      showAlert('แจ้งเตือน', 'กรุณาเลือกอุปกรณ์ก่อน');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${origin}/api/extension/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ device_id: selectedDevice, action, reason: 'quick_control' })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await verify(action === 'trip' ? 'trip' : 'close');
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto scrollbar-hide bg-slate-50/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-yellow-600 opacity-80">Extension Overlay</div>
          <h2 className="text-2xl font-bold font-orbitron text-slate-800 mt-1">Control Proof</h2>
          <p className="text-xs text-slate-500 font-rajdhani uppercase tracking-widest mt-1">หน้าทดสอบการควบคุมโดยไม่ยุ่งกับ UI เดิม</p>
        </div>
        <button className="p-3 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-200 shadow-sm transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
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
             <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Actions</div>
          </div>
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
        <div className="text-[10px] text-slate-400 mt-3 bg-slate-50 p-2 rounded">ระบบจะตรวจสอบผลจากค่า Meter (ผ่าน Power Studio) ภายใน ~10s</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Verification</div>
        {result ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-4">
              {result.ok ? <CheckCircle2 className="text-emerald-500" /> : <XCircle className="text-red-500" />}
              <div className={`text-sm font-bold ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.ok ? 'SUCCESS' : 'FAILED'} ใน {Math.round((result.elapsed || 0)/1000)}s
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Baseline Iavg</div>
                <div className="font-mono text-slate-800 font-bold">{baseline ? Number(baseline.Iavg || 0).toFixed(2) : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Baseline P</div>
                <div className="font-mono text-slate-800 font-bold">{baseline ? Number(baseline.P || 0).toFixed(2) : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Latest Iavg</div>
                <div className="font-mono text-slate-800 font-bold">{result.last ? Number(result.last.Iavg || 0).toFixed(2) : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Latest P</div>
                <div className="font-mono text-slate-800 font-bold">{result.last ? Number(result.last.P || 0).toFixed(2) : '-'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm mt-2 italic p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">ยังไม่มีผลการตรวจสอบ</div>
        )}
      </div>
    </div>
  );
};

export default ExtensionQuickControl;
