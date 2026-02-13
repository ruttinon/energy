import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import {
    BarChart,
    Activity,
    TrendingUp,
    AlertCircle,
    Users,
    Cpu,
    RefreshCw,
    Search,
    Boxes,
    Zap,
    DollarSign,
    Signal,
    LayoutGrid,
    ArrowUpRight,
    Wifi,
    LayoutList,
    Map
} from 'lucide-react';
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
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const AdminOverview = () => {
    const { showAlert } = useDialog();
    const { projects, selectedProject, selectProject, setActivePanel } = useApp();
    const isMounted = React.useRef(true);
    const DEFAULT_COST_PER_KWH = 4.5; // THB per kWh fallback
    const [fleetLoadSeries, setFleetLoadSeries] = useState([]);
    const [stats, setStats] = useState({
        projects: 0,
        devices: 0,
        alerts: 0,
        revenue: 0
    });
    const [overviewMetrics, setOverviewMetrics] = useState({ totalPower: 0, totalEnergy: 0, estimatedCost: 0 });
    const [projectStatus, setProjectStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState('');
    const [sortBy, setSortBy] = useState('power'); // Default sort by power
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    // Sparkline path generator
    const sparklinePath = (series, w = 120, h = 36) => {
        if (!series || series.length === 0) return '';
        const vals = series.map(s => s.v || 0);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        const range = max - min || 1;
        return vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * w;
            const y = h - ((v - min) / range) * h;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ');
    };

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/public/projects`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Invalid JSON from /public/projects');
            const data = await res.json();
            const allProjects = data.projects || [];

            // Parallel fetch for all projects
            const projectDataPromises = allProjects.map(async (p) => {
                const pid = p.project_id;
                let online = 0;
                let offline = 0;
                let total = 0;
                let revenue = 0;
                let energy = 0;
                let power = 0;

                // 1. Status
                try {
                    const ds = await fetch(`${API}/public/projects/${encodeURIComponent(pid)}/status`);
                    if (ds.ok) {
                        const sData = await ds.json();
                        const devices = Array.isArray(sData.devices) ? sData.devices : [];
                        total = devices.length;
                        online = devices.filter(d => (d.status || '').toLowerCase() === 'online').length;
                        offline = total - online;
                    }
                } catch (e) { }

                // 2. Billing
                let billingTodayUnits = 0;
                try {
                    const sRes = await fetch(`${API}/billing/summary?project_id=${encodeURIComponent(pid)}`);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        const summary = sData?.data;
                        revenue = summary ? (Number(summary.month_money || summary.today_money || 0)) : 0;
                        if (summary && summary.today_units != null) {
                            billingTodayUnits = Number(summary.today_units);
                        }
                    }
                } catch (e) { }

                // 3. Readings (Power & Energy)
                try {
                    const rRes = await fetch(`${API}/public/projects/${encodeURIComponent(pid)}/readings`);
                    if (rRes.ok) {
                        const rData = await rRes.json();
                        const items = Array.isArray(rData.items) ? rData.items : [];
                        let eMap = {};
                        for (const it of items) {
                            const did = String(it.device_id || '');
                            const param = String(it.parameter || '');
                            const unit = String(it.unit || '');
                            const val = Number(it.value || 0);

                            // Only sum up if we don't have billing data (fallback), but readings are usually lifetime...
                            // Actually, let's only use readings for Power. Energy should come from billing for "Today/Month" accuracy.
                            // If billing fails, we might get 0. 
                            if (/ActiveEnergy/i.test(param) || /kWh/i.test(unit)) {
                                eMap[did] = (eMap[did] || 0) + (isFinite(val) ? val : 0);
                            }
                            if (/ActivePower/i.test(param)) {
                                let v = Number(it.value);
                                if (!isFinite(v)) v = 0;
                                const u = unit.toLowerCase();
                                if (u === 'w' || u === 'watt' || u === 'watts') v = v / 1000;
                                power += v;
                            }
                        }
                        // Use billing calculated today_units if available, otherwise fallback to readings (which might be lifetime, so this fallback is risky but keeps old behavior if API fails)
                        // However, displaying lifetime as "Today" is wrong. 
                        // Let's prefer billingTodayUnits.
                        if (billingTodayUnits > 0) {
                            energy = billingTodayUnits;
                        } else {
                            // If no billing data, maybe show 0 or keep lifetime? 
                            // Showing lifetime as "Today" is definitely a bug. 
                            // But let's stick to the requested "Use actual calculated values".
                            // If we have 0 from billing, it means 0 consumption today.
                            energy = billingTodayUnits; 
                        }
                    }
                } catch (e) { }

                return {
                    id: pid,
                    name: p.project_name,
                    status: offline > 0 ? 'ATTENTION' : 'ONLINE',
                    alerts: offline,
                    devices: total,
                    revenue: revenue,
                    energy: energy,
                    power: power
                };
            });

            const results = await Promise.all(projectDataPromises);

            const totalDevices = results.reduce((acc, curr) => acc + curr.devices, 0);
            const totalAlerts = results.reduce((acc, curr) => acc + curr.alerts, 0);
            const totalRevenue = results.reduce((acc, curr) => acc + curr.revenue, 0);
            const totalPower = results.reduce((acc, curr) => acc + curr.power, 0);
            const totalEnergy = results.reduce((acc, curr) => acc + Number(curr.energy || 0), 0);
            const estimatedCost = totalEnergy * DEFAULT_COST_PER_KWH;

            const now = Date.now();
            setFleetLoadSeries(prev => {
                const last = prev.length ? prev[prev.length - 1] : null;
                if (last && now - last.t < 60_000) {
                    const next = prev.slice();
                    next[next.length - 1] = { t: last.t, v: totalPower };
                    return next;
                }
                const next = prev.concat({ t: now, v: totalPower });
                const cutoff = now - 24 * 60 * 60 * 1000;
                while (next.length && next[0].t < cutoff) next.shift();
                return next;
            });

            setStats({
                projects: allProjects.length,
                devices: totalDevices,
                alerts: totalAlerts,
                revenue: totalRevenue
            });

            setOverviewMetrics({
                totalPower: totalPower,
                totalEnergy: totalEnergy,
                estimatedCost: estimatedCost
            });

            const projStat = results.map(r => ({
                id: r.id,
                name: r.name,
                status: r.status,
                alerts: r.alerts,
                energy: r.energy,
                cost: r.revenue,
                power: Number(r.power || 0),
                devices: r.devices
            }));

            if (!isMounted.current) return;
            setProjectStatus(projStat);
        } catch (err) {
            console.error(err);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    const handleSync = async () => {
        if (!selectedProject) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/billing/sync?project_id=${selectedProject}`, { method: 'POST' });
            if (res.ok) {
                showAlert("Success", "System Synchronized Successfully");
                fetchData(); // Refresh data
            } else {
                showAlert("Error", "Sync Failed");
            }
        } catch (e) {
            console.error(e);
            showAlert("Error", "Sync Error");
        }
    };

    useEffect(() => {
        fetchData();
        const inter = setInterval(fetchData, 5000);
        return () => clearInterval(inter);
    }, []);

    const chartData = useMemo(() => ({
        labels: (fleetLoadSeries.length ? fleetLoadSeries : [{ t: Date.now(), v: 0 }]).map(p => {
            const d = new Date(p.t);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }),
        datasets: [{
            label: 'Network Load (kW)',
            data: (fleetLoadSeries.length ? fleetLoadSeries : [{ t: Date.now(), v: 0 }]).map(p => p.v),
            borderColor: '#ca8a04', // yellow-600
            backgroundColor: 'rgba(234, 179, 8, 0.1)', // yellow-500
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
        }]
    }), [fleetLoadSeries]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            y: {
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#94a3b8', font: { size: 10, family: 'Rajdhani' } },
                border: { display: false }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { size: 10, family: 'Rajdhani' }, maxTicksLimit: 8 },
                border: { display: false }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1e293b',
                bodyColor: '#ca8a04',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                titleFont: { family: 'Rajdhani', size: 12, weight: 'bold' },
                bodyFont: { family: 'Rajdhani', size: 12 }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    }), []);

    const filteredProjectStatus = useMemo(() => {
        const q = (filterText || '').trim().toLowerCase();
        let list = q
            ? projectStatus.filter(p =>
                String(p.name || '').toLowerCase().includes(q) ||
                String(p.id || '').toLowerCase().includes(q)
            )
            : projectStatus.slice();
        
        // Advanced Sorting
        list.sort((a, b) => {
            if (sortBy === 'power') return (b.power - a.power);
            if (sortBy === 'energy') return (b.energy - a.energy);
            if (sortBy === 'cost') return (b.cost - a.cost);
            if (sortBy === 'alerts') return (b.alerts - a.alerts);
            if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
            return 0;
        });
        
        return list;
    }, [projectStatus, filterText, sortBy]);

    // Navigate to Project Dashboard
    const handleProjectClick = (projectId) => {
        if (!projectId) return;
        selectProject(projectId);
        
        // If we are in admin mode, switch to devices view which is commonly used
        // Or if there is a 'dashboard' module available for admin, we could switch to that
        // Assuming 'admin_devices' is a safe default for detailed view
        if (setActivePanel) {
            setActivePanel('admin_devices');
        }
    };

    // Component for Top Metric Cards
    const MetricCard = ({ title, value, unit, subtext, icon: Icon, colorClass, sparkline, trend }) => (
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 ${colorClass}`}>
                <Icon size={80} />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg bg-opacity-10 ${colorClass.replace('text-', 'bg-')} ${colorClass}`}>
                                <Icon size={18} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
                        </div>
                        {trend && (
                            <div className={`flex items-center gap-1 text-[10px] font-bold ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {trend > 0 ? '+' : ''}{trend}%
                                <ArrowUpRight size={10} className={trend < 0 ? 'rotate-180' : ''} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-2xl lg:text-3xl font-bold font-orbitron ${colorClass}`}>{value}</span>
                        {unit && <span className="text-xs font-bold text-slate-400 mt-1">{unit}</span>}
                    </div>
                    {subtext && <div className="text-[10px] text-slate-400 font-medium mt-1">{subtext}</div>}
                </div>
                {sparkline && (
                    <div className="mt-4 h-10 w-full opacity-80">
                        <svg width="100%" height="100%" viewBox="0 0 120 36" preserveAspectRatio="none">
                            <path d={sparkline} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={colorClass} />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-2 md:p-6 gap-6 overflow-y-auto scrollbar-hide">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-orbitron text-slate-800 tracking-tight flex items-center gap-2">
                        <LayoutGrid className="text-yellow-500" />
                        Executive Dashboard
                    </h1>
                    <p className="text-xs text-slate-500 font-rajdhani uppercase tracking-widest mt-1 pl-1">
                        Real-time Enterprise Intelligence
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search Projects..."
                            className="bg-white border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs font-bold text-slate-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none w-64 shadow-sm"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                    </div>
                    
                    {/* View Toggle */}
                    <div className="flex bg-white rounded-full border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-yellow-50 text-yellow-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-yellow-50 text-yellow-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="List View"
                        >
                            <LayoutList size={16} />
                        </button>
                    </div>

                    <button 
                        onClick={fetchData} 
                        className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-200 shadow-sm transition-all active:scale-95"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                {/* Mobile Search - Visible only on mobile */}
                <div className="relative md:hidden w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search Projects..."
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm font-medium text-slate-600 focus:border-yellow-500 outline-none shadow-sm"
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                </div>
            </div>

            {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard 
                    title="Total Load" 
                    value={overviewMetrics.totalPower.toFixed(1)} 
                    unit="kW" 
                    icon={Zap} 
                    colorClass="text-yellow-600"
                    sparkline={sparklinePath(fleetLoadSeries, 120, 36)}
                    trend={2.4}
                />
                <MetricCard 
                    title="Energy Today" 
                    value={(Number(overviewMetrics.totalEnergy || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
                    unit="kWh" 
                    icon={Activity} 
                    colorClass="text-emerald-600"
                    subtext="Daily Accumulation"
                    trend={5.1}
                />
                <MetricCard 
                    title="Revenue" 
                    value={(overviewMetrics.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
                    unit="THB" 
                    icon={DollarSign} 
                    colorClass="text-emerald-600"
                    subtext="Estimated Daily Yield"
                    trend={4.8}
                />
                <MetricCard 
                    title="Fleet Status" 
                    value={`${stats.alerts > 0 ? stats.alerts : 'All'} ${stats.alerts > 0 ? 'Alerts' : 'Online'}`} 
                    unit={stats.alerts > 0 ? 'Active' : 'Systems'} 
                    icon={stats.alerts > 0 ? AlertCircle : Wifi} 
                    colorClass={stats.alerts > 0 ? "text-red-500" : "text-blue-500"}
                    subtext={`${stats.projects} Projects / ${stats.devices} Devices`}
                />
            </div>

            {/* Chart Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[250px] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold font-orbitron text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} /> Aggregate Fleet Load Curve
                    </h3>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-[9px] text-slate-400 font-bold uppercase">Current</div>
                            <div className="text-sm font-bold font-orbitron text-yellow-600">{overviewMetrics.totalPower.toFixed(1)} kW</div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 w-full h-full min-h-[180px]">
                    <Line data={chartData} options={chartOptions} />
                </div>
            </div>

            {/* Projects Grid Header */}
            <div className="flex items-center justify-between pt-2">
                <h2 className="text-lg font-bold font-orbitron text-slate-700">Project Fleet</h2>
                <div className="flex gap-2">
                    {['power', 'energy', 'cost', 'alerts'].map(key => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                sortBy === key 
                                    ? 'bg-yellow-500 text-white border-yellow-500 shadow-md shadow-yellow-200' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-yellow-300'
                            }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>

            {/* Projects Grid/List */}
            <div className={`grid gap-4 pb-10 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filteredProjectStatus.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => handleProjectClick(p.id)}
                        className={`group bg-white border border-slate-200 rounded-2xl hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-500/5 transition-all duration-300 cursor-pointer flex ${viewMode === 'grid' ? 'flex-col justify-between p-5' : 'flex-row items-center p-4 gap-6'}`}
                    >
                        {viewMode === 'grid' ? (
                            // GRID VIEW CARD
                            <>
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                                                p.alerts > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600 group-hover:bg-yellow-50 group-hover:text-yellow-600 transition-colors'
                                            }`}>
                                                {p.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm group-hover:text-yellow-600 transition-colors line-clamp-1">{p.name}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                                    <span className={`text-[10px] font-bold uppercase ${p.status === 'ONLINE' ? 'text-emerald-600' : 'text-red-500'}`}>{p.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {p.alerts > 0 && (
                                            <div className="px-2 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1">
                                                <AlertCircle size={10} /> {p.alerts}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Power</div>
                                            <div className="text-sm font-bold font-orbitron text-slate-700">{p.power.toFixed(1)} <span className="text-[9px] text-slate-400">kW</span></div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Yield</div>
                                            <div className="text-sm font-bold font-orbitron text-emerald-600">{p.cost} <span className="text-[9px] text-slate-400">฿</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <div className="text-[10px] font-medium text-slate-400">
                                        <span className="text-slate-600 font-bold">{p.energy.toFixed(1)}</span> kWh Today
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-yellow-500 group-hover:text-white transition-all">
                                        <ArrowUpRight size={14} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            // LIST VIEW ROW
                            <>
                                <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                                        p.alerts > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600 group-hover:bg-yellow-50 group-hover:text-yellow-600 transition-colors'
                                    }`}>
                                        {p.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm group-hover:text-yellow-600 transition-colors">{p.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                                <span className={`text-[10px] font-bold uppercase ${p.status === 'ONLINE' ? 'text-emerald-600' : 'text-red-500'}`}>{p.status}</span>
                                            </div>
                                            {p.alerts > 0 && (
                                                <div className="px-2 py-0.5 rounded bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1">
                                                    <AlertCircle size={10} /> {p.alerts} Alerts
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-8 flex-1 justify-end">
                                    <div className="text-right">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Power</div>
                                        <div className="text-sm font-bold font-orbitron text-slate-700">{p.power.toFixed(1)} <span className="text-[9px] text-slate-400">kW</span></div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Energy</div>
                                        <div className="text-sm font-bold font-orbitron text-slate-700">{p.energy.toFixed(1)} <span className="text-[9px] text-slate-400">kWh</span></div>
                                    </div>
                                    <div className="text-right hidden md:block">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Yield</div>
                                        <div className="text-sm font-bold font-orbitron text-emerald-600">{p.cost} <span className="text-[9px] text-slate-400">฿</span></div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-yellow-500 group-hover:text-white transition-all">
                                        <ArrowUpRight size={14} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminOverview;
