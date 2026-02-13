import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
    AlertTriangle,
    Activity,
    ShieldAlert,
    CheckCircle,
    Clock,
    Search,
    Filter,
    ArrowRightCircle
} from 'lucide-react';
import { getApiBase } from 'services/api';

const AlarmModule = () => {
    const { selectedProject } = useApp();
    const [alarms, setAlarms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchAlarms = async () => {
            setIsLoading(true);
            try {
                const API = getApiBase();
                const url = selectedProject ? `${API}/alert/logs?project_id=${selectedProject}` : `${API}/alert/logs`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) throw new Error('Invalid JSON from /api/alert/logs');
                const data = await res.json();
                setAlarms(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch alarms:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlarms();
        const timer = setInterval(fetchAlarms, 10000);
        return () => clearInterval(timer);
    }, [selectedProject]);

    const filteredAlarms = alarms.filter(a => {
        const severityMatch = filterSeverity === 'all' || a.severity?.toLowerCase().includes(filterSeverity);
        const searchMatch = (a.device_name || a.device_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.rule_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        return severityMatch && searchMatch;
    });

    const stats = {
        total: alarms.length,
        critical: alarms.filter(a => a.severity?.toLowerCase().includes('crit')).length,
        warning: alarms.filter(a => a.severity?.toLowerCase().includes('warn')).length,
        normal: alarms.filter(a => !a.severity?.toLowerCase().includes('crit') && !a.severity?.toLowerCase().includes('warn')).length
    };

    const getSeverityBadge = (s) => {
        const sev = s?.toLowerCase() || '';
        if (sev.includes('crit')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-500 border border-red-500/30 uppercase tracking-tighter">Critical</span>;
        if (sev.includes('warn')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase tracking-tighter">Warning</span>;
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 uppercase tracking-tighter">Normal</span>;
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-white italic">Alarm Center</h2>
                    <p className="text-sm text-slate-400 font-rajdhani uppercase tracking-[0.2em] opacity-60">System Security & Real-time Alerts</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900/50 border border-white/5 rounded-lg px-4 py-2 flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active State</span>
                            <span className="text-xs font-mono text-cyan-400">{new Date().toLocaleTimeString()}</span>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Logs', value: stats.total, color: 'text-white', icon: Activity },
                    { label: 'Critical', value: stats.critical, color: 'text-red-500', icon: ShieldAlert },
                    { label: 'Warnings', value: stats.warning, color: 'text-amber-500', icon: AlertTriangle },
                    { label: 'Normal', value: stats.normal, color: 'text-emerald-500', icon: CheckCircle },
                ].map((s, i) => (
                    <div key={i} className="kpi-card p-4 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">{s.label}</div>
                            <div className={`text-2xl font-bold font-orbitron ${s.color}`}>{s.value}</div>
                        </div>
                        <s.icon className={`w-8 h-8 opacity-10 ${s.color}`} />
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Filters */}
                <div className="lg:col-span-1">
                    <div className="kpi-card p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-l-2 border-cyan-500 pl-2">Search & Filter</div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search logs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900 border-none rounded-lg pl-10 pr-4 py-3 text-sm text-slate-300 focus:ring-1 focus:ring-cyan-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold ml-1 tracking-widest">Severity Level</label>
                                <select
                                    value={filterSeverity}
                                    onChange={(e) => setFilterSeverity(e.target.value)}
                                    className="w-full bg-slate-900 border-none rounded-lg px-4 py-3 text-sm text-slate-300 focus:ring-1 focus:ring-cyan-500"
                                >
                                    <option value="all">All Severities</option>
                                    <option value="crit">Critical Only</option>
                                    <option value="warn">Warnings Only</option>
                                    <option value="info">Information Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 flex items-center justify-center gap-3 group"
                            >
                                <Clock className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Refresh Logs</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Alarm List */}
                <div className="lg:col-span-3 min-h-0 flex flex-col">
                    <div className="kpi-card flex flex-col h-full">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/10">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-500" />
                                <span className="text-xs font-bold font-orbitron uppercase text-slate-300">Live Alert Stream</span>
                            </div>
                            <div className="text-[10px] font-bold tracking-[0.3em] text-slate-600 uppercase">
                                Total Items: {filteredAlarms.length}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur z-10 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="py-4 px-6">Device</th>
                                        <th className="py-4 px-6">Event Type</th>
                                        <th className="py-4 px-6">Message</th>
                                        <th className="py-4 px-6">Severity</th>
                                        <th className="py-4 px-6">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="5" className="py-20 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Decrypting Logs...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAlarms.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-20 text-center text-slate-600 italic">No alerts found matching criteria.</td>
                                        </tr>
                                    ) : (
                                        filteredAlarms.map((a, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase font-rajdhani">{a.device_name || a.device_id}</span>
                                                        <span className="text-[8px] text-slate-600 font-mono">ID: {a.device_id}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="text-xs font-medium text-slate-300">{a.rule_name || 'System Event'}</span>
                                                </td>
                                                <td className="py-4 px-6 max-w-[300px]">
                                                    <p className="text-xs text-slate-500 group-hover:text-slate-400 truncate">{a.message || 'No additional data available'}</p>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {getSeverityBadge(a.severity)}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Clock className="w-3 h-3" />
                                                        <span className="text-[10px] font-mono whitespace-nowrap">{new Date(a.time).toLocaleString()}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlarmModule;
