import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Line } from 'react-chartjs-2';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend, 
    TimeScale, 
    Filler 
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { TrendingUp, Calendar, RefreshCw, Zap, Activity } from 'lucide-react';
import { getApiBase } from 'services/api';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

const MobileTrends = () => {
    const { devices = [], selectedProject } = useApp();
    const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || '');
    const [parameter, setParameter] = useState('ActivePower_Total');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (devices.length > 0 && !selectedDevice) {
            setSelectedDevice(devices[0].id);
        }
    }, [devices]);

    const fetchData = async () => {
        if (!selectedDevice || !selectedProject) return;
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
            const API = getApiBase();
            const url = `${API}/history?project_id=${selectedProject}&device=${selectedDevice}&key=${parameter}&start=${fmt(start)}&end=${fmt(end)}`;
            
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                setData(json.history || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDevice, parameter, selectedProject]);

    const chartData = {
        datasets: [
            {
                label: parameter,
                data: data.map(d => ({ x: new Date(d.timestamp), y: Number(d.value) })),
                borderColor: '#D4AF37', // Gold
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
                    gradient.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
                    return gradient;
                },
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: 'rgba(212, 175, 55, 0.2)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                titleFont: { family: 'Rajdhani', size: 14 },
                bodyFont: { family: 'JetBrains Mono', size: 12 },
                callbacks: {
                    label: (context) => `${context.parsed.y.toFixed(2)}`
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
                grid: { display: false },
                ticks: { color: '#64748b', font: { family: 'Rajdhani', size: 10 }, maxRotation: 0 }
            },
            y: {
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
                border: { display: false }
            }
        }
    };

    return (
        <div className="relative z-10 p-5 space-y-6 pb-24">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 to-yellow-500 bg-clip-text text-transparent">
                        TRENDS
                    </h2>
                    <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-[0.2em]">
                        24H Performance Analysis
                    </p>
                </div>
                <button 
                    onClick={fetchData} 
                    className={`w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-yellow-600 hover:bg-slate-50 transition-all shadow-sm ${loading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <select 
                        value={selectedDevice} 
                        onChange={e => setSelectedDevice(e.target.value)}
                        className="w-full bg-white backdrop-blur-md border border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-800 focus:outline-none focus:border-yellow-500/50 font-rajdhani appearance-none shadow-sm"
                    >
                        {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Activity size={14} className="text-slate-400" />
                    </div>
                </div>
                
                <div className="relative">
                    <select 
                        value={parameter} 
                        onChange={e => setParameter(e.target.value)}
                        className="w-full bg-white backdrop-blur-md border border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-800 focus:outline-none focus:border-yellow-500/50 font-rajdhani appearance-none shadow-sm"
                    >
                        <option value="ActivePower_Total">Active Power (kW)</option>
                        <option value="ActiveEnergy_Import">Energy (kWh)</option>
                        <option value="Voltage_L1">Voltage L1 (V)</option>
                        <option value="Current_L1">Current L1 (A)</option>
                        <option value="Frequency">Frequency (Hz)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Zap size={14} className="text-slate-400" />
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="flex-1 glass-card rounded-2xl p-4 relative min-h-[300px] overflow-hidden group">
                 {/* Scanner Effect */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent animate-scan opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {data.length > 0 ? (
                    <div className="h-full w-full">
                         <Line data={chartData} options={options} />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        {loading ? (
                            <>
                                <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-2" />
                                <span className="text-xs font-rajdhani tracking-wider">LOADING DATA...</span>
                            </>
                        ) : (
                            <>
                                <Activity size={32} className="mb-2 opacity-20" />
                                <span className="text-xs font-rajdhani tracking-wider">NO DATA AVAILABLE</span>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 rounded-xl text-center group hover:border-yellow-500/20 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 group-hover:text-yellow-600 transition-colors">Min</div>
                    <div className="text-sm font-bold font-mono text-slate-800">
                        {data.length ? Math.min(...data.map(d => Number(d.value))).toFixed(1) : '-'}
                    </div>
                </div>
                <div className="glass-card p-3 rounded-xl text-center group hover:border-yellow-500/20 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 group-hover:text-yellow-600 transition-colors">Avg</div>
                    <div className="text-sm font-bold font-mono text-slate-800">
                        {data.length ? (data.reduce((a, b) => a + Number(b.value), 0) / data.length).toFixed(1) : '-'}
                    </div>
                </div>
                <div className="glass-card p-3 rounded-xl text-center group hover:border-yellow-500/20 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 group-hover:text-yellow-600 transition-colors">Max</div>
                    <div className="text-sm font-bold font-mono text-slate-800">
                        {data.length ? Math.max(...data.map(d => Number(d.value))).toFixed(1) : '-'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileTrends;
