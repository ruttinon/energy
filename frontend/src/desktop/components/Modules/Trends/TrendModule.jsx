import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Line,
    Bar
} from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useApp } from '../../../../context/AppContext';
import { getApiBase } from 'services/api';
import { Play, Square, Calendar, Download, RefreshCw, BarChart, Activity, Waves, ChevronDown, Check } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

const COLORS = [
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#eab308'  // Yellow
];

// Helper: Custom MultiSelect Dropdown
const MultiSelect = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter(item => item !== value));
        } else {
            if (selected.length < 5) { // Limit to 5 for performance
                onChange([...selected, value]);
            }
        }
    };

    return (
        <div className="relative flex-1" ref={ref}>
            <div
                className="bg-slate-800 border-none rounded-lg px-4 py-3 text-sm text-amber-400 font-bold focus:ring-1 focus:ring-amber-500 cursor-pointer flex justify-between items-center min-h-[44px] hover:bg-slate-700 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="truncate pr-2">
                    {selected.length === 0 ? 'Select Registers...' :
                        selected.length === 1 ? selected[0] :
                            `${selected.length} Selected`}
                </div>
                <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {options.map(opt => {
                        const isSelected = selected.includes(opt);
                        return (
                            <div
                                key={opt}
                                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-xs ${isSelected ? 'bg-amber-500/10 text-amber-500' : 'text-slate-300 hover:bg-slate-700'}`}
                                onClick={() => toggleOption(opt)}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-500'}`}>
                                    {isSelected && <Check size={10} className="text-black" />}
                                </div>
                                <span>{opt}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SingleSelect = ({ options, value, onChange, placeholder = 'Select...', renderOption }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt);
        setIsOpen(false);
    };

    const selectedLabel = useMemo(() => {
        if (!value) return placeholder;
        const found = options.find(o => (o.value || o) === value);
        if (found) return renderOption ? renderOption(found) : (found.label || found);
        return value;
    }, [value, options, placeholder, renderOption]);

    return (
        <div className="relative flex-1" ref={ref}>
            <div
                className="bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500 cursor-pointer flex justify-between items-center min-h-[38px] hover:bg-slate-700 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="truncate pr-2">
                    {selectedLabel}
                </div>
                <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {options.map((opt, idx) => {
                        const val = opt.value || opt;
                        const label = renderOption ? renderOption(opt) : (opt.label || opt);
                        const isSelected = String(val) === String(value);
                        return (
                            <div
                                key={idx}
                                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-xs ${isSelected ? 'bg-cyan-500/10 text-cyan-500' : 'text-slate-300 hover:bg-slate-700'}`}
                                onClick={() => handleSelect(val)}
                            >
                                <span>{label}</span>
                                {isSelected && <Check size={14} className="ml-auto text-cyan-500" />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const TrendModule = () => {
    const { selectedProject, selectedDevice, readingsByDevice, devices, selectedConverter, setSelectedConverter, setSelectedDevice, converters } = useApp();
    const [mode, setMode] = useState('realtime');
    const [chartType, setChartType] = useState('line');
    const [historyData, setHistoryData] = useState({}); // { [param]: [{x,y}] }
    const [isLoading, setIsLoading] = useState(false);
    const [timeRange, setTimeRange] = useState('1h');
    const [realtimeHistory, setRealtimeHistory] = useState([]);
    const chartRef = useRef(null);

    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // New Features State
    const [selectedParameters, setSelectedParameters] = useState(['Voltage_L1']);
    const [isSineWave, setIsSineWave] = useState(false);
    const hexToRgba = (hex, alpha) => {
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Dynamic Parameter Discovery
    const availableParameters = useMemo(() => {
        const standardParams = [
            'Voltage_L1', 'Voltage_L2', 'Voltage_L3',
            'Current_L1', 'Current_L2', 'Current_L3',
            'ActivePower', 'ReactivePower', 'ApparentPower',
            'Frequency', 'PowerFactor', 'ActiveEnergy_kWh'
        ];

        if (!selectedDevice || !readingsByDevice[selectedDevice]) {
            return standardParams;
        }

        const reading = readingsByDevice[selectedDevice];
        const keys = Object.keys(reading).filter(key =>
            !['id', 'device_id', 'timestamp', 'status'].includes(key)
        );

        if (keys.length < 3) {
            return Array.from(new Set([...standardParams, ...keys]));
        }

        return keys.sort();
    }, [selectedDevice, readingsByDevice]);

    // Handle History Fetching
    const abortControllerRef = useRef(null);

    useEffect(() => {
        if (mode === 'history' && selectedProject && selectedDevice && selectedParameters.length > 0) {
            // Only fetch if not custom, OR if custom and both dates are set
            if (timeRange !== 'custom' || (timeRange === 'custom' && customStart && customEnd)) {
                fetchHistory();
            }
        }
        
        // Cleanup function to abort on unmount or dependency change
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [mode, timeRange, selectedParameters, selectedDevice, selectedProject, customStart, customEnd]);

    const fetchHistory = async () => {
        if (!selectedProject || !selectedDevice || selectedParameters.length === 0) return;
        
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setIsLoading(true);
        const API = getApiBase();
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (timeRange) {
            case '1h': start.setHours(now.getHours() - 1); break;
            case '6h': start.setHours(now.getHours() - 6); break;
            case '24h': start.setHours(now.getHours() - 24); break;
            case '7d': start.setDate(now.getDate() - 7); break;
            case '30d': start.setDate(now.getDate() - 30); break;
            case 'custom':
                if (customStart) start = new Date(customStart);
                if (customEnd) end = new Date(customEnd);
                break;
            default: start.setHours(now.getHours() - 1);
        }

        const formatLocal = (date) => {
            const pad = (n) => String(n).padStart(2, '0');
            const y = date.getFullYear();
            const m = pad(date.getMonth() + 1);
            const d = pad(date.getDate());
            const hh = pad(date.getHours());
            const mm = pad(date.getMinutes());
            const ss = pad(date.getSeconds());
            return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
        };

        const startStr = formatLocal(start);
        const endStr = formatLocal(end);

        const newData = {};

        try {
            await Promise.all(selectedParameters.map(async (param) => {
                if (signal.aborted) return;
                const url = `${API}/history?project_id=${encodeURIComponent(selectedProject)}&device=${encodeURIComponent(selectedDevice)}&key=${encodeURIComponent(param)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
                
                try {
                    const res = await fetch(url, { signal });
                    if (res.ok) {
                        const json = await res.json();
                        newData[param] = (json.history || []).map(d => ({
                            x: new Date(d.timestamp).getTime(),
                            y: d.value
                        }));
                    } else {
                        newData[param] = [];
                    }
                } catch (fetchErr) {
                    if (fetchErr.name !== 'AbortError') {
                        console.error(`Fetch error for ${param}:`, fetchErr);
                        newData[param] = [];
                    }
                }
            }));
            
            if (!signal.aborted) {
                setHistoryData(newData);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('History Fetch Error:', err);
            }
        } finally {
            if (!signal.aborted) {
                setIsLoading(false);
            }
        }
    };

    // Handle Realtime updates
    const latestReadingRef = useRef(null);

    useEffect(() => {
        if (readingsByDevice && selectedDevice) {
            latestReadingRef.current = readingsByDevice[selectedDevice];
        }
    }, [readingsByDevice, selectedDevice]);

    useEffect(() => {
        if (mode !== 'realtime') return;

        const interval = setInterval(() => {
            const latest = latestReadingRef.current;
            if (!latest) return;

            const timestamp = Date.now();

            setRealtimeHistory(prev => {
                const point = { t: timestamp };
                // Capture all selected parameters
                selectedParameters.forEach(p => {
                    point[p] = latest[p] !== undefined ? latest[p] : null;
                });
                const next = [...prev, point];
                return next.slice(-60); // Keep last 60 points
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [mode, selectedParameters]);

    const chartData = useMemo(() => {
        const datasets = selectedParameters.map((param, index) => {
            const color = COLORS[index % COLORS.length];
            let data = [];

            if (mode === 'realtime') {
                data = realtimeHistory.map(d => ({
                    x: d.t,
                    y: d[param] || 0
                }));
            } else {
                data = historyData[param] || [];
            }

            return {
                label: param,
                data: data,
                borderColor: color,
                backgroundColor: chartType === 'area' ? `${color}20` : 'transparent',
                fill: chartType === 'area',
                tension: isSineWave ? 0.4 : 0.1,
                pointRadius: isSineWave ? 0 : 2,
                borderWidth: 2,
            };
        });

        return { datasets };
    }, [mode, realtimeHistory, historyData, chartType, selectedParameters, isSineWave]);
    const fiveDPlugin = {
        id: 'fiveDPlugin',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const t = (Date.now() % 2000) / 2000;
            chart.data.datasets.forEach((ds, i) => {
                const meta = chart.getDatasetMeta(i);
                if (!meta || !chart.isDatasetVisible(i) || !meta.data || meta.data.length === 0) return;
                ctx.save();
                const color = ds.borderColor || '#ffd700';
                ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = (ds.borderWidth || 2) + 2;
                ctx.shadowColor = color;
                ctx.shadowBlur = 18;
                ctx.beginPath();
                meta.data.forEach((pt, idx) => {
                    const x = pt.x;
                    const y = pt.y;
                    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();
                if (chart.config.type === 'line' && (chart.options?.fill || ds.fill || chart.config.data?.datasets?.[i]?.fill)) {
                    const grad = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    grad.addColorStop(0, hexToRgba(color, 0));
                    grad.addColorStop(0.5, hexToRgba(color, 0.12));
                    grad.addColorStop(1, hexToRgba(color, 0.25));
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    meta.data.forEach((pt, idx) => {
                        const x = pt.x;
                        const y = pt.y;
                        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    const last = meta.data[meta.data.length - 1];
                    const first = meta.data[0];
                    if (last && first) {
                        ctx.lineTo(last.x, chartArea.bottom);
                        ctx.lineTo(first.x, chartArea.bottom);
                    } else {
                        ctx.lineTo(chartArea.right, chartArea.bottom);
                        ctx.lineTo(chartArea.left, chartArea.bottom);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            });
        }
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeInOutQuart' },
        animations: {
            tension: {
                duration: 2000,
                easing: 'linear',
                from: isSineWave ? 0.25 : 0.15,
                to: isSineWave ? 0.5 : 0.3,
                loop: true
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        elements: {
            line: {
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
            },
            point: {
                hoverRadius: 6
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    tooltipFormat: 'dd/MM/yyyy HH:mm:ss',
                    displayFormats: {
                        millisecond: 'HH:mm:ss.SSS',
                        second: 'HH:mm:ss',
                        minute: 'HH:mm',
                        hour: 'dd/MM HH:mm',
                        day: 'dd/MM'
                    }
                },
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#64748b', font: { size: 10, family: 'Rajdhani' } }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#64748b', font: { size: 10, family: 'Rajdhani' } }
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: { boxWidth: 12, color: '#94a3b8', font: { size: 11, family: 'Rajdhani' } }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: 'rgba(6, 182, 212, 0.3)',
                borderWidth: 1,
                titleFont: { family: 'Orbitron' },
                bodyFont: { family: 'Rajdhani' },
                padding: 10,
                callbacks: {
                    label: function (context) {
                        return `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}`;
                    }
                }
            }
        }
    };

    return (
        <div className="flex flex-col h-full gap-6 module-3d">
            {/* Header & Mode Switcher */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-white">Advanced Trends</h2>
                    <p className="text-sm text-slate-400 font-rajdhani uppercase tracking-widest">
                        {mode} data visualization & historical analytics
                    </p>
                </div>

                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                    {['realtime', 'history'].map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`px-4 py-1 text-[10px] font-bold rounded uppercase tracking-widest transition-all ${mode === m ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Controls Sidebar */}
                <div className="lg:col-span-1 h-full min-h-0 flex flex-col">
                    {/* Use a container that allows overflow for the dropdowns */}
                    <div className="glass-panel rounded-2xl border border-white/5 relative p-5 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-3">

                        {/* Device Selection Group */}
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-slate-500 pl-2">Device Selection</div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase">Converter</label>
                                <SingleSelect
                                    options={['', ...converters]}
                                    value={selectedConverter}
                                    onChange={(v) => setSelectedConverter(v)}
                                    placeholder="ทั้งหมด"
                                    renderOption={(opt) => opt || 'ทั้งหมด'}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase">Meter</label>
                                <SingleSelect
                                    options={devices
                                        .filter(d => !selectedConverter || String(d.converter) === String(selectedConverter))
                                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                        .map(d => ({
                                            value: String(d.id),
                                            label: d.name || d.id || '',
                                            device: d
                                        }))
                                    }
                                    value={selectedDevice}
                                    onChange={(v) => setSelectedDevice(String(v))}
                                    placeholder="กรุณาเลือก"
                                    renderOption={(opt) => opt.label}
                                />
                            </div>
                        </div>

                        {/* Parameter Selection Group */}
                        <div className="space-y-4 z-20">
                            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">Parameters</div>
                            <div className="relative">
                                <MultiSelect
                                    options={availableParameters}
                                    selected={selectedParameters}
                                    onChange={setSelectedParameters}
                                />
                            </div>
                        </div>

                        {/* Chart Settings Group */}
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-l-2 border-cyan-500 pl-2">Chart Settings</div>

                            {/* Sine Wave Toggle */}
                            <button
                                onClick={() => setIsSineWave(!isSineWave)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isSineWave ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Waves size={16} />
                                    <span className="text-xs font-bold uppercase">Sine Wave Mode</span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${isSineWave ? 'bg-cyan-500 shadow-[0_0_8px_cyan]' : 'bg-slate-600'}`}></div>
                            </button>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase">View Mode</label>
                                <select
                                    value={chartType}
                                    onChange={(e) => setChartType(e.target.value)}
                                    className="w-full bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-white"
                                >
                                    <option value="line">Waves (Line)</option>
                                    <option value="area">Glow (Area)</option>
                                    <option value="bar">Columns (Bar)</option>
                                </select>
                            </div>

                            {mode === 'history' && (
                                <div className="space-y-2 animate-in slide-in-from-top duration-300">
                                    <label className="text-[10px] text-slate-500 uppercase">Time Span</label>
                                    <select
                                        value={timeRange}
                                        onChange={(e) => setTimeRange(e.target.value)}
                                        className="w-full bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500"
                                    >
                                        <option value="1h">Last 1 Hour</option>
                                        <option value="6h">Last 6 Hours</option>
                                        <option value="24h">Last 24 Hours</option>
                                        <option value="7d">Last 7 Days</option>
                                        <option value="30d">Last 30 Days</option>
                                        <option value="custom">Custom Range...</option>
                                    </select>

                                    {timeRange === 'custom' && (
                                        <div className="flex flex-col gap-2 mt-2 animate-in slide-in-from-top duration-300">
                                            <div>
                                                <label className="text-[9px] text-slate-500 uppercase">Start From</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                                    value={customStart}
                                                    onChange={(e) => setCustomStart(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] text-slate-500 uppercase">End At</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                                    value={customEnd}
                                                    onChange={(e) => setCustomEnd(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-auto space-y-4">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-slate-500 pl-2">System</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button className="flex flex-col items-center justify-center p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors group">
                                    <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 mb-2" />
                                    <span className="text-[8px] uppercase font-bold text-slate-500">Export CSV</span>
                                </button>
                                <button
                                    onClick={() => mode === 'history' && fetchHistory()}
                                    className="flex flex-col items-center justify-center p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors group"
                                >
                                    <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-amber-400 mb-2 ${isLoading ? 'animate-spin' : ''}`} />
                                    <span className="text-[8px] uppercase font-bold text-slate-500">Refresh</span>
                                </button>
                            </div>

                            <div className="pt-2 border-t border-white/5">
                                <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-tighter">Realtime Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Chart Area */}
                <div className="lg:col-span-3 min-h-[400px]">
                    <div className="kpi-card p-6 h-full flex flex-col relative overflow-hidden">
                        {isLoading && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-3" />
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-500/50">Querying Database...</span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <BarChart className="w-4 h-4 text-cyan-500" />
                                <span className="text-xs font-bold font-orbitron uppercase text-slate-300">
                                    {mode === 'realtime' ? 'Live Streaming' : 'History Analysis'}
                                </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                                {selectedDevice ? devices.find(d => String(d.id) === String(selectedDevice))?.name : 'NO DEVICE SELECTED'}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            {chartType === 'bar' ? (
                                <Bar data={chartData} options={chartOptions} />
                            ) : (
                                <Line ref={chartRef} data={chartData} options={chartOptions} plugins={[fiveDPlugin]} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendModule;
