import React, { useState, useEffect, useMemo, memo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from 'recharts';
import { getApiBase } from 'services/api';

// UI Helper Components
const NeonText = ({ children, color = "gold", size = "sm" }) => {
    const glow = color === 'gold' ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-amber-600 drop-shadow-sm' 
               : color === 'amber' ? 'text-amber-600'
               : color === 'emerald' ? 'text-emerald-600'
               : 'text-slate-800';
    return <span className={`${glow} font-rajdhani font-bold tracking-wide ${size === 'lg' ? 'text-2xl' : size === 'xl' ? 'text-3xl' : 'text-sm'}`}>{children}</span>;
};

const LoadPatternChart = memo(({ projectId }) => {
    const [range, setRange] = useState('7D'); // 7D, 30D, 3M, 6M, Custom
    const [customDate, setCustomDate] = useState({ start: '', end: '' });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [comparison, setComparison] = useState({ percent: 0, improved: true });

    // Helper to fetch data
    const fetchData = async (selectedRange, customStart, customEnd) => {
        setLoading(true);
        try {
            // Determine dates based on range
            let end = new Date();
            let start = new Date();
            
            let isMonthlyView = false;

            if (selectedRange === '7D') start.setDate(end.getDate() - 7);
            else if (selectedRange === '30D') start.setDate(end.getDate() - 30);
            else if (selectedRange === '3M') {
                start.setMonth(end.getMonth() - 3);
                isMonthlyView = true;
            }
            else if (selectedRange === '6M') {
                start.setMonth(end.getMonth() - 6);
                isMonthlyView = true;
            }
            else if (selectedRange === 'Custom') {
                if (customStart && customEnd) {
                    start = new Date(customStart);
                    end = new Date(customEnd);
                    // If range > 31 days, suggest monthly view? Or just let user decide?
                    // For now, let's keep daily for custom unless it's huge, but user said "if month should be month".
                    // Let's auto-switch to monthly if diff > 45 days
                    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
                    if (diffDays > 45) isMonthlyView = true;
                } else {
                    // Default to current month if no dates picked yet
                    start.setDate(1);
                }
            }
            
            // Format dates for API: YYYY-MM-DD
            const fmt = (d) => d.toISOString().split('T')[0];
            
            // Try fetching from billing history endpoint first (Project level aggregation)
            let url = `/api/billing/history?project_id=${projectId}`;
            // Always append dates to filter correctly
            url += `&start=${fmt(start)}&end=${fmt(end)}`;

            const res = await fetch(url);
            let json = [];
            
            if (res.ok) {
                const response = await res.json();
                // Map API response to chart format
                const rawData = response.data || [];
                
                if (isMonthlyView) {
                    // Aggregate by Month (YYYY-MM)
                    const monthlyMap = {};
                    rawData.forEach(d => {
                        const monthKey = d.date.substring(0, 7); // YYYY-MM
                        if (!monthlyMap[monthKey]) {
                            monthlyMap[monthKey] = { date: monthKey, cost: 0, energy: 0, count: 0 };
                        }
                        monthlyMap[monthKey].cost += Number(d.total_cost || 0);
                        monthlyMap[monthKey].energy += Number(d.total_energy || 0);
                        monthlyMap[monthKey].count++;
                    });
                    json = Object.values(monthlyMap).sort((a, b) => a.date.localeCompare(b.date));
                } else {
                    json = rawData.map(d => {
                        const c = Number(d.total_cost);
                        const e = Number(d.total_energy);
                        return {
                            date: d.date, // API returns YYYY-MM-DD
                            cost: isNaN(c) ? 0 : c,
                            energy: isNaN(e) ? 0 : e
                        };
                    });
                }
            }

            setData(json);

            // Calculate Comparison (Last chunk vs Previous chunk)
            if (json.length > 1) {
                // For monthly view, compare last month vs previous month
                // For daily view, split in half
                const mid = Math.floor(json.length / 2);
                const recent = json.slice(mid).reduce((acc, cur) => acc + (cur.energy || 0), 0);
                const previous = json.slice(0, mid).reduce((acc, cur) => acc + (cur.energy || 0), 0);
                
                if (previous > 0) {
                    const diff = recent - previous;
                    const pct = (diff / previous) * 100;
                    setComparison({
                        percent: Math.abs(pct).toFixed(1),
                        improved: pct < 0, // Less usage is "improved"
                        label: pct < 0 ? 'Less than previous' : 'More than previous'
                    });
                } else {
                     setComparison({ percent: 100, improved: false, label: 'No previous data' });
                }
            } else {
                 setComparison({ percent: 0, improved: true, label: 'No data' });
            }

        } catch (err) {
            console.error("Failed to fetch chart data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (range !== 'Custom') {
            fetchData(range);
        } else if (customDate.start && customDate.end) {
            fetchData(range, customDate.start, customDate.end);
        }
    }, [range, projectId, customDate]);

    const handleApplyCustomDate = () => {
        if (customDate.start && customDate.end) {
            setRange('Custom');
            setShowDatePicker(false);
            // Effect will trigger fetch
        }
    };

    // Calculate dynamic width for horizontal scrolling
    const chartWidth = Math.max(100, data.length * (range === '7D' ? 50 : 30));
    const isScrollable = data.length > 10;

    return (
        <div className="relative bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(234,179,8,0.1)] transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-yellow-50/10 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-yellow-400/10 to-amber-300/10 blur-3xl rounded-full opacity-50" />
            
            {/* Header with Controls */}
            <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-yellow-50 text-yellow-600 border border-yellow-100 shadow-sm group-hover:scale-105 transition-transform">
                            <BarChart3 size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest font-rajdhani">LOAD PATTERN</span>
                    </div>
                    
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 backdrop-blur-sm">
                        {['7D', '3M', '6M'].map((r) => (
                            <button
                                key={r}
                                onClick={() => {
                                    setRange(r);
                                    setShowDatePicker(false);
                                }}
                                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all font-rajdhani tracking-wide ${
                                    range === r 
                                    ? 'bg-white text-yellow-600 shadow-sm border border-slate-100' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                        <button 
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                                range === 'Custom' 
                                ? 'bg-white text-yellow-600 shadow-sm border border-slate-100' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                            }`}
                        >
                            <Calendar size={12} />
                        </button>
                    </div>
                </div>

                {/* Custom Date Picker Popover */}
                {showDatePicker && (
                    <div className="mb-4 p-4 bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl shadow-xl animate-in slide-in-from-top-2 relative z-20">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-rajdhani">Select Range</span>
                            <button onClick={() => setShowDatePicker(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={14} className="text-slate-400" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Start</label>
                                <input 
                                    type="date" 
                                    value={customDate.start}
                                    onChange={(e) => setCustomDate(prev => ({ ...prev, start: e.target.value }))}
                                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all font-rajdhani"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">End</label>
                                <input 
                                    type="date" 
                                    value={customDate.end}
                                    onChange={(e) => setCustomDate(prev => ({ ...prev, end: e.target.value }))}
                                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all font-rajdhani"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleApplyCustomDate}
                            className="w-full py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-yellow-500/20 transition-all font-rajdhani tracking-wider uppercase"
                        >
                            Apply Range
                        </button>
                    </div>
                )}

                {/* Comparison Badge */}
                <div className="flex items-center gap-3 mb-4 pl-1">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm ${
                        comparison.improved 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                        : 'bg-red-50 border-red-100 text-red-600'
                    }`}>
                        {comparison.improved ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                        <span className="text-[11px] font-bold font-rajdhani">
                            {comparison.percent}% {comparison.improved ? 'Lower' : 'Higher'}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium tracking-wide">vs previous period</span>
                </div>

                {/* Chart Container - Horizontal Scroll Enabled */}
                <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                    <div className="h-[280px] md:h-[380px]" style={{ minWidth: isScrollable ? `${chartWidth}px` : '100%' }}>
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-10 h-10 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600, fontFamily: 'Rajdhani' }}
                                        dy={10}
                                        interval={0} // Show all ticks if possible, let container scroll
                                        tickFormatter={(val) => {
                                            // Format YYYY-MM-DD to DD MMM
                                            if (!val) return '';
                                            // Check if it's YYYY-MM (Monthly view)
                                            if (val.length === 7) {
                                                const [y, m] = val.split('-');
                                                const d = new Date(y, m - 1);
                                                return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                                            }
                                            const d = new Date(val);
                                            return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                        }}
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        orientation="left" 
                                        axisLine={false} 
                                        tickLine={false}
                                        tick={{ fill: '#eab308', fontSize: 10, fontWeight: 600, fontFamily: 'Rajdhani' }}
                                        tickFormatter={(val) => `฿${val}`}
                                        width={40}
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right" 
                                        axisLine={false} 
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600, fontFamily: 'Rajdhani' }}
                                        tickFormatter={(val) => `${val}`}
                                        width={30}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.1)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}
                                        cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                                        labelStyle={{ fontFamily: 'Rajdhani', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}
                                        labelFormatter={(label) => {
                                            if (label.length === 7) {
                                                const [y, m] = label.split('-');
                                                const d = new Date(y, m - 1);
                                                return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                                            }
                                            return new Date(label).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                        }}
                                    />
                                    <Legend 
                                        verticalAlign="top" 
                                        height={36}
                                        content={({ payload }) => (
                                            <div className="flex justify-end gap-4 text-[10px] mb-2 font-rajdhani uppercase tracking-wider">
                                                {payload.map((entry, index) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full border border-white shadow-sm" style={{ backgroundColor: entry.color }} />
                                                        <span className="text-slate-500 font-bold">{entry.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                    <Area 
                                        yAxisId="left"
                                        type="monotone" 
                                        dataKey="cost" 
                                        name="Cost (THB)" 
                                        stroke="#eab308" 
                                        fillOpacity={1} 
                                        fill="url(#colorCost)" 
                                        strokeWidth={2}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: '#eab308' }}
                                    />
                                    <Bar 
                                        yAxisId="right" 
                                        dataKey="energy" 
                                        name="Energy (kWh)" 
                                        fill="#94a3b8" 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={range === '7D' ? 12 : 20}
                                        opacity={0.8}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default LoadPatternChart;
