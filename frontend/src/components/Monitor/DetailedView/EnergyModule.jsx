import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import {
    Zap,
    RotateCcw,
    Clock,
    Table as TableIcon,
    Activity,
    ArrowRight
} from 'lucide-react';

const EnergyModule = () => {
    const { selectedDevice, readingsByDevice } = useApp();
    const [energyState, setEnergyState] = useState({
        EA_plus: 0,
        EA_minus: 0,
        ER_plus: 0,
        ER_minus: 0,
        ES: 0,
        last_ts: null,
        start_ts: Date.now()
    });

    const [partial, setPartial] = useState(null);
    const [activeTab, setActiveTab] = useState('general'); // general, tariff

    const fmtTime = (ms) => {
        const total = Math.floor(ms / 1000);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    useEffect(() => {
        if (!selectedDevice || !readingsByDevice[selectedDevice]) return;

        const raw = readingsByDevice[selectedDevice];
        const now = Date.now();

        setEnergyState(prev => {
            const dh = prev.last_ts ? (now - prev.last_ts) / 3600000 : 0;

            const pick = (obj, keys) => {
                for (const k of keys) { if (obj[k] != null) return Number(obj[k]); }
                return null;
            };

            // Simple implementation of the logic from energy.js
            let ea = pick(raw, ['ActiveEnergy_kWh', 'EnergyActiveImport_kWh', 'EA+', 'EAP_total', 'TotalEnergy_kWh']);
            let gen = pick(raw, ['Generated_kWh', 'EnergyActiveExport_kWh', 'EA-', 'kWh_export']);
            let P = pick(raw, ['ActivePower_Total', 'P_total', 'ActivePower', 'TotalActivePower_kW']) || 0;
            let Q = pick(raw, ['ReactivePower_Total', 'Q_total', 'ReactivePower', 'TotalReactivePower_kvar']) || 0;
            let S = pick(raw, ['ApparentPower_Total', 'S_total', 'ApparentPower', 'TotalApparentPower_kVA']) || Math.sqrt(P * P + Q * Q);

            return {
                ...prev,
                EA_plus: ea != null ? ea : prev.EA_plus + (Math.max(P, 0) * dh),
                EA_minus: gen != null ? gen : prev.EA_minus + (Math.max(-P, 0) * dh),
                ER_plus: prev.ER_plus + (Math.max(Q, 0) * dh),
                ER_minus: prev.ER_minus + (Math.max(-Q, 0) * dh),
                ES: prev.ES + (S * dh),
                last_ts: now
            };
        });
    }, [readingsByDevice, selectedDevice]);

    const resetPartial = () => {
        setPartial({ ...energyState, ts: Date.now() });
    };

    const getPartialValue = (key) => {
        if (!partial) return energyState[key];
        return energyState[key] - partial[key];
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800">Energy Registers</h2>
                    <p className="text-sm text-slate-500 font-rajdhani uppercase tracking-widest opacity-60">High-precision accumulation & demand monitoring</p>
                </div>
                <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl shadow-sm">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >Summary</button>
                    <button
                        onClick={() => setActiveTab('tariff')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'tariff' ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >Tariff Matrix</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6">
                {/* Total Accumulation Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 shadow-sm p-4 sm:p-6 border-l-4 border-l-yellow-500 rounded-r-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Active Energy</div>
                                    <div className="text-xs text-slate-400 font-mono">NET_ACCUMULATION</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Duration</div>
                                <div className="text-xs font-mono text-slate-700">{fmtTime(Date.now() - energyState.start_ts)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">EA+ (Import)</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{energyState.EA_plus.toFixed(2)} <span className="text-[10px] text-yellow-600">kWh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">EA- (Export)</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{energyState.EA_minus.toFixed(2)} <span className="text-[10px] text-yellow-600">kWh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ER+ (Reactive)</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{energyState.ER_plus.toFixed(2)} <span className="text-[10px] text-orange-500">kvarh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ES (Apparent)</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{energyState.ES.toFixed(2)} <span className="text-[10px] text-purple-600">kVAh</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 shadow-sm p-6 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-transparent relative overflow-hidden rounded-r-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <RotateCcw size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Partial Measurement</div>
                                    <div className="text-xs text-slate-400 font-mono">DELTA_MEASURE</div>
                                </div>
                            </div>
                            <button
                                onClick={resetPartial}
                                className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >Reset Delta</button>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Δ EA+</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{getPartialValue('EA_plus').toFixed(2)} <span className="text-[10px] text-emerald-600">kWh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Δ EA-</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{getPartialValue('EA_minus').toFixed(2)} <span className="text-[10px] text-emerald-600">kWh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Δ ER+</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{getPartialValue('ER_plus').toFixed(2)} <span className="text-[10px] text-emerald-600">kvarh</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Δ ES</div>
                                <div className="text-2xl font-bold font-orbitron text-slate-800">{getPartialValue('ES').toFixed(2)} <span className="text-[10px] text-emerald-600">kVAh</span></div>
                            </div>
                        </div>

                        <div className="absolute bottom-2 right-4 text-[8px] text-slate-500 font-mono italic">
                            Since Last Reset: {partial ? fmtTime(Date.now() - partial.ts) : '--'}
                        </div>
                    </div>
                </div>

                {/* Matrix Table Section */}
                <div className="flex-1 min-h-0">
                    <div className="bg-white border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden rounded-xl">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TableIcon size={14} className="text-yellow-600" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Detailed Energy Matrix</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                <div className="flex items-center gap-1"><Zap size={10} /> Active</div>
                                <div className="flex items-center gap-1"><Activity size={10} /> Reactive</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-50 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-sm">
                                    <tr className="border-b border-slate-200">
                                        <th className="p-4 pl-6">ID</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4">Active+</th>
                                        <th className="p-4">Active-</th>
                                        <th className="p-4">React+</th>
                                        <th className="p-4">React-</th>
                                        <th className="p-4 pr-6">Apparent</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 pl-6 text-slate-400 group-hover:text-yellow-600 transition-colors">{i}</td>
                                            <td className="p-4 text-[11px] text-slate-500 font-rajdhani uppercase tracking-tight">Tariff Register {i}</td>
                                            <td className="p-4 text-xs text-slate-800">{(energyState.EA_plus / 8).toFixed(2)}</td>
                                            <td className="p-4 text-xs text-slate-800">{(energyState.EA_minus / 8).toFixed(2)}</td>
                                            <td className="p-4 text-xs text-slate-500">{(energyState.ER_plus / 8).toFixed(2)}</td>
                                            <td className="p-4 text-xs text-slate-500">{(energyState.ER_minus / 8).toFixed(2)}</td>
                                            <td className="p-4 pr-6 text-xs text-yellow-600">{(energyState.ES / 8).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnergyModule;
