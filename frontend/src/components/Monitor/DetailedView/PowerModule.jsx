import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';

const PowerModule = () => {
    const { selectedDevice, readingsByDevice } = useApp();
    const [mode, setMode] = useState('INST');
    const [type, setType] = useState('P');
    const [history, setHistory] = useState({
        L1: [], L2: [], L3: [], Total: []
    });

    const latest = selectedDevice ? readingsByDevice[selectedDevice] : null;

    useEffect(() => {
        if (!latest) return;

        let valL1 = 0, valL2 = 0, valL3 = 0, valTotal = 0;

        if (type === 'P') {
            valL1 = latest.ActivePower_L1 || 0;
            valL2 = latest.ActivePower_L2 || 0;
            valL3 = latest.ActivePower_L3 || 0;
            valTotal = latest.ActivePower_Total || (valL1 + valL2 + valL3);
        } else if (type === 'Q') {
            valL1 = latest.ReactivePower_L1 || 0;
            valL2 = latest.ReactivePower_L2 || 0;
            valL3 = latest.ReactivePower_L3 || 0;
            valTotal = latest.ReactivePower_Total || (valL1 + valL2 + valL3);
        } else if (type === 'S') {
            valL1 = latest.ApparentPower_L1 || 0;
            valL2 = latest.ApparentPower_L2 || 0;
            valL3 = latest.ApparentPower_L3 || 0;
            valTotal = latest.ApparentPower_Total || (valL1 + valL2 + valL3);
        } else if (type === 'PF') {
            valL1 = latest.PowerFactor_L1 || 0;
            valL2 = latest.PowerFactor_L2 || 0;
            valL3 = latest.PowerFactor_L3 || 0;
            valTotal = latest.PowerFactor_Total || 0;
        }

        setHistory(prev => ({
            L1: [...prev.L1, valL1].slice(-50),
            L2: [...prev.L2, valL2].slice(-50),
            L3: [...prev.L3, valL3].slice(-50),
            Total: [...prev.Total, valTotal].slice(-50)
        }));
    }, [latest, type]);

    const getStats = (arr) => {
        if (arr.length === 0) return { current: 0, avg: 0, max: 0, min: 0 };
        const current = arr[arr.length - 1];
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        const max = Math.max(...arr);
        const min = Math.min(...arr);
        return { current, avg, max, min };
    };

    const getPhaseData = (phase) => {
        const stats = getStats(history[phase]);
        return mode === 'INST' ? stats.current : stats.avg;
    };

    const fmt = (n) => typeof n === 'number' ? n.toFixed(3) : '--';

    const Gauge = ({ label, value, max = 5000 }) => {
        const percent = Math.min(100, Math.max(0, (value / max) * 100));
        return (
            <div className="flex flex-col items-center gap-4 flex-1 min-w-[120px]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                <div className="relative w-12 h-48 bg-slate-100 border border-slate-200 rounded-full overflow-hidden p-1 shadow-inner">
                    <div
                        className="absolute bottom-1 left-1 right-1 rounded-full transition-all duration-1000 bg-gradient-to-t from-yellow-600 to-yellow-300"
                        style={{ height: `${percent}%` }}
                    />
                    <div
                        className="absolute bottom-1 left-0 right-0 h-0.5 bg-slate-800 shadow-[0_0_4px_rgba(0,0,0,0.3)] z-10"
                        style={{ bottom: `${percent}%` }}
                    />
                </div>
                <div className="px-3 py-1 bg-slate-50 rounded border border-slate-200 font-mono text-yellow-600 font-bold shadow-sm">
                    {fmt(value)}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800">Power Monitoring</h2>
                    <p className="text-sm text-slate-500 font-rajdhani uppercase tracking-widest">
                        {mode} Mode — {type === 'P' ? 'Active' : type === 'Q' ? 'Reactive' : type === 'S' ? 'Apparent' : 'Power Factor'} Analysis
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
                        {['INST', 'AVG'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${mode === m ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
                        {['P', 'Q', 'S', 'PF'].map(t => (
                            <button
                                key={t}
                                onClick={() => setType(t)}
                                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${type === t ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-8">
                <div className="flex flex-nowrap sm:justify-around items-end gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                    <Gauge label="Phase L1" value={getPhaseData('L1')} max={type === 'PF' ? 1 : 5000} />
                    <Gauge label="Phase L2" value={getPhaseData('L2')} max={type === 'PF' ? 1 : 5000} />
                    <Gauge label="Phase L3" value={getPhaseData('L3')} max={type === 'PF' ? 1 : 5000} />
                    <div className="hidden sm:block w-px h-48 bg-slate-200" />
                    <Gauge label="System Total" value={getPhaseData('Total')} max={type === 'PF' ? 1 : 15000} />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="text-left py-3 px-6 font-medium uppercase tracking-widest text-[10px]">Parameter</th>
                            <th className="text-right py-3 px-6 font-medium uppercase tracking-widest text-[10px]">L1</th>
                            <th className="text-right py-3 px-6 font-medium uppercase tracking-widest text-[10px]">L2</th>
                            <th className="text-right py-3 px-6 font-medium uppercase tracking-widest text-[10px]">L3</th>
                            <th className="text-right py-3 px-6 font-medium uppercase tracking-widest text-[10px]">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {[
                            { label: 'Current Value', key: 'current' },
                            { label: 'Average (Moving)', key: 'avg' },
                            { label: 'Peak (Max)', key: 'max' },
                            { label: 'Critical (Min)', key: 'min' },
                        ].map(row => (
                            <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-6 text-slate-500 font-medium">{row.label}</td>
                                <td className="py-3 px-6 text-right font-mono text-slate-800">{fmt(getStats(history.L1)[row.key])}</td>
                                <td className="py-3 px-6 text-right font-mono text-slate-800">{fmt(getStats(history.L2)[row.key])}</td>
                                <td className="py-3 px-6 text-right font-mono text-slate-800">{fmt(getStats(history.L3)[row.key])}</td>
                                <td className="py-3 px-6 text-right font-mono text-yellow-600 font-bold">{fmt(getStats(history.Total)[row.key])}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PowerModule;
