import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Zap, Calendar, ArrowUpRight, BarChart3 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';

const MobileConsumption = () => {
    const { selectedProject, devices = [] } = useApp();
    const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || '');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (devices.length > 0 && !selectedDevice) setSelectedDevice(devices[0].id);
    }, [devices]);

    const fetchHistory = async () => {
        if (!selectedProject || !selectedDevice) return;
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Last 24h
            const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
            
            const url = `/api/history?project_id=${selectedProject}&device=${selectedDevice}&key=ActiveEnergy_Import&start=${fmt(start)}&end=${fmt(end)}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                setHistory(json.history || []);
            }
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchHistory(); }, [selectedDevice, selectedProject]);

    const stats = useMemo(() => {
        if (!history.length) return { total: 0, avg: 0 };
        const values = history.map(d => Number(d.value));
        const first = values[0];
        const last = values[values.length - 1];
        const consumption = last - first;
        return { 
            total: consumption > 0 ? consumption : 0,
            last: last
        };
    }, [history]);

    const chartData = {
        labels: history.map(d => new Date(d.timestamp).getHours() + ':00'),
        datasets: [{
            label: 'kWh',
            data: history.map(d => Number(d.value)),
            backgroundColor: '#ca8a04', // Yellow-600
            borderRadius: 4,
            hoverBackgroundColor: '#eab308' // Yellow-500
        }]
    };

    return (
        <div className="relative z-10 p-5 space-y-6 pb-24">
             {/* Header */}
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-700 bg-clip-text text-transparent">
                        CONSUMPTION
                    </h2>
                    <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-[0.2em]">
                        Energy Usage Analytics
                    </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-yellow-500/20 flex items-center justify-center shadow-lg shadow-yellow-500/10">
                    <BarChart3 className="w-5 h-5 text-yellow-600" />
                </div>
            </div>
            
            <div className="relative">
                <select 
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full bg-white backdrop-blur-md border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-yellow-500/50 font-rajdhani appearance-none shadow-sm"
                >
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Zap size={14} className="text-yellow-600" />
                </div>
            </div>

            {/* Main Stat Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-3xl p-8 flex flex-col items-center justify-center gap-2 shadow-xl shadow-yellow-500/20 group">
                {/* Background Effects */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.2)_0%,transparent_50%)] animate-pulse-fast" />
                <div className="absolute inset-0 bg-[url('/img/grid.svg')] opacity-20 bg-center" />
                
                <span className="relative z-10 text-yellow-100 uppercase tracking-[0.3em] text-[10px] font-bold">Total Consumption (24h)</span>
                <span className="relative z-10 text-6xl font-bold font-rajdhani text-white drop-shadow-md">
                    {stats.total.toFixed(1)}
                    <span className="text-xl text-yellow-200 ml-2 font-medium">kWh</span>
                </span>
                
                <div className="relative z-10 mt-2 px-3 py-1 rounded-full bg-white/20 border border-white/20 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] text-yellow-50 uppercase tracking-wider">Recording Live Data</span>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-[250px] bg-white border border-slate-200 rounded-2xl p-4 relative shadow-sm">
                {history.length > 0 ? (
                    <Bar 
                        data={chartData} 
                        options={{
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { display: false },
                                y: { display: false } // Sparkline style
                            }
                        }} 
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <BarChart3 size={32} className="opacity-20" />
                        )}
                        <span className="text-xs font-rajdhani tracking-wider uppercase">
                            {loading ? 'Loading...' : 'No Data Available'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileConsumption;
