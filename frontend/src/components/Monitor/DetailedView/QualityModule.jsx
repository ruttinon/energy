import React, { useState, useEffect, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { useApp } from '../../../context/AppContext';
import {
    Zap,
    AlertTriangle,
    CheckCircle2,
    Activity,
    Table as TableIcon,
    BarChart2
} from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const QualityModule = () => {
    const { selectedDevice, readingsByDevice } = useApp();
    const [activeTab, setActiveTab] = useState('thdi'); // thdi, thdu, thdv, tdd, kfactor, crest

    const data = useMemo(() => {
        if (!selectedDevice || !readingsByDevice[selectedDevice]) return null;
        return readingsByDevice[selectedDevice];
    }, [selectedDevice, readingsByDevice]);

    const tabs = [
        { id: 'thdi', label: 'THDi', keys: ['THD_Current_L1', 'THD_Current_L2', 'THD_Current_L3'], labels: ['L1', 'L2', 'L3'], unit: '%', warn: 10, crit: 15 },
        { id: 'thdu', label: 'THDu', keys: ['THD_Voltage_L1L2', 'THD_Voltage_L2L3', 'THD_Voltage_L3L1'], labels: ['U12', 'U23', 'U31'], unit: '%', warn: 3, crit: 5 },
        { id: 'thdv', label: 'THDv', keys: ['THD_Voltage_L1', 'THD_Voltage_L2', 'THD_Voltage_L3'], labels: ['V1', 'V2', 'V3'], unit: '%', warn: 3, crit: 5 },
        { id: 'tdd', label: 'TDD', keys: ['TDD_L1', 'TDD_L2', 'TDD_L3'], labels: ['L1', 'L2', 'L3'], unit: '%', warn: 5, crit: 8 },
        { id: 'kfactor', label: 'K-Factor', keys: ['KFactor_L1', 'KFactor_L2', 'KFactor_L3'], labels: ['L1', 'L2', 'L3'], unit: '', warn: 4, crit: 9 },
        { id: 'crest', label: 'Crest', keys: ['Crest_L1', 'Crest_L2', 'Crest_L3'], labels: ['V1', 'V2', 'V3'], unit: '', warn: 1.5, crit: 1.8 },
    ];

    const activeConfig = tabs.find(t => t.id === activeTab);

    const getValues = () => {
        if (!data) return activeConfig.labels.map(() => 0);
        return activeConfig.keys.map(k => Number(data[k]) || 0);
    };

    const chartData = {
        labels: activeConfig.labels,
        datasets: [{
            label: activeConfig.label,
            data: getValues(),
            backgroundColor: getValues().map(v =>
                v > activeConfig.crit ? 'rgba(239, 68, 68, 0.6)' :
                    v > activeConfig.warn ? 'rgba(245, 158, 11, 0.6)' :
                        'rgba(234, 179, 8, 0.6)'
            ),
            borderColor: getValues().map(v =>
                v > activeConfig.crit ? '#ef4444' :
                    v > activeConfig.warn ? '#f59e0b' :
                        '#ca8a04'
            ),
            borderWidth: 2,
            borderRadius: 12,
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#64748b', font: { size: 10 } }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#475569', font: { size: 11, weight: 'bold' } }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                titleFont: { family: 'Orbitron' },
                bodyFont: { family: 'Rajdhani' },
                borderColor: '#e2e8f0',
                borderWidth: 1,
                boxPadding: 4
            }
        }
    };

    return (
        <div className="module-3d flex flex-col h-full gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800">Power Quality</h2>
                    <p className="text-sm text-slate-500 font-rajdhani uppercase tracking-widest opacity-60">Harmonic distortion & wave stability analysis</p>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${activeTab === t.id ? 'bg-yellow-500 border-yellow-500 text-white shadow-lg' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6 flex-1">
                        <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest border-l-2 border-yellow-500 pl-2">Security Status</div>
                        <div className="space-y-4">
                            {activeConfig.labels.map((lbl, i) => {
                                const val = getValues()[i];
                                const isCrit = val > activeConfig.crit;
                                const isWarn = val > activeConfig.warn;
                                return (
                                    <div key={lbl} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase">{lbl} Intensity</div>
                                            <div className="text-xl font-bold font-orbitron text-slate-800">{val.toFixed(3)}<span className="text-[10px] ml-1 text-slate-500">{activeConfig.unit}</span></div>
                                        </div>
                                        <div className={`p-2 rounded-lg ${isCrit ? 'bg-red-500/10 text-red-500' : isWarn ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                            {isCrit ? <AlertTriangle size={20} /> : isWarn ? <Activity size={20} /> : <CheckCircle2 size={20} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-slate-200">
                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-4">Calibration Info</div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500">Sampling Rate</span>
                                    <span className="text-yellow-600 font-mono">25.6 kHz</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500">DFT Resolution</span>
                                    <span className="text-yellow-600 font-mono">1.25 Hz</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 sm:p-6 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-yellow-600" />
                                <span className="text-xs font-bold font-orbitron uppercase text-slate-800">Spectral Analysis: {activeConfig.label}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded bg-yellow-500" />
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Optimal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded bg-amber-500" />
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Warning</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded bg-red-500" />
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Critical</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                        <div className="flex items-center gap-4 text-xs text-slate-500 italic">
                            <Zap size={14} className="text-amber-500" />
                            <p>Harmonic distortion analysis is based on IEEE 519-2014 standards. Crest factor for pure sine wave is 1.414. High K-Factor indicates presence of non-linear loads requiring derating of magnetic components.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityModule;
