import React, { useState } from 'react';
import {
    BarChart,
    Activity,
    Settings,
    PieChart,
    Zap,
    Table as TableIcon,
    Layout,
    Cpu,
    Server,
} from 'lucide-react';
import SummaryModule from '../../../components/Monitor/DetailedView/SummaryModule';
import OverviewModule from '../../../components/Monitor/DetailedView/OverviewModule';
import PowerModule from '../../../components/Monitor/DetailedView/PowerModule';
import EnergyModule from '../../../components/Monitor/DetailedView/EnergyModule';
import QualityModule from '../../../components/Monitor/DetailedView/QualityModule';
import UIModule from '../../../components/Monitor/DetailedView/UIModule';
import EnterpriseMonitor from '../../../components/Monitor/Enterprise/EnterpriseMonitor';
import { useApp } from '../../../context/AppContext';

const MonitorDashboard = () => {
    const [activeTab, setActiveTab] = useState('enterprise');
    const { devices, converters, selectedConverter, setSelectedConverter, selectedDevice, setSelectedDevice } = useApp();

    const tabs = [
        { id: 'enterprise', label: 'Command Center', icon: Server },
        { id: 'summary', label: 'Summary', icon: Layout },
        { id: 'overview', label: 'Overview', icon: TableIcon },
        { id: 'power', label: 'Power', icon: Zap },
        { id: 'energy', label: 'Energy', icon: BarChart },
        { id: 'quality', label: 'Quality', icon: Activity },
        { id: 'ui', label: 'I / V Details', icon: Cpu },
    ];

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'enterprise':
                return <EnterpriseMonitor />;
            case 'summary':
                return <SummaryModule />;
            case 'overview':
                return <OverviewModule />;
            case 'power':
                return <PowerModule />;
            case 'energy':
                return <EnergyModule />;
            case 'quality':
                return <QualityModule />;
            case 'ui':
                return <UIModule />;
            default:
                return <EnterpriseMonitor />;
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300
                  ${isActive
                                        ? 'bg-yellow-500 text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
                `}
                            >
                                <Icon size={16} className={isActive ? 'animate-pulse' : ''} />
                                <span className="font-rajdhani font-bold uppercase tracking-widest text-xs">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-[10px] font-mono text-yellow-600/70 uppercase tracking-widest">
                        Live Stream: ACTIVE
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab !== 'enterprise' && (
                    /* Global Filter Bar - Only show for legacy views */
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Converter</span>
                            <select
                                className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500"
                                value={selectedConverter || ''}
                                onChange={(e) => {
                                    setSelectedConverter(e.target.value || '');
                                    setSelectedDevice('');
                                }}
                            >
                                <option value="">ทั้งหมด</option>
                                {converters.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="kpi-card p-3 flex items-center gap-3">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Meter</span>
                            <select
                                className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500"
                                value={selectedDevice || ''}
                                onChange={(e) => setSelectedDevice(e.target.value || '')}
                            >
                                <option value="">ทั้งหมด</option>
                                {devices
                                    .filter(d => !selectedConverter || d.converter === selectedConverter)
                                    .map(d => (
                                        <option key={d.id} value={String(d.id)}>
                                            {d.name || d.id}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="kpi-card p-3 flex items-center justify-between">
                            {/* Empty for legacy filters */}
                        </div>
                    </div>
                )}

                {renderActiveTab()}
            </div>
        </div>
    );
};

export default MonitorDashboard;
