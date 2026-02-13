import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { api, getApiBase } from '../../../../services/api';
import { 
    FileText, 
    Download, 
    Calendar, 
    CreditCard, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Zap, 
    Activity,
    Search,
    Filter,
    ChevronDown,
    Eye,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileSpreadsheet,
    PieChart,
    BarChart3
} from 'lucide-react';
import { 
    ComposedChart, 
    Line, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    Area 
} from 'recharts';

const AnalyticsReports = () => {
    const { selectedProject } = useApp();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [timeRange, setTimeRange] = useState('year'); // Default to year for now
    
    // State for Real Data
    const [kpiData, setKpiData] = useState({
        total_cost_ytd: 0,
        energy_consumption: 0,
        carbon_footprint: 0,
        cost_trend: 0,
        energy_trend: 0,
        carbon_trend: 0
    });
    const [chartData, setChartData] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch Data Effect
    useEffect(() => {
        if (!selectedProject) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const projectId = typeof selectedProject === 'object' ? selectedProject.id : selectedProject;
                const year = new Date().getFullYear();

                // 1. Audit Log (Save Data Requirement)
                await api.post('/audit/log', {
                    project_id: projectId,
                    username: 'mobile_user', // Replace with actual user if available
                    action: 'VIEW_ANALYTICS',
                    event_type: 'VIEW',
                    details: 'User viewed analytics dashboard'
                });

                // 2. Fetch KPI Summary
                const summaryRes = await api.get(`/billing/summary?project_id=${projectId}`);
                if (summaryRes?.data) {
                    setKpiData(summaryRes.data);
                }

                // 3. Fetch Chart Data (Monthly)
                const chartRes = await api.get(`/billing/monthly/${year}?project_id=${projectId}`);
                if (chartRes?.data) {
                    // Map backend data to chart format
                    const formattedChart = chartRes.data.map(item => ({
                        name: item.month,
                        cost: item.total_cost,
                        energy: item.total_energy,
                        budget: 15000 // Mock budget for now or fetch from config
                    }));
                    setChartData(formattedChart);
                }

                // 4. Fetch Invoices
                const invRes = await api.get(`/billing/invoices?project_id=${projectId}`);
                if (invRes) { // Invoice endpoint returns list directly based on router code
                    setInvoices(invRes); 
                }

                // 5. Fetch Reports
                const repRes = await api.get(`/report/generated?project_id=${projectId}`);
                if (repRes?.files) {
                    setReports(repRes.files);
                }

            } catch (error) {
                console.error("Failed to load analytics data", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedProject]);

    // Helper for download URL
    const getDownloadUrl = (filename) => {
        if (!selectedProject) return '#';
        const projectId = typeof selectedProject === 'object' ? selectedProject.id : selectedProject;
        return `${getApiBase()}/report/download/${filename}?project_id=${projectId}`;
    };

    return (
        <div className="h-full flex flex-col gap-6 bg-slate-50/50 p-6 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 font-orbitron tracking-tight">
                        Analytics & Reports
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                        <Activity size={16} className="text-yellow-500" />
                        Financial Intelligence & Operational Insights
                    </p>
                </div>
                
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    {['dashboard', 'billing', 'reports'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                activeTab === tab 
                                ? 'bg-slate-800 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
                </div>
            ) : (
                <>
                    {/* Dashboard View */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <MetricCard 
                                    title="Total Cost (YTD)" 
                                    value={`฿${(kpiData.total_cost_ytd || 0).toLocaleString()}`}
                                    trend={`${kpiData.cost_trend > 0 ? '+' : ''}${kpiData.cost_trend || 0}%`}
                                    trendUp={kpiData.cost_trend <= 0} // Cost down is good
                                    icon={DollarSign}
                                    color="yellow"
                                />
                                <MetricCard 
                                    title="Energy Consumption" 
                                    value={`${(kpiData.energy_consumption || 0).toLocaleString()} kWh`}
                                    trend={`${kpiData.energy_trend > 0 ? '+' : ''}${kpiData.energy_trend || 0}%`}
                                    trendUp={kpiData.energy_trend <= 0} // Less energy is good
                                    icon={Zap}
                                    color="cyan"
                                />
                                <MetricCard 
                                    title="Carbon Footprint" 
                                    value={`${(kpiData.carbon_footprint || 0).toLocaleString()} Tons`}
                                    trend={`${kpiData.carbon_trend > 0 ? '+' : ''}${kpiData.carbon_trend || 0}%`}
                                    trendUp={kpiData.carbon_trend <= 0} // Less carbon is good
                                    icon={TrendingDown}
                                    color="emerald"
                                />
                            </div>

                            {/* Main Chart */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <BarChart3 size={20} className="text-yellow-600" />
                                        Cost vs Energy Trends
                                    </h3>
                                    <select 
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-yellow-500/20"
                                        value={timeRange}
                                        onChange={(e) => setTimeRange(e.target.value)}
                                    >
                                        <option value="year">Year to Date</option>
                                    </select>
                                </div>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }} 
                                                tickFormatter={(value) => `฿${value/1000}k`}
                                            />
                                            <YAxis 
                                                yAxisId="right"
                                                orientation="right"
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }} 
                                                tickFormatter={(value) => `${value}k`}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#fff', 
                                                    borderRadius: '12px', 
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                                                }}
                                                cursor={{ fill: '#f8fafc' }}
                                            />
                                            <Legend iconType="circle" />
                                            <Bar yAxisId="left" dataKey="cost" name="Cost (THB)" fill="#eab308" radius={[4, 4, 0, 0]} barSize={40} />
                                            <Line yAxisId="right" type="monotone" dataKey="energy" name="Energy (kWh)" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
                                            <Area yAxisId="left" type="monotone" dataKey="budget" name="Budget Limit" fill="none" stroke="#94a3b8" strokeDasharray="5 5" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Billing Statements View */}
                    {activeTab === 'billing' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Billing History & Slips</h3>
                                        <p className="text-slate-500 text-sm mt-1">Manage invoices and download payment proof</p>
                                    </div>
                                    <button className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-all">
                                        <Download size={16} /> Export CSV
                                    </button>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4 text-left">Invoice ID</th>
                                                <th className="px-6 py-4 text-left">Date</th>
                                                <th className="px-6 py-4 text-left">Amount</th>
                                                <th className="px-6 py-4 text-left">Reference</th>
                                                <th className="px-6 py-4 text-left">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {invoices.length > 0 ? invoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-800">{inv.id}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 text-sm">
                                                        {new Date(inv.date || inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">
                                                        ฿{(inv.amount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                                        {inv.ref || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                            inv.status === 'paid' 
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                            : 'bg-red-50 text-red-600 border-red-100'
                                                        }`}>
                                                            {inv.status === 'paid' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                            {String(inv.status).toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all" title="View Details">
                                                                <Eye size={16} />
                                                            </button>
                                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-all">
                                                                <FileText size={14} />
                                                                Slip
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">
                                                        No invoices found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reports Archive View */}
                    {activeTab === 'reports' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                            {reports.length > 0 ? reports.map((report) => (
                                <div key={report.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${
                                            report.type === 'Excel' ? 'bg-emerald-50 text-emerald-600' :
                                            report.type === 'PDF' ? 'bg-red-50 text-red-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                            {report.type === 'Excel' ? <FileSpreadsheet size={24} /> : <FileText size={24} />}
                                        </div>
                                        <a 
                                            href={getDownloadUrl(report.name)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-300 hover:text-slate-600 rounded-full hover:bg-slate-50"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-1 line-clamp-1 group-hover:text-yellow-600 transition-colors">
                                        {report.name}
                                    </h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-3">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {report.date}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span>{report.size}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full text-center py-12 text-slate-400">
                                    No reports generated yet.
                                </div>
                            )}
                            
                            {/* Add New Report Button */}
                            <button className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50/50 transition-all group">
                                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <Search size={24} />
                                </div>
                                <span className="font-bold text-sm">Generate New Report</span>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const MetricCard = ({ title, value, trend, trendUp, icon: Icon, color }) => {
    // Helper to get static classes for Tailwind
    const getColorClasses = (c) => {
        const map = {
            yellow: 'bg-yellow-50 text-yellow-600',
            cyan: 'bg-cyan-50 text-cyan-600',
            emerald: 'bg-emerald-50 text-emerald-600',
            red: 'bg-red-50 text-red-600',
            blue: 'bg-blue-50 text-blue-600',
            slate: 'bg-slate-50 text-slate-600',
        };
        return map[c] || map['slate'];
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${getColorClasses(color)}`}>
                    <Icon size={20} />
                </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                {trendUp ? <TrendingDown size={14} className="rotate-180" /> : <TrendingUp size={14} />}
                {trend}
                <span className="text-slate-400 font-medium ml-1">vs last month</span>
            </div>
        </div>
    );
};

export default AnalyticsReports;
