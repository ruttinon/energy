import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Search, Zap, Activity, Server, Wifi, AlertTriangle } from 'lucide-react';
import EnterpriseMonitor from '../../../components/Monitor/Enterprise/EnterpriseMonitor';
import SummaryModule from '../../../components/Monitor/DetailedView/SummaryModule';
import OverviewModule from '../../../components/Monitor/DetailedView/OverviewModule';
import PowerModule from '../../../components/Monitor/DetailedView/PowerModule';
import EnergyModule from '../../../components/Monitor/DetailedView/EnergyModule';
import QualityModule from '../../../components/Monitor/DetailedView/QualityModule';
import UIModule from '../../../components/Monitor/DetailedView/UIModule';

const MobileMonitor = () => {
    const { devices = [], liveData = {}, selectedDevice, setSelectedDevice, t } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode] = useState('enterprise'); // 'enterprise' | 'detailed'
    const [activeTab, setActiveTab] = useState('summary'); // for detailed

    const filteredDevices = devices.filter(d => {
        const name = String(d?.name || d?.id || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const isOnline = Boolean(liveData?.[d?.id]?.isOnline);
        if (filterStatus === 'online') return matchesSearch && isOnline;
        if (filterStatus === 'offline') return matchesSearch && !isOnline;
        return matchesSearch;
    });

    const getStatusColor = (isOnline) => isOnline ? 'text-emerald-600' : 'text-slate-400';

    return (
        <div className="relative z-10 p-4 space-y-4 pb-24 w-full overflow-x-hidden">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-700 bg-clip-text text-transparent">
                        {t('live_monitor')}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-[0.2em]">
                        Real-time Status • {devices.length} Units
                    </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-yellow-500/20 flex items-center justify-center shadow-lg shadow-yellow-500/10">
                    <Server className="w-5 h-5 text-yellow-600" />
                </div>
            </div>

            <div className="relative bg-white/60 backdrop-blur-md border border-yellow-500/20 rounded-2xl p-3 overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent animate-scan opacity-30" />
                <div className="flex items-center justify-between">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Live Devices</div>
                    <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {filteredDevices.length} Active
                    </div>
                </div>
                <div className="mt-2 flex items-end gap-1 h-10">
                    {[...Array(24)].map((_, i) => {
                        const h = 20 + Math.round(Math.abs(Math.sin(i)) * 60);
                        return <div key={i} style={{ height: `${h}%` }} className="w-1 bg-gradient-to-t from-yellow-600/40 via-yellow-500/70 to-yellow-400 rounded-sm" />;
                    })}
                </div>
            </div>

            {/* View Mode Switch */}
            <div className="flex gap-2">
                <button
                    onClick={() => setViewMode('enterprise')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${viewMode === 'enterprise' ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-700' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
                >
                    Enterprise
                </button>
                <button
                    onClick={() => setViewMode('detailed')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${viewMode === 'detailed' ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-700' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
                >
                    Detailed
                </button>
            </div>

            {viewMode === 'detailed' && (
                <div className="space-y-3">
                    <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-hide">
                        {[
                            { id: 'summary', label_key: 'summary' },
                            { id: 'overview', label_key: 'overview' },
                            { id: 'power', label_key: 'power' },
                            { id: 'energy', label_key: 'energy' },
                            { id: 'quality', label_key: 'quality' },
                            { id: 'ui', label_key: 'iv_tab' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${activeTab === tab.id ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-700' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
                            >
                                {t(tab.label_key)}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 min-w-0 overflow-hidden shadow-sm">
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Meter</span>
                            <span className="text-xs text-slate-700 font-medium truncate">
                                {selectedDevice
                                    ? (devices.find(d => String(d.id) === String(selectedDevice))?.name || selectedDevice)
                                    : 'ทั้งหมด (Overview)'}
                            </span>
                        </div>
                        <select
                            className="w-full sm:w-auto sm:min-w-[180px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-yellow-500/50 font-rajdhani shadow-sm"
                            value={selectedDevice || ''}
                            onChange={(e) => setSelectedDevice(e.target.value || '')}
                        >
                            <option value="">ทั้งหมด (Overview)</option>
                            {devices.map(d => (
                                <option key={d.id} value={String(d.id)}>
                                    {d.name || d.id}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Tools search (optional) */}
            {viewMode === 'enterprise' && (
                <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        <span>Device Filter</span>
                        <span className="text-slate-600 font-mono">
                            {filterStatus === 'all' ? 'All' : filterStatus === 'online' ? 'Online Only' : 'Offline Only'}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity bg-yellow-500/10" />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search devices..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="relative w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all placeholder:text-slate-400 font-rajdhani shadow-sm"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1 py-1">
                            <button
                                type="button"
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    filterStatus === 'all'
                                        ? 'bg-yellow-500/20 text-yellow-700 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('online')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    filterStatus === 'online'
                                        ? 'bg-emerald-500/20 text-emerald-700 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Online
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('offline')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    filterStatus === 'offline'
                                        ? 'bg-amber-500/20 text-amber-700 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Offline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'detailed' ? (
                <div className="flex-1 space-y-3">
                    {activeTab === 'summary' && <SummaryModule />}
                    {activeTab === 'overview' && <OverviewModule />}
                    {activeTab === 'power' && <PowerModule />}
                    {activeTab === 'energy' && <EnergyModule />}
                    {activeTab === 'quality' && <QualityModule />}
                    {activeTab === 'ui' && <UIModule />}
                </div>
            ) : (
                <div className="flex-1 space-y-3">
                    <EnterpriseMonitor />
                </div>
            )}
        </div>
    );
};

export default MobileMonitor;
