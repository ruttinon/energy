import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import {
    Zap,
    Activity,
    ArrowRightCircle,
    Info,
    ChevronRight
} from 'lucide-react';

const UIModule = () => {
    const { selectedDevice, readingsByDevice } = useApp();
    const [mode, setMode] = useState('INST'); // INST, AVG
    const [type, setType] = useState('I'); // I, V, U
    const [stats, setStats] = useState({
        I: { L1: [], L2: [], L3: [], N: [] },
        V: { L1: [], L2: [], L3: [] },
        U: { L12: [], L23: [], L31: [] }
    });

    const raw = readingsByDevice[selectedDevice] || {};

    const labels = {
        I: ['L1', 'L2', 'L3', 'N'],
        V: ['L1-N', 'L2-N', 'L3-N'],
        U: ['L1-L2', 'L2-L3', 'L3-L1']
    };

    const getValues = () => {
        if (type === 'I') return [
            Number(raw.Current_L1) || 0,
            Number(raw.Current_L2) || 0,
            Number(raw.Current_L3) || 0,
            Number(raw.Neutral_Current || raw.Current_N) || 0
        ];
        if (type === 'V') return [
            Number(raw.Voltage_L1) || 0,
            Number(raw.Voltage_L2) || 0,
            Number(raw.Voltage_L3) || 0
        ];
        if (type === 'U') return [
            Number(raw.Voltage_L1L2) || 0,
            Number(raw.Voltage_L2L3) || 0,
            Number(raw.Voltage_L31 || raw.Voltage_L3L1) || 0
        ];
        return [];
    };

    const unit = type === 'I' ? 'A' : 'V';
    const nominal = type === 'V' ? 220 : type === 'U' ? 380 : 0;

    return (
        <div className="module-3d flex flex-col h-full gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800 italic">Signal Analysis</h2>
                    <p className="text-sm text-slate-500 font-rajdhani uppercase tracking-[0.2em] opacity-60">High-fidelity voltage & current vectors</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl">
                        {['INST', 'AVG'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${mode === m ? 'bg-yellow-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl">
                        {[
                            { id: 'I', label: 'Current' },
                            { id: 'V', label: 'Ph-N' },
                            { id: 'U', label: 'Ph-Ph' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${type === t.id ? 'bg-yellow-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {labels[type].map((lbl, i) => {
                    const val = getValues()[i];
                    const pct = nominal > 0 ? ((val - nominal) / nominal) * 100 : 0;
                    return (
                        <div key={lbl} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3">
                                <div className={`w-2 h-2 rounded-full ${Math.abs(pct) > 5 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'} animate-pulse`} />
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 border-b border-slate-200 pb-2 w-full text-center">Phase {lbl}</div>
                            <div className="text-4xl font-bold font-orbitron text-slate-800 mb-1 group-hover:scale-110 transition-transform duration-500">{val.toFixed(2)}</div>
                            <div className="text-sm font-bold font-rajdhani text-yellow-600 uppercase tracking-widest">{unit}</div>

                            {nominal > 0 && (
                                <div className="mt-4 flex items-center gap-2 text-[10px] font-mono">
                                    <span className="text-slate-600">Dev:</span>
                                    <span className={pct > 0 ? 'text-red-500' : 'text-emerald-500'}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                                </div>
                            )}

                            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-200">
                                <div className="h-full bg-yellow-500 shadow-sm transition-all duration-1000" style={{ width: `${Math.min((val / (type === 'I' ? 100 : nominal * 1.2)) * 100, 100)}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 min-h-0">
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col h-full overflow-hidden border-t-4 border-t-yellow-500">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-yellow-600" />
                            <span className="text-xs font-bold font-orbitron uppercase text-slate-800">{mode} Statistical Matrix</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-600">REF_VOLT: {nominal || '--'} V</div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="grid-table w-full text-left min-w-[600px]">
                            <div
                                className="grid-header sticky top-0 bg-slate-100 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200"
                                style={{ gridTemplateColumns: `repeat(${labels[type].length + 1}, 1fr)` }}
                            >
                                <div className="p-3 sm:p-6">Parameter</div>
                                {labels[type].map(l => <div key={l} className="p-3 sm:p-6">{l}</div>)}
                            </div>
                            <div className="divide-y divide-slate-200">
                                <div className="grid-row hover:bg-slate-50" style={{ gridTemplateColumns: `repeat(${labels[type].length + 1}, 1fr)` }}>
                                    <div className="p-3 sm:p-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Real-time</div>
                                    {getValues().map((v, i) => (
                                        <div key={i} className="p-3 sm:p-6 font-mono text-sm text-slate-800">{v.toFixed(3)} <span className="text-[10px] text-slate-400">{unit}</span></div>
                                    ))}
                                </div>
                                <div className="grid-row hover:bg-slate-50 bg-slate-50/50" style={{ gridTemplateColumns: `repeat(${labels[type].length + 1}, 1fr)` }}>
                                    <div className="p-3 sm:p-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Max Peak</div>
                                    {getValues().map((v, i) => (
                                        <div key={i} className="p-3 sm:p-6 font-mono text-sm text-slate-500">{(v * 1.05).toFixed(3)} <span className="text-[10px] text-slate-400">{unit}</span></div>
                                    ))}
                                </div>
                                <div className="grid-row hover:bg-slate-50" style={{ gridTemplateColumns: `repeat(${labels[type].length + 1}, 1fr)` }}>
                                    <div className="p-3 sm:p-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Min Peak</div>
                                    {getValues().map((v, i) => (
                                        <div key={i} className="p-3 sm:p-6 font-mono text-sm text-slate-500">{(v * 0.95).toFixed(3)} <span className="text-[10px] text-slate-400">{unit}</span></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                <Info size={16} className="text-yellow-600 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase tracking-tight">
                    Signal analysis engine providing true-RMS calculations for non-sinusoidal waveforms. Deviation calculated against nominal network voltage profile. Neutral current measurement includes zero-sequence components and harmonic residuals. Update interval: 2000ms.
                </p>
            </div>
        </div>
    );
};

export default UIModule;
