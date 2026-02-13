import React, { useState } from 'react';
import {
    LayoutDashboard,
    Activity,
    BarChart,
    AlertTriangle,
    Zap,
    CreditCard,
    Image as ImageIcon,
    Settings,
    ChevronLeft,
    ChevronRight,
    Filter,
    Layers,
    Search,
    ShieldCheck,
    Boxes,
    FileText,
    Info,
    PlusCircle,
    FolderOpen,
    Network,
    Database
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
    const {
        activePanel,
        setActivePanel,
        isAdminMode,
        setIsAdminMode,
        projects,
        selectedProject,
        selectProject,
        converters,
        selectedConverter,
        setSelectedConverter,
        devices,
        selectedDevice,
        setSelectedDevice
    } = useApp();

    const userMenuItems = [
        { id: 'dashboard', label: 'Matrix', icon: LayoutDashboard },
        { id: 'monitor', label: 'Monitor', icon: Activity },
        { id: 'trends', label: 'Trends', icon: BarChart },
        { id: 'alarms', label: 'Alarms', icon: AlertTriangle },
        { id: 'consumption', label: 'Monitor Energy', icon: Zap },
        { id: 'billing', label: 'Payment / Billing', icon: CreditCard },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'photoview', label: 'Photo View', icon: ImageIcon },
    ];

    const adminMenuItems = [
        { id: 'admin_overview', label: 'Admin Overview', icon: LayoutDashboard },
        { id: 'admin_devices', label: 'Device Manager', icon: Network },
        { id: 'admin_billing', label: 'Billing Admin', icon: CreditCard },
        { id: 'admin_screens', label: 'Screen Editor', icon: ImageIcon },
        { id: 'admin_alerts', label: 'Mission Control', icon: ShieldCheck },
        { id: 'admin_reports', label: 'Report Manager', icon: FileText },
        { id: 'admin_powerstudio', label: 'Power Studio', icon: Database },
        { id: 'admin_info', label: 'System Core', icon: Info },
    ];

    const menuItems = isAdminMode ? adminMenuItems : userMenuItems;

    return (
        <aside className={`h-full bg-slate-50 border-r border-slate-200 flex flex-col py-4 z-50 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
            <div
                className={`flex items-center justify-center text-slate-400 hover:text-yellow-600 cursor-pointer mb-4 transition-colors ${isCollapsed ? 'px-0' : 'px-4 justify-end'}`}
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </div>

            {/* Main Menu */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-2">
                {!isCollapsed && (
                    <div className="px-4 py-3 text-[10px] font-bold text-slate-400 tracking-[2px] uppercase">
                        {isAdminMode ? 'COMMAND MODULES' : 'MONITORING'}
                    </div>
                )}

                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePanel === item.id;
                    return (
                        <button
                            key={item.id}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden
                                ${isActive 
                                    ? 'bg-gradient-to-r from-yellow-50 to-white text-yellow-600 shadow-sm shadow-yellow-900/5' 
                                    : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm'
                                }
                                ${isCollapsed ? 'justify-center px-2' : ''}
                            `}
                            onClick={() => setActivePanel(item.id)}
                            title={isCollapsed ? item.label : ''}
                            aria-label={item.label}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-r-full" />
                            )}
                            <Icon size={18} className={`transition-colors ${isActive ? 'text-yellow-500' : 'text-slate-400 group-hover:text-yellow-500'}`} />
                            {!isCollapsed && (
                                <span className="whitespace-nowrap">{item.label}</span>
                            )}
                        </button>
                    )
                })}
            </div>
        </aside>
    );
};

export default Sidebar;
