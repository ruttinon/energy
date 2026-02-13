import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Filter, Bell } from 'lucide-react';
import { getApiBase } from 'services/api';

const MobileAlarms = () => {
    const { selectedProject, t } = useApp();
    const [alarms, setAlarms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const fetchAlarms = async () => {
            setLoading(true);
            try {
                const API = getApiBase();
                const url = selectedProject ? `${API}/alert/logs?project_id=${selectedProject}` : `${API}/alert/logs`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setAlarms(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAlarms();
        const timer = setInterval(fetchAlarms, 10000);
        return () => clearInterval(timer);
    }, [selectedProject]);

    const filteredAlarms = alarms.filter(a => {
        if (filter === 'critical') return a.severity?.toLowerCase().includes('crit');
        if (filter === 'warning') return a.severity?.toLowerCase().includes('warn');
        return true;
    });

    const getSeverityIcon = (severity) => {
        const s = severity?.toLowerCase() || '';
        if (s.includes('crit')) return <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />;
        if (s.includes('warn')) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    };

    const getSeverityStyles = (severity) => {
        const s = severity?.toLowerCase() || '';
        if (s.includes('crit')) return 'border-red-200 bg-red-50 hover:border-red-300 hover:shadow-sm';
        if (s.includes('warn')) return 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:shadow-sm';
        return 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:shadow-sm';
    };

    return (
        <div className="relative z-10 p-5 space-y-6 pb-24">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-700 bg-clip-text text-transparent">
                        {t('notifications')}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-[0.2em]">
                        {t('system_alerts_logs')}
                    </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/10">
                    <Bell className="w-5 h-5 text-red-500" />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {['all', 'critical', 'warning'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
                            filter === f 
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t(f)}
                    </button>
                ))}
            </div>

            {/* Alarm List */}
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide pr-1">
                {filteredAlarms.map((alarm, idx) => (
                    <div 
                        key={idx}
                        className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${getSeverityStyles(alarm.severity)}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        {/* Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="mt-1 p-2 rounded-full bg-white border border-slate-100 shadow-sm">
                                {getSeverityIcon(alarm.severity)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-slate-800 text-sm truncate font-rajdhani tracking-wide">
                                        {alarm.device_name || alarm.device_id || 'SYSTEM'}
                                    </h3>
                                    <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap bg-white/50 px-2 py-0.5 rounded-full border border-slate-200">
                                        {new Date(alarm.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {alarm.message}
                                </p>
                                
                                <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-200/50 pt-2">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(alarm.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    {alarm.rule_name && (
                                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                                            {alarm.rule_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredAlarms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <CheckCircle className="w-12 h-12 mb-4 opacity-20 text-emerald-500" />
                        <p className="text-sm font-rajdhani">{t('no_alarms_found')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileAlarms;
