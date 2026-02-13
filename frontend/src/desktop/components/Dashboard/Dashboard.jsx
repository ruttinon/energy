import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { getApiBase } from 'services/api';
import {
    Activity,
    BarChart,
    Wifi,
    WifiOff,
    TrendingUp,
    DollarSign,
    Zap,
    Cpu,
    Globe,
    Clock,
    ArrowUpRight
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function Dashboard() {
    const { devices, readings, billingSummary, selectedConverter, readingsByDevice = {}, deviceStatus } = useApp();
    const [isLandscape, setIsLandscape] = useState(window.innerHeight < window.innerWidth);

    useEffect(() => {
        const handleOrientationChange = () => {
            setIsLandscape(window.innerHeight < window.innerWidth);
        };
        window.addEventListener('orientationchange', handleOrientationChange);
        window.addEventListener('resize', handleOrientationChange);
        return () => {
            window.removeEventListener('orientationchange', handleOrientationChange);
            window.removeEventListener('resize', handleOrientationChange);
        };
    }, []);
    
    console.log('[Dashboard] Context:', { devices, selectedConverter, readingsByDevice, billingSummary });

    const filteredDevices = useMemo(() => {
        if (!devices) return [];
        if (!selectedConverter) return devices;
        return devices.filter(d => String(d.converter) === selectedConverter);
    }, [devices, selectedConverter]);
    console.log('[Dashboard] filteredDevices:', filteredDevices);

    // Online/Offline Logic (Real-Time from Backend)
    const dashboardStats = useMemo(() => {
        let online = 0;
        const statusMap = {};

        filteredDevices.forEach(d => {
            // Check real status from backend (default to offline if missing)
            const isOnline = deviceStatus[d.id] === 'online';

            // Find latest timestamp for this device
            const deviceReading = readings.find(r => String(r.device_id) === String(d.id));
            const lastTs = deviceReading?.timestamp || '--:--';

            if (isOnline) online++;

            statusMap[d.id] = {
                isOnline,
                lastTs,
                isPartial: false
            };
        });

        return { online, offline: filteredDevices.length - online, statusMap };
    }, [filteredDevices, deviceStatus, readings]);

    // History Logic
    const [historyData, setHistoryData] = React.useState([]);

    React.useEffect(() => {
        // Fetch 7-day history
        const API = getApiBase();
        const origin = API.replace(/\/api$/, '');
        fetch(`${origin}/api/billing/history`)
            .then(res => res.json())
            .then(res => {
                if (res.status === 'ok') {
                    setHistoryData(res.data);
                }
            })
            .catch(err => console.error("Failed to fetch history:", err));
    }, []);

    const chartData = React.useMemo(() => {
        // Default to last 7 days placeholder if empty
        if (!historyData || historyData.length === 0) {
            return {
                labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
                datasets: [
                    {
                        label: 'Cost (THB)',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(234, 179, 8, 0.5)', // yellow-500
                        borderColor: '#eab308',
                        borderWidth: 2,
                        borderRadius: 8,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Energy (kWh)',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(6, 182, 212, 0.5)', // cyan-500
                        borderColor: '#06b6d4',
                        borderWidth: 2,
                        borderRadius: 8,
                        yAxisID: 'y1',
                    }
                ]
            };
        }

        // Process Data
        // Format: "2026-01-09" -> "09 Jan 2026"
        const labels = historyData.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        });

        const costData = historyData.map(d => d.total_cost);
        const energyData = historyData.map(d => d.total_energy);

        return {
            labels,
            datasets: [
                {
                    label: 'Cost (THB)',
                    data: costData,
                    backgroundColor: 'rgba(234, 179, 8, 0.5)',
                    borderColor: '#eab308',
                    borderWidth: 2,
                    borderRadius: 8,
                    yAxisID: 'y',
                },
                {
                    label: 'Energy (kWh)',
                    data: energyData,
                    backgroundColor: 'rgba(6, 182, 212, 0.5)',
                    borderColor: '#06b6d4',
                    borderWidth: 2,
                    borderRadius: 8,
                    yAxisID: 'y1',
                },
            ],
        };
    }, [historyData]);

    const chartOptions = {
        responsive: true,
        animation: false,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 10, family: 'Rajdhani', weight: 'bold' } }
            },
            y: {
                type: 'linear', position: 'left',
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#ca8a04', font: { size: 10, family: 'Rajdhani' }, callback: v => '฿' + v },
            },
            y1: {
                type: 'linear', position: 'right',
                grid: { display: false },
                ticks: { color: '#0891b2', font: { size: 10, family: 'Rajdhani' }, callback: v => v + ' kWh' },
            },
        },
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: { color: '#64748b', boxWidth: 8, usePointStyle: true, font: { size: 10, family: 'Rajdhani' } }
            },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#1e293b',
                bodyColor: '#334155',
                titleFont: { family: 'Orbitron' },
                bodyFont: { family: 'Rajdhani' },
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                boxPadding: 4
            }
        }
    };

    return (
        <div className="min-h-full bg-slate-50 p-6 md:p-8 font-rajdhani">
            <div className="max-w-[1920px] mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 text-white">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-orbitron">ENERGY INTELLIGENCE</h1>
                            <div className="text-sm text-slate-500 font-medium tracking-wide">AI-POWERED FLEET MONITORING</div>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-bold text-slate-600">
                        {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                </div>

                {/* KPI Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

                    {/* Live Load */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={18} className="text-yellow-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LIVE LOAD</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 font-orbitron">
                            142.8 <span className="text-sm text-slate-400 font-rajdhani">kW</span>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs font-bold text-emerald-600">
                            <TrendingUp size={12} /> +12.5% vs Prev
                        </div>
                    </div>

                    {/* MTD Cost */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign size={18} className="text-yellow-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">MTD COST</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 font-orbitron">
                            {(billingSummary?.month_money || 0).toLocaleString()} <span className="text-sm text-slate-400 font-rajdhani">THB</span>
                        </div>
                        <div className="text-xs font-medium text-slate-400 mt-2">
                            Current Period
                        </div>
                    </div>

                    {/* Network Nodes */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <Wifi size={18} className="text-yellow-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">NETWORK NODES</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 font-orbitron">
                            {dashboardStats.online} <span className="text-sm text-slate-400 font-rajdhani">/ {devices.length}</span>
                        </div>
                        <div className={`text-xs font-bold mt-2 ${dashboardStats.online === devices.length ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {((dashboardStats.online / devices.length) * 100).toFixed(0)}% Online
                        </div>
                    </div>

                    {/* Connectivity */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <Globe size={18} className="text-yellow-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CONNECTIVITY</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 font-orbitron">
                            99.8 <span className="text-sm text-slate-400 font-rajdhani">%</span>
                        </div>
                        <div className="text-xs font-medium text-slate-400 mt-2">
                            Global Uptime 24H
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Load Pattern Analysis Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <BarChart size={18} className="text-yellow-500" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LOAD PATTERN ANALYSIS</span>
                            </div>
                            <button className="text-[10px] font-bold text-slate-400 hover:text-yellow-600 transition-colors uppercase tracking-wider border border-slate-200 hover:border-yellow-500 px-3 py-1 rounded-lg">VIEW DETAILS</button>
                        </div>
                        <div className="h-[300px] w-full">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Live Asset Matrix */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-yellow-500" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LIVE ASSET MATRIX</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <div className="grid grid-cols-[40%_30%_30%] bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                                <div className="p-3 pl-6">NODE</div>
                                <div className="p-3">TELEMETRY</div>
                                <div className="p-3 pr-6 text-right">STATUS</div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {filteredDevices.map(d => {
                                    const status = dashboardStats.statusMap[d.id] || { isOnline: false };
                                    return (
                                        <div key={d.id} className="grid grid-cols-[40%_30%_30%] hover:bg-slate-50 transition-colors group">
                                            <div className="p-3 pl-6">
                                                <div className="font-bold text-slate-700 group-hover:text-yellow-600 transition-colors text-xs">{d.name}</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{d.converter}</div>
                                            </div>
                                            <div className="p-3 flex items-center">
                                                <span className="text-[9px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 tracking-wider">SYNC</span>
                                            </div>
                                            <div className="p-3 pr-6 text-right flex items-center justify-end">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ${status.isOnline ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                                    {status.isOnline ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
