import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import {
    ShieldAlert, Activity, Terminal, Lock,
    Cpu, Database, Wifi, Power,
    Play, RefreshCw, Trash2,
    Server, Zap, BarChart3, Globe
} from 'lucide-react';
import AlertConfiguration from './AlertConfiguration';

const MissionControl = () => {
    const { showAlert } = useDialog();
    const { selectedProject } = useApp();
    const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, rules, logs
    const [logs, setLogs] = useState([]);
    const [systemStatus, setSystemStatus] = useState({
        backend: 'online',
        database: 'online',
        poller: 'active'
    });

    // Mock Logs Fetcher
    useEffect(() => {
        if (activeTab === 'logs' || activeTab === 'dashboard') {
            const interval = setInterval(() => {
                const msg = `Service heartbeat: Polling cycle completed for ${selectedProject || 'SYSTEM'}`;
                const newLog = {
                    id: Date.now(),
                    ts: new Date().toLocaleTimeString(),
                    level: Math.random() > 0.8 ? 'WARN' : 'INFO',
                    msg: msg,
                    count: 1
                };

                setLogs(prev => {
                    const latest = prev[0];
                    if (latest && latest.msg === newLog.msg) {
                        const updated = { ...latest, count: latest.count + 1, ts: newLog.ts };
                        return [updated, ...prev.slice(1)];
                    }
                    return [newLog, ...prev].slice(0, 50);
                });
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, selectedProject]);

    // Render Helpers
    const TabBtn = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                group flex items-center gap-3 px-6 py-4 rounded-t-lg transition-all border-b-2 relative overflow-hidden
                ${activeTab === id
                    ? 'border-yellow-500 text-yellow-600 bg-yellow-50'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}
            `}
        >
            <Icon size={18} className={activeTab === id ? 'animate-pulse' : ''} />
            <span className="text-xs font-bold uppercase tracking-widest relative z-10 font-orbitron">{label}</span>
        </button>
    );

    const StatusCard = ({ icon: Icon, label, status, subtext, color }) => {
        const colors = {
            emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            blue: 'text-blue-600 bg-blue-50 border-blue-100',
            amber: 'text-yellow-600 bg-yellow-50 border-yellow-100',
            purple: 'text-purple-600 bg-purple-50 border-purple-100',
        };
        const activeColor = colors[color] || colors.emerald;
        
        return (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 relative overflow-hidden group hover:border-slate-300 transition-all shadow-sm hover:shadow-md">
                <div className={`absolute -right-6 -top-6 p-4 opacity-[0.05] group-hover:opacity-10 transition-all duration-500 text-slate-800 transform group-hover:scale-110 rotate-12`}>
                    <Icon size={120} />
                </div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className={`p-3 rounded-xl ${activeColor}`}>
                        <Icon size={24} />
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border bg-white/80 backdrop-blur-sm ${status === 'online' || status === 'active' ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-600'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' || status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {status}
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="text-2xl font-bold font-orbitron text-slate-800 mb-1 tracking-tight">{label}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">{subtext}</div>
                </div>

                {/* Decorative glow */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-${color}-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            {/* Header */}
            <div className="px-8 pt-8 pb-0 flex flex-col md:flex-row justify-between items-end border-b border-slate-200 bg-white/80 backdrop-blur-md z-20 shrink-0">
                <div className="mb-6 md:mb-0">
                    <h1 className="text-4xl font-bold font-orbitron text-slate-800 mb-2 flex items-center gap-4">
                        <div className="p-2 rounded bg-yellow-500 text-white shadow-lg shadow-yellow-500/20">
                            <ShieldAlert size={32} />
                        </div>
                        MISSION CONTROL
                    </h1>
                    <p className="text-xs text-slate-500 font-rajdhani uppercase tracking-[0.4em] pl-1 font-bold">
                        Centralized Command & Telemetry Center
                    </p>
                </div>

                <div className="flex gap-1 overflow-x-auto max-w-full">
                    <TabBtn id="dashboard" icon={BarChart3} label="Overview" />
                    <TabBtn id="rules" icon={Lock} label="Security Check" />
                    <TabBtn id="logs" icon={Terminal} label="Live Feed" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide relative z-10">

                {/* DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                    <div className="flex flex-col gap-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Status Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatusCard icon={Cpu} label="Backend Core" status={systemStatus.backend} subtext="Uvicorn Worker [PID 2304]" color="emerald" />
                            <StatusCard icon={Database} label="Data Store" status={systemStatus.database} subtext="SQLite Wal Mode" color="blue" />
                            <StatusCard icon={Wifi} label="Poller Engine" status={systemStatus.poller} subtext="Interval: 1000ms" color="amber" />
                            <StatusCard icon={Globe} label="API Gateway" status="online" subtext="Port 5000 Active" color="purple" />
                        </div>

                        {/* Logs and Actions Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Recent Activity */}
                            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col h-[500px] shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
                                    <h3 className="text-sm font-bold text-slate-700 font-orbitron uppercase tracking-widest flex items-center gap-3">
                                        <Activity size={16} className="text-yellow-500" /> Recent System Events
                                    </h3>
                                    <button className="text-[10px] bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-full text-yellow-600 font-bold tracking-wider transition-all border border-slate-200" onClick={() => setActiveTab('logs')}>
                                        VIEW FULL LOGS
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2 pr-2 relative z-10">
                                    {logs.map((l, idx) => (
                                        <div key={l.id || idx} className="flex gap-4 text-slate-500 bg-slate-50 hover:bg-slate-100 px-4 py-3 rounded-xl border border-slate-100 transition-all group items-center">
                                            <div className="text-slate-400 text-[10px] font-mono shrink-0 py-1 px-2 rounded bg-white border border-slate-200">{l.ts}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${l.level === 'WARN' ? 'text-yellow-600' : 'text-blue-600'}`}>{l.level}</span>
                                                    {l.count > 1 && (
                                                        <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 rounded-[4px] text-[9px] font-bold">
                                                            x{l.count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-600 truncate font-mono opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {l.msg}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions Panel */}
                            <div className="lg:col-span-1 flex flex-col gap-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-slate-800 rotate-12 transform scale-150 pointer-events-none">
                                        <Zap size={100} />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-700 font-orbitron uppercase tracking-widest mb-6 flex items-center gap-3">
                                        <Power size={16} className="text-red-500" /> Critical Actions
                                    </h3>
                                    <div className="flex gap-2">
                            <button onClick={() => showAlert("Info", "Restarting Services...")} className="w-full py-4 bg-slate-50 border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-slate-500 text-xs font-bold uppercase transition-all flex items-center justify-center gap-3 group/btn shadow-sm">
                                <RefreshCw size={16} className="group-hover/btn:rotate-180 transition-transform duration-500" /> Restart Services
                            </button>
                                        <button onClick={() => setLogs([])} className="w-full py-4 bg-slate-50 border border-yellow-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700 text-slate-500 text-xs font-bold uppercase transition-all flex items-center justify-center gap-3 shadow-sm">
                                            <Trash2 size={16} /> Purge Logs
                                        </button>
                                    </div>

                                    <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
                                        <div className="flex items-start gap-3">
                                            <Server size={16} className="text-blue-500 mt-0.5" />
                                            <div>
                                                <div className="text-xs font-bold text-blue-600 mb-1">System Load Normal</div>
                                                <div className="text-[10px] text-slate-500 leading-relaxed">
                                                    All services operating within nominal parameters. 24h uptime achieved.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* RULES VIEW */}
                {activeTab === 'rules' && (
                    <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <AlertConfiguration />
                    </div>
                )}

                {/* LOGS VIEW */}
                {activeTab === 'logs' && (
                    <div className="h-full bg-white rounded-2xl border border-slate-200 p-1 flex flex-col shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-50 px-4 py-3 rounded-t-xl border-b border-slate-200 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                                </div>
                                <span className="font-bold font-mono text-xs ml-2 tracking-wider opacity-80">root@energylink:~/telemetry# tail -f stream.log</span>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1.5 bg-white hover:bg-slate-100 rounded-lg text-[10px] text-slate-500 font-mono transition-colors border border-slate-200">PAUSE</button>
                                <button className="px-3 py-1.5 bg-yellow-500 text-white font-bold rounded-lg text-[10px] hover:bg-yellow-600 transition-colors shadow-md shadow-yellow-500/20">EXPORT LOGS</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-1 font-mono text-xs bg-slate-50 rounded-b-xl border-t border-slate-100">
                            {logs.map(l => (
                                <div key={l.id} className="grid grid-cols-[100px_60px_1fr] gap-4 hover:bg-white py-1 px-2 rounded cursor-default transition-colors group border border-transparent hover:border-slate-200">
                                    <span className="text-slate-500 group-hover:text-slate-700">{l.ts}</span>
                                    <span className={`${l.level === 'WARN' ? 'text-yellow-600' : 'text-blue-600 font-bold'}`}>{l.level}</span>
                                    <span className="text-slate-600 group-hover:text-slate-800 break-all flex items-center gap-2">
                                        <span className="text-slate-400 opacity-50 select-none mr-2">{'>'}</span>
                                        {l.msg}
                                        {l.count > 1 && <span className="text-white bg-yellow-500 px-1 rounded-[2px] text-[10px] font-bold">x{l.count}</span>}
                                    </span>
                                </div>
                            ))}
                            {/* Mock historic logs filler */}
                            {Array.from({ length: 15 }).map((_, i) => (
                                <div key={i} className="grid grid-cols-[100px_60px_1fr] gap-4 opacity-30 blur-[0.5px] select-none scale-[0.99] origin-left">
                                    <span className="text-slate-400">--:--:--</span>
                                    <span className="text-slate-400">------</span>
                                    <span className="text-slate-400"> System initialization sequence...</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MissionControl;
