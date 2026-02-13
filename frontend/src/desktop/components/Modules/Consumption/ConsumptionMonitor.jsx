import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
    Zap,
    BarChart,
    RefreshCw,
    Clock,
    ChevronRight,
    Database
} from 'lucide-react';

const ConsumptionMonitor = () => {
    const { selectedProject, selectedDevice } = useApp();
    const [currentType, setCurrentType] = useState('Ea_plus'); // Ea_plus, Er_plus, Es
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const KEY_MAP = {
        "Ea_plus": ["ActiveEnergy_kWh", "Consumed_kWh", "ActiveEnergy_Import", "Energy", "kWh"],
        "Er_plus": ["Generated_kWh", "ActiveEnergy_Export", "Energy_Export"],
        "Es": ["ActivePower_Total", "Power", "kW"]
    };

    const UNIT_MAP = {
        "Ea_plus": "kWh",
        "Er_plus": "kWh",
        "Es": "kW"
    };

    const fetchHistory = async () => {
        if (!selectedProject || !selectedDevice) return;
        setIsLoading(true);
        try {
            const targetKey = KEY_MAP[currentType][0];
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

            const pad = (n) => String(n).padStart(2, '0');
            const fmt = (d) => {
                const y = d.getFullYear();
                const m = pad(d.getMonth() + 1);
                const dy = pad(d.getDate());
                const hh = pad(d.getHours());
                const mm = pad(d.getMinutes());
                const ss = pad(d.getSeconds());
                return `${y}-${m}-${dy} ${hh}:${mm}:${ss}`;
            };

            const url = `/api/history?project_id=${selectedProject}&device=${selectedDevice}&key=${targetKey}&start=${fmt(start)}&end=${fmt(end)}`;

            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                setHistory(json.history || []);
            }
        } catch (err) {
            console.error('Consumption fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 30000);
        return () => clearInterval(interval);
    }, [selectedProject, selectedDevice, currentType]);

    const stats = useMemo(() => {
        const values = history.map(d => Number(d.value));
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / (values.length || 1);
        return { sum, avg };
    }, [history]);

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800">Consumption Index</h2>
                    <p className="text-sm text-slate-500 font-rajdhani uppercase tracking-widest opacity-80">Energy accumulation & interval analysis</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {[
                        { id: 'Ea_plus', label: 'Ea+' },
                        { id: 'Er_plus', label: 'Er+' },
                        { id: 'Es', label: 'Es' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setCurrentType(t.id)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all tracking-widest ${currentType === t.id ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Database size={48} className="text-yellow-500" />
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Accumulated</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-orbitron font-bold text-slate-800">{stats.sum.toFixed(1)}</span>
                        <span className="text-xs font-bold text-yellow-600 mb-2">{UNIT_MAP[currentType]}</span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart size={48} className="text-yellow-500" />
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Average Rate</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-orbitron font-bold text-slate-800">{stats.avg.toFixed(2)}</span>
                        <span className="text-xs font-bold text-yellow-600 mb-2">{UNIT_MAP[currentType]}</span>
                    </div>
                </div>
            </div>

            {/* Chart Area (Placeholder) */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative min-h-[200px] flex items-center justify-center">
                <div className="text-center">
                     <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <BarChart className="text-slate-300" size={24} />
                     </div>
                     <p className="text-slate-400 font-medium text-sm">Visual Analytics Component</p>
                     <p className="text-slate-300 text-xs mt-1">Rendering consumption data stream...</p>
                </div>
            </div>
        </div>
    );
};

export default ConsumptionMonitor;
