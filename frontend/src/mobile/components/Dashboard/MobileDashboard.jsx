import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { getApiBase, api } from 'services/api';
import { Zap, Activity, AlertTriangle, TrendingUp, TrendingDown, ChevronRight, Server, Wifi, Bell, MapPin, CalendarDays, Wallet, History, Wrench, Settings, Cpu, BarChart3, Loader2 } from 'lucide-react';
import LoadPatternChart from './LoadPatternChart';

const MobileDashboard = () => {
    const { devices = [], readings = [], readingsByDevice = {}, billingSummary = {}, deviceStatus = {}, projectName, selectedProject, t, setActivePanel } = useApp();
    const [pendingInvoice, setPendingInvoice] = useState(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);

    const [tariffRate, setTariffRate] = useState(5.0);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedProject) return;
            try {
                const config = await api.billing.getConfig(selectedProject);
                if (config && config.price_per_unit) {
                    setTariffRate(Number(config.price_per_unit));
                }
            } catch (e) {
                console.warn("Using default tariff", e);
            }
        };
        fetchConfig();
    }, [selectedProject]);

    useEffect(() => {
        const fetchInvoice = async () => {
            if (!selectedProject) return;
            setLoadingInvoice(true);
            try {
                const API = getApiBase();
                const res = await fetch(`${API}/billing/invoices?project_id=${selectedProject}`);
                if (res.ok) {
                    const data = await res.json();
                    const invoices = Array.isArray(data) ? data : (data.data || []);
                    // Find first unpaid invoice
                    const unpaid = invoices.find(inv => inv.status === 'unpaid');
                    setPendingInvoice(unpaid || null);
                }
            } catch (err) {
                console.error("Failed to fetch invoices", err);
            } finally {
                setLoadingInvoice(false);
            }
        };
        fetchInvoice();
    }, [selectedProject]);

    // --- Derived Stats ---
    const stats = useMemo(() => {
        const totalDevices = devices?.length || 0;
        let online = 0;
        let totalPower = 0;
        let totalEnergy = 0;

        devices?.forEach(d => {
            if (deviceStatus?.[d?.id] === 'online') online++;
            const latest = readingsByDevice[String(d?.id)] || {};
            const pick = (obj, keys) => {
                for (const k of keys) { if (obj[k] != null) return Number(obj[k]); }
                return null;
            };
            const pTotal = pick(latest, ['ActivePower_Total', 'TotalActivePower_kW', 'P_total', 'ActivePower']);
            const pSum = (Number(latest.ActivePower_L1) || 0) + (Number(latest.ActivePower_L2) || 0) + (Number(latest.ActivePower_L3) || 0);
            const kw = (pTotal != null ? pTotal : pSum);
            totalPower += Number.isFinite(kw) ? kw : 0;
            const ea = pick(latest, ['ActiveEnergy_kWh', 'EnergyActiveImport_kWh', 'EA+', 'TotalEnergy_kWh', 'EAP_total']);
            totalEnergy += Number.isFinite(ea) ? ea : 0;
        });

        return {
            totalDevices,
            online,
            offline: totalDevices - online,
            totalPower,
            totalEnergy
        };
    }, [devices, readingsByDevice, deviceStatus]);

    const displayName = useMemo(() => {
        if (typeof window === 'undefined') return 'User';
        const savedProfile = localStorage.getItem('user_profile_settings');
        if (savedProfile) {
            try {
                const p = JSON.parse(savedProfile);
                if (p && p.displayName) return p.displayName;
            } catch { }
        }
        return localStorage.getItem('display_name') || sessionStorage.getItem('display_name') || (t('hello') === 'Hello' ? 'User' : 'ผู้ใช้');
    }, [t]);

    // Use actual monthly consumption from billing summary (real calculated data)
    // Fallback to 0 if not available yet (don't use lifetime energy as it confuses users)
    const homeUsageKwh = billingSummary?.month_units != null ? Number(billingSummary.month_units) : 0;

    // Ideally these targets come from settings, for now we set to null to avoid arbitrary hardcoding if not available
    const targetKwh = billingSummary?.target_kwh || null;
    const usagePercent = targetKwh ? Math.min(100, Math.round((homeUsageKwh / targetKwh) * 100)) : 0;

    // Comparison Logic - if no history, default to 0
    const comparePercent = billingSummary?.compare_percent || 0;

    // --- High-Tech UI Components ---
    const GlassCard = ({ children, className = "", innerClassName = "p-5", accent = "slate" }) => {
        // Accents mapping
        const accents = {
            emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/20",
            amber: "from-amber-400 to-amber-600 shadow-amber-500/20",
            blue: "from-blue-400 to-blue-600 shadow-blue-500/20",
            purple: "from-purple-400 to-purple-600 shadow-purple-500/20",
            slate: "from-slate-400 to-slate-600 shadow-slate-500/10",
        };
        const accentGradient = accents[accent] || accents.slate;

        return (
            <div className={`relative bg-white backdrop-blur-3xl rounded-[1.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/50 transition-all duration-500 ${className}`}>
                {/* Dynamic Edge Bar - Now strictly absolute to the container */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-20 bg-gradient-to-b ${accentGradient}`} />

                {/* Subtle Background Mesh */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-50/50 via-transparent to-transparent opacity-50" />

                {/* Content Wrapper */}
                <div className={`relative z-10 ${innerClassName}`}>{children}</div>
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-32 relative bg-[#F8FAFC]">
            {/* Premium Background Elements */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-slate-100 to-transparent opacity-80" />

            <div className="relative z-10 p-5 space-y-6 max-w-lg mx-auto md:max-w-none md:grid md:grid-cols-2 md:gap-6 md:space-y-0">

                {/* Header - Clean & Modern */}
                <div className="flex items-center justify-between md:col-span-2 pt-2 pb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <div className="text-[10px] text-slate-400 font-mono tracking-[0.2em] uppercase font-bold">{t('welcome_back')}</div>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight font-rajdhani flex items-center gap-2">
                            {t('hello')}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 drop-shadow-sm">{displayName}</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                                <MapPin size={10} className="text-slate-400" />
                                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{projectName || 'Project Alpha'}</span>
                            </div>
                        </div>
                    </div>
                    {/* User Avatar / Profile Actions */}
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center relative cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1">
                        <Zap size={20} className="text-yellow-500" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white translate-x-1/3 -translate-y-1/3" />
                    </div>
                </div>

                {/* Main Stats HUD - Modernized */}
                <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
                    {/* 1. System Status */}
                    <GlassCard accent="emerald" innerClassName="p-4" className="group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                <Wifi size={20} />
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-emerald-100/50 border border-emerald-100 text-[9px] font-bold text-emerald-700 tracking-wider">LIVE</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('system_status')}</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-slate-800 font-rajdhani">{stats.online}</span>
                                <span className="text-lg text-slate-400 font-medium font-rajdhani">/{stats.totalDevices}</span>
                            </div>
                        </div>
                    </GlassCard>

                    {/* 2. Total Power */}
                    <GlassCard accent="amber" innerClassName="p-4" className="group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                <Activity size={20} />
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-amber-100/50 border border-amber-100 text-[9px] font-bold text-amber-700 tracking-wider">LOAD</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('total_power')}</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-slate-800 font-rajdhani">{stats.totalPower.toFixed(1)}</span>
                                <span className="text-xs text-slate-400 font-bold">kW</span>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* Energy Consumption - The Masterpiece */}
                <GlassCard accent="slate" className="md:col-span-2 overflow-visible" innerClassName="p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-widest">{t('energy_consumption')}</div>
                                <div className="text-[10px] text-slate-400 font-medium">Real-time Analysis</div>
                            </div>
                        </div>
                        <div className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-mono text-slate-500">
                            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 px-2">
                        {/* 1. Circular Gauge (Arc Reactor) */}
                        <div className="relative w-48 h-48 flex-shrink-0 flex items-center justify-center">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-yellow-400/10 blur-3xl rounded-full animate-pulse-slow" />

                            {/* SVG */}
                            <svg className="w-full h-full -rotate-90 filter drop-shadow-lg" viewBox="0 0 100 100">
                                {/* Track */}
                                <circle cx="50" cy="50" r="44" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeLinecap="round" />
                                {/* Progress */}
                                <circle
                                    cx="50" cy="50" r="44" fill="none" stroke="url(#gradientGold)" strokeWidth="8"
                                    strokeDasharray="276"
                                    strokeDashoffset={276 - (276 * (usagePercent > 0 ? usagePercent : 5)) / 100} // Keep small slice visible if 0
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                                <defs>
                                    <linearGradient id="gradientGold" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#F59E0B" />
                                        <stop offset="100%" stopColor="#D97706" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                                <div className="text-4xl font-black text-slate-800 font-rajdhani tracking-tighter shadow-black/5 drop-shadow-sm">
                                    {homeUsageKwh.toFixed(0)}
                                </div>
                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em] mt-1">KWH</div>
                                <div className="text-[9px] text-slate-300 mt-2 font-mono">USAGE</div>
                            </div>
                        </div>

                        {/* 2. Stats & Targets */}
                        <div className="flex-1 w-full space-y-6">
                            {/* Efficiency Bar */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efficiency Target</span>
                                    <span className="text-lg font-bold text-slate-800 font-rajdhani">{usagePercent}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                    {/* Show a small bar even if 0% to indicate functionality */}
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] relative transition-all duration-1000 ease-out"
                                        style={{ width: `${Math.max(usagePercent, 2)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse-fast" />
                                    </div>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> OPTIMAL
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">{targetKwh ? `${targetKwh} kWh MAX` : 'Setup Target'}</span>
                                </div>
                            </div>

                            {/* VS Last Month Card */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">VS Last Month</div>
                                    <div className={`text-base font-bold font-rajdhani ${comparePercent <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {comparePercent > 0 ? '+' : ''}{comparePercent}%
                                        <span className="text-slate-400 text-xs font-normal ml-1">
                                            {comparePercent <= 0 ? 'Saved' : 'Increased'}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${comparePercent <= 0 ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                    {comparePercent <= 0
                                        ? <TrendingDown size={20} />
                                        : <TrendingUp size={20} />
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Billing Ticket - Refined */}
                <GlassCard accent="blue" innerClassName="p-0" className="md:col-span-1 border-t-4 border-t-yellow-500 !rounded-t-2xl">
                    <div className="p-6 bg-gradient-to-b from-yellow-50/50 to-transparent relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl" />

                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-yellow-600 shadow-sm border border-yellow-100">
                                    <Wallet size={20} />
                                </div>
                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    {pendingInvoice ? t('unpaid_invoice') : t('current_usage_estimate')}
                                </div>
                            </div>
                            {pendingInvoice && (
                                <div className="px-3 py-1 rounded-full bg-red-50 text-red-500 text-[10px] font-bold border border-red-100 shadow-sm animate-pulse">
                                    DUE NOW
                                </div>
                            )}
                        </div>

                        <div className="text-center py-2">
                            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-1">{t('total_amount')}</div>
                            <div className="text-4xl font-black text-slate-800 font-orbitron tracking-tighter">
                                <span className="text-2xl align-top text-yellow-500 mr-1">฿</span>
                                {(pendingInvoice ? Number(pendingInvoice.amount) : (homeUsageKwh * tariffRate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50/80 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <button
                            onClick={() => pendingInvoice && setActivePanel('payment')}
                            className={`py-3 rounded-xl text-xs font-bold shadow-lg transition-transform active:scale-95 ${pendingInvoice
                                ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-slate-900/20'
                                : 'bg-slate-200 text-slate-400 cursor-default'
                                }`}>
                            {t('pay_now')}
                        </button>
                        <button
                            onClick={() => setActivePanel('billing')}
                            className="py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors">
                            {t('details')}
                        </button>
                    </div>
                </GlassCard>

                {/* Chart Area */}
                <div className="md:col-span-1">
                    <LoadPatternChart projectId={selectedProject} />
                </div>
            </div>
        </div>
    );
};

export default MobileDashboard;
