import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, Calendar, Clock } from 'lucide-react';
import { api } from 'services/api';

const MobileCostAnalysis = () => {
    const { selectedProject } = useApp();
    const [viewMode, setViewMode] = useState('daily');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isLandscape, setIsLandscape] = useState(window.innerHeight < window.innerWidth);
    const [timelineMonths, setTimelineMonths] = useState([]);
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(2); // Start at -3 months from now
    const [summary, setSummary] = useState({
        totalCost: 0,
        totalEnergy: 0,
        avgDailyCost: 0,
        avgDailyEnergy: 0,
        peakDay: null,
        peakEnergy: 0
    });

    // Initialize timeline (last 3 months + current month)
    useEffect(() => {
        const months = [];
        for (let i = 3; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push({
                year: d.getFullYear(),
                month: String(d.getMonth() + 1).padStart(2, '0'),
                label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            });
        }
        setTimelineMonths(months);
        setSelectedMonthIndex(months.length - 1); // Default to current month
    }, []);

    // Fetch data based on selected month
    const fetchData = async (monthIndex = selectedMonthIndex) => {
        if (!selectedProject || timelineMonths.length === 0) return;
        
        setLoading(true);
        try {
            const { year, month } = timelineMonths[monthIndex];
            let result = [];
            let costTotal = 0;
            let energyTotal = 0;
            let maxCost = 0;
            let maxEnergy = 0;
            let peakDay = null;

            if (viewMode === 'daily') {
                try {
                    const jsonData = await api.get(`/billing/daily/${year}-${month}?project_id=${selectedProject}`);
                    
                    if (jsonData?.data) {
                        result = jsonData.data.map((item) => ({
                            day: item.day || item.date?.slice(-2) || 'N/A',
                            date: item.date,
                            cost: parseFloat(item.total_cost || 0),
                            energy: parseFloat(item.total_energy || 0)
                        }));
                    }
                } catch (err) {
                    console.error('Fetch daily error:', err);
                    result = [];
                }

            } else {
                // Fetch monthly data
                try {
                    const year = timelineMonths[monthIndex].year;
                    const jsonData = await api.get(`/billing/monthly/${year}?project_id=${selectedProject}`);
                    
                    if (jsonData?.data) {
                        result = jsonData.data.map(item => ({
                            month: item.month || '',
                            cost: parseFloat(item.total_cost || 0),
                            energy: parseFloat(item.total_energy || 0)
                        }));
                    }
                } catch (err) {
                    console.error('Fetch monthly error:', err);
                    result = [];
                }
            }

            // Calculate summary
            result.forEach(item => {
                costTotal += item.cost || 0;
                energyTotal += item.energy || 0;
                if ((item.cost || 0) > maxCost) {
                    maxCost = item.cost || 0;
                    peakDay = item.day || item.month;
                }
                if ((item.energy || 0) > maxEnergy) {
                    maxEnergy = item.energy || 0;
                }
            });

            const count = result.length || 1;
            setSummary({
                totalCost: costTotal,
                totalEnergy: energyTotal,
                avgDailyCost: costTotal / count,
                avgDailyEnergy: energyTotal / count,
                peakDay: peakDay,
                peakEnergy: maxEnergy
            });

            setData(result);
        } catch (err) {
            console.error('Failed to fetch cost analysis:', err);
            // setDemoData();
        } finally {
            setLoading(false);
        }
    };

    // Fetch when viewMode or selectedMonthIndex changes
    useEffect(() => {
        if (timelineMonths.length > 0) {
            fetchData(selectedMonthIndex);
        }
    }, [viewMode, selectedMonthIndex, selectedProject, timelineMonths]);

    // Handle orientation changes
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

    // Demo data fallback
    const setDemoData = () => {
        const demoData = viewMode === 'daily' ? [
            { day: '23 Jan', date: '2026-01-23', cost: 150, energy: 45 },
            { day: '24 Jan', date: '2026-01-24', cost: 160, energy: 48 },
            { day: '25 Jan', date: '2026-01-25', cost: 0, energy: 0 },
            { day: '26 Jan', date: '2026-01-26', cost: 3480, energy: 620 },
            { day: '27 Jan', date: '2026-01-27', cost: 1240, energy: 220 },
            { day: '28 Jan', date: '2026-01-28', cost: 0, energy: 0 },
            { day: '29 Jan', date: '2026-01-29', cost: 80, energy: 15 }
        ] : [
            { month: 'Jan', cost: 12500, energy: 2100 },
            { month: 'Feb', cost: 14200, energy: 2450 },
            { month: 'Mar', cost: 11800, energy: 2000 }
        ];

        let totalCost = 0, totalEnergy = 0, maxCost = 0, peakDay = null, maxEnergy = 0;
        demoData.forEach(item => {
            totalCost += item.cost;
            totalEnergy += item.energy;
            if (item.cost > maxCost) {
                maxCost = item.cost;
                peakDay = item.day || item.month;
            }
            if (item.energy > maxEnergy) maxEnergy = item.energy;
        });

        setSummary({
            totalCost,
            totalEnergy,
            avgDailyCost: totalCost / demoData.length,
            avgDailyEnergy: totalEnergy / demoData.length,
            peakDay,
            peakEnergy: maxEnergy
        });

        setData(demoData);
    };

    useEffect(() => {
        fetchData();
    }, [selectedProject, viewMode, currentDate]);

    const handlePrevPeriod = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'daily') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setFullYear(newDate.getFullYear() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNextPeriod = () => {
        const newDate = new Date(currentDate);
        const today = new Date();
        if (viewMode === 'daily') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setFullYear(newDate.getFullYear() + 1);
        }
        if (newDate <= today) {
            setCurrentDate(newDate);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val || 0);
    };

    const getDateLabel = () => {
        if (viewMode === 'daily') {
            return currentDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
        } else {
            return currentDate.getFullYear();
        }
    };

    return (
        <div className="flex flex-col h-full p-4 gap-4 pb-24">
            {/* Header with Timeline Label */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 bg-clip-text text-transparent">
                            COST ANALYSIS
                        </h2>
                        <p className="text-[10px] text-slate-500 font-rajdhani">
                            {timelineMonths.length > 0 ? `${timelineMonths[selectedMonthIndex].label}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            {/* Timeline Slider */}
            {timelineMonths.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3">
                    {/* Timeline Visual */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between h-12 relative">
                            {/* Slider background */}
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 rounded-full" />
                            </div>
                            {/* Slider track */}
                            <input 
                                type="range" 
                                min="0" 
                                max={timelineMonths.length - 1} 
                                value={selectedMonthIndex}
                                onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
                                className="relative z-10 w-full h-12 appearance-none bg-transparent cursor-pointer accent-yellow-500"
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                }}
                            />
                        </div>
                        <style>{`
                            input[type="range"]::-webkit-slider-thumb {
                                appearance: none;
                                width: 20px;
                                height: 20px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #ca8a04, #eab308);
                                cursor: pointer;
                                border: 2px solid #fff;
                                box-shadow: 0 0 8px rgba(202, 138, 4, 0.4);
                            }
                            input[type="range"]::-moz-range-thumb {
                                width: 20px;
                                height: 20px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #ca8a04, #eab308);
                                cursor: pointer;
                                border: 2px solid #fff;
                                box-shadow: 0 0 8px rgba(202, 138, 4, 0.4);
                            }
                        `}</style>
                    </div>

                    {/* Month Labels */}
                    <div className="flex justify-between text-[10px] text-slate-400 px-1">
                        <span>NOW</span>
                        {timelineMonths.length >= 2 && <span>-1M</span>}
                        {timelineMonths.length >= 3 && <span>-2M</span>}
                        {timelineMonths.length >= 4 && <span>-3M</span>}
                    </div>
                </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex gap-2">
                <button 
                    onClick={() => setViewMode('daily')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === 'daily' ? 'bg-yellow-500 text-white shadow-md shadow-yellow-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                    Daily Breakdown
                </button>
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-yellow-500 text-white shadow-md shadow-yellow-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                    Monthly Overview
                </button>
            </div>

            {/* Summary Cards */}
            <div className={`grid gap-3 ${isLandscape && window.innerWidth >= 768 ? 'grid-cols-4' : 'grid-cols-2'}`}>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <div className="text-[10px] text-amber-700 uppercase tracking-wider mb-1">Total Cost</div>
                    <div className="text-lg font-bold text-slate-800 font-rajdhani">{formatCurrency(summary.totalCost)}</div>
                    <div className="text-[9px] text-amber-600/70 mt-1">Period Total</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <div className="text-[10px] text-blue-700 uppercase tracking-wider mb-1">Total Energy</div>
                    <div className="text-lg font-bold text-slate-800 font-rajdhani">{summary.totalEnergy.toFixed(1)} kWh</div>
                    <div className="text-[9px] text-blue-600/70 mt-1">Period Total</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                    <div className="text-[10px] text-yellow-700 uppercase tracking-wider mb-1">Avg Daily Cost</div>
                    <div className="text-lg font-bold text-slate-800 font-rajdhani">{formatCurrency(summary.avgDailyCost)}</div>
                    <div className="text-[9px] text-yellow-600/70 mt-1">Per Day Average</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <div className="text-[10px] text-emerald-700 uppercase tracking-wider mb-1">Avg Daily Energy</div>
                    <div className="text-lg font-bold text-slate-800 font-rajdhani">{summary.avgDailyEnergy.toFixed(1)} kWh</div>
                    <div className="text-[9px] text-emerald-600/70 mt-1">Per Day Average</div>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-2xl p-3 overflow-hidden">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-slate-400 text-sm">Loading...</div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                                dataKey={viewMode === 'daily' ? 'day' : 'month'} 
                                stroke="#94a3b8"
                                tick={{ fontSize: 12, fill: '#64748b' }}
                            />
                            <YAxis 
                                yAxisId="left"
                                stroke="#ca8a04"
                                tick={{ fontSize: 12, fill: '#ca8a04' }}
                                label={{ value: 'Cost (THB)', angle: -90, position: 'insideLeft', fill: '#ca8a04' }}
                            />
                            <YAxis 
                                yAxisId="right"
                                orientation="right"
                                stroke="#64748b"
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                label={{ value: 'Energy (kWh)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                            />
                            <Tooltip 
                                formatter={(value, name) => {
                                    if (name === 'cost') return [formatCurrency(value), 'Cost'];
                                    if (name === 'energy') return [value.toFixed(1) + ' kWh', 'Energy'];
                                    return value;
                                }}
                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: '#1e293b' }}
                                itemStyle={{ color: '#1e293b' }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="cost" fill="#ca8a04" name="Cost (THB)" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="energy" fill="#cbd5e1" name="Energy (kWh)" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Peak Info */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <div className="text-slate-500 uppercase tracking-wider mb-1">Peak Day/Month</div>
                        <div className="text-slate-800 font-rajdhani font-bold">{summary.peakDay || '-'}</div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase tracking-wider mb-1">Peak Energy</div>
                        <div className="text-slate-800 font-rajdhani font-bold">{summary.peakEnergy.toFixed(1)} kWh</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileCostAnalysis;
