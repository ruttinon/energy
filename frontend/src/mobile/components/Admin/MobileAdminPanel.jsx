import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useDialog } from '../../../context/DialogContext';
import { 
    LayoutDashboard, 
    Server, 
    CreditCard, 
    ShieldAlert, 
    Settings, 
    Activity, 
    Database, 
    ShieldCheck, 
    LogOut,
    Lock,
    Bell,
    ChevronLeft,
    Home,
    Grid3x3,
    X,
    PieChart
} from 'lucide-react';
import api, { getApiBase } from 'services/api';
import AdminOverview from '../../../components/Admin/Modules/Overview/AdminOverview';
import AnalyticsReports from '../../../components/Admin/Modules/AnalyticsReports/AnalyticsReports';
import SystemCore from '../../../components/Admin/Modules/System/SystemCore';
import DeviceManager from '../../../components/Admin/Modules/DeviceManager/DeviceManager';
import BillingSettings from '../../../components/Admin/Modules/Billing/BillingSettings';
import MissionControl from '../../../components/Admin/Modules/Alerts/MissionControl';
import PhotoViewEditor from '../../../components/Admin/Modules/PhotoView/PhotoViewEditor';
import ExtensionControl from '../../../components/Admin/Modules/Extension/ExtensionControl';
import ServiceManager from '../../../components/Admin/Modules/Service/ServiceManager';

const MobileAdminPanel = () => {
    const { user, setIsAdminMode, activePanel, setActivePanel, selectedProject, projects, selectProject } = useApp();
    const { showConfirm } = useDialog();
    const [showNoti, setShowNoti] = useState(false);
    const [showAllProjects, setShowAllProjects] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loadingNoti, setLoadingNoti] = useState(false);

    const loadNotifications = async () => {
        setLoadingNoti(true);
        try {
            const projectId = selectedProject?.id;
            if (!projectId) {
                setNotifications([]);
                return;
            }
            
            try {
                const res = await api.notifications?.list?.(projectId);
                setNotifications((res && res.items) || []);
            } catch (apiError) {
                console.debug("Notifications not available:", apiError?.message);
                setNotifications([]);
            }
        } catch (e) {
            console.error("Failed to load notifications", e);
            setNotifications([]);
        } finally {
            setLoadingNoti(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
             const projectId = selectedProject?.id;
             if (!projectId) return;
             
             try {
                 await api.notifications?.markAllRead?.(projectId);
                 loadNotifications();
             } catch (apiError) {
                 console.debug("Mark all read not available:", apiError?.message);
             }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, [selectedProject]);

    const handleLogout = async () => {
        const confirmed = await showConfirm('ยืนยันการออกจากระบบ', 'คุณต้องการออกจากระบบ Admin ใช่หรือไม่?');
        if (!confirmed) return;
        
        try {
            const API = getApiBase();
            await fetch(`${API}/logout_admin`, { method: 'POST', credentials: 'include' });
        } catch (e) { }
        setIsAdminMode(false);
        window.location.href = '/login';
    };

    const modules = [
        { id: 'admin_overview', label: 'Command Overview', icon: LayoutDashboard, desc: 'Overview' },
        { id: 'admin_analytics', label: 'Analytics & Reports', icon: PieChart, desc: 'Analytics' },
        { id: 'admin_devices', label: 'Device Manager', icon: Server, desc: 'Devices' },
        { id: 'admin_billing', label: 'Fiscal Engine', icon: CreditCard, desc: 'Billing' },
        { id: 'admin_alerts', label: 'Mission Control', icon: ShieldAlert, desc: 'Alerts' },
        { id: 'admin_screens', label: 'PhotoView Editor', icon: Settings, desc: 'Screens' },
        { id: 'admin_extension', label: 'Extension Overlay', icon: Activity, desc: 'Extension' },
        { id: 'admin_service', label: 'Service Manager', icon: Server, desc: 'Service' },
        { id: 'admin_info', label: 'System Core', icon: ShieldCheck, desc: 'System' },
    ];

    const renderContent = () => {
        switch (activePanel) {
            case 'admin_overview': return <AdminOverview />;
            case 'admin_analytics': return <AnalyticsReports />;
            case 'admin_devices': return <DeviceManager />;
            case 'admin_billing': return <BillingSettings />;
            case 'admin_alerts': return <MissionControl />;
            case 'admin_screens': return <PhotoViewEditor />;
            case 'admin_extension': return <ExtensionControl />;
            case 'admin_service': return <ServiceManager />;
            case 'admin_info': return <SystemCore />;
            default: return null;
        }
    };

    const isOnDashboard = !activePanel || activePanel === 'dashboard';
    const isEditor = activePanel === 'admin_screens';
    const currentModule = modules.find(m => m.id === activePanel);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-rajdhani relative overflow-hidden flex flex-col">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-yellow-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-yellow-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                    {!isOnDashboard && (
                        <button 
                            onClick={() => setActivePanel(null)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white font-bold font-orbitron text-xs shadow-md">
                            A
                        </div>
                        <div>
                            <h1 className="font-orbitron font-bold text-sm tracking-wider text-yellow-600">ADMIN</h1>
                            <div className="text-[7px] text-slate-400 uppercase tracking-widest leading-none">Mobile Panel</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowNoti(v => !v); loadNotifications(); }}
                        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <Bell size={16} className="text-slate-500" />
                        {notifications.some(n => !n.read) && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444] animate-pulse" />
                        )}
                    </button>
                </div>
            </header>

            {/* Notification Panel */}
            {showNoti && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setShowNoti(false)}
                    />
                    <div className="absolute right-0 top-0 w-full max-w-sm h-full rounded-l-2xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
                        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-yellow-50 border border-yellow-100 flex items-center justify-center">
                                    <Bell size={14} className="text-yellow-600" />
                                </div>
                                <span className="font-bold text-slate-800 text-xs">Notifications</span>
                            </div>
                            <button
                                onClick={() => setShowNoti(false)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-3 space-y-2 max-h-[70vh]">
                            {loadingNoti && (
                                <div className="text-xs text-slate-400 px-2 py-2">Loading...</div>
                            )}
                            {!loadingNoti && notifications.length === 0 && (
                                <div className="text-xs text-slate-500 px-2 py-2">No notifications</div>
                            )}
                            {notifications.map((n, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg border text-xs ${!n.read ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}
                                >
                                    <div className="font-bold mb-1 text-sm text-slate-800">{n.title}</div>
                                    <div className="text-slate-600 mb-2">{n.message}</div>
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded text-[8px] ${n.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : (n.type === 'warning' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' : 'bg-slate-100 text-slate-500 border border-slate-200')}`}>
                                            {n.type || 'info'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {notifications.length > 0 && (
                            <div className="sticky bottom-0 p-3 border-t border-slate-100 bg-white/95 backdrop-blur-xl">
                                <button
                                    onClick={handleMarkAllRead}
                                    className="w-full px-3 py-2 rounded-lg text-xs bg-yellow-50 border border-yellow-100 text-yellow-600 hover:bg-yellow-100 transition-colors font-bold"
                                >
                                    Mark All Read
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Projects Modal */}
            {showAllProjects && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setShowAllProjects(false)}
                    />
                    <div className="absolute inset-4 max-h-[80vh] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-y-auto">
                        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
                            <h2 className="font-bold text-sm text-yellow-600">All Sites</h2>
                            <button
                                onClick={() => setShowAllProjects(false)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-3 space-y-2">
                            {projects.map((p, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        selectProject(p.id);
                                        setShowAllProjects(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
                                        selectedProject === p.id 
                                            ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                                            : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                                    }`}
                                >
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm truncate">{p.name}</div>
                                        <div className="text-[10px] text-slate-400">{p.id}</div>
                                    </div>
                                    {selectedProject === p.id && (
                                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={`flex-1 overflow-y-auto overflow-x-hidden z-10 scrollbar-hide ${isEditor ? 'p-0' : 'p-4'}`}>
                
                {/* Dashboard View */}
                {isOnDashboard && (
                    <>
                        {/* Status Card */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 relative overflow-hidden shadow-sm">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-500/10 rounded-full blur-xl" />
                            
                            <div className="flex items-center gap-3 mb-4 relative z-10">
                                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                                    <Lock size={16} className="text-yellow-600" />
                                </div>
                                <div>
                                    <div className="text-[8px] text-slate-400 uppercase tracking-widest">Logged in as</div>
                                    <div className="text-sm font-bold text-slate-800">{user?.username || 'Administrator'}</div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3 space-y-2 relative z-10">
                                <div>
                                    <div className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Current Site</div>
                                    <div className="text-xs font-mono text-yellow-600 font-bold">{selectedProject || 'Select a site'}</div>
                                </div>
                                <div>
                                    <div className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Project Selector */}
                        <button 
                            onClick={() => setShowAllProjects(true)}
                            className="w-full flex items-center justify-between p-4 mb-4 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition-transform"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Grid3x3 size={20} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="text-[10px] uppercase tracking-wider opacity-80">Active Site</div>
                                    <div className="font-bold text-sm truncate max-w-[200px]">{selectedProject || 'Select Site'}</div>
                                </div>
                            </div>
                            <ChevronLeft size={20} className="-rotate-90 opacity-60" />
                        </button>

                        {/* Modules Grid */}
                        <h2 className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Modules</h2>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {modules.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setActivePanel(m.id)}
                                    className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-4 flex flex-col items-start gap-3 hover:border-yellow-200 hover:shadow-md transition-all group min-h-[100px]"
                                >
                                    <div className="absolute right-[-10%] bottom-[-10%] opacity-[0.03] group-hover:scale-125 transition-transform duration-500">
                                        <m.icon size={80} />
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-yellow-50 transition-all">
                                        <m.icon size={20} className="text-slate-500 group-hover:text-yellow-600" />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.desc}</span>
                                        <span className="block text-sm font-bold text-slate-700 group-hover:text-slate-900">{m.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={handleLogout}
                            className="mt-6 w-full p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                        >
                            <LogOut size={16} /> Logout System
                        </button>
                    </>
                )}

                {/* Module Content */}
                {!isOnDashboard && (
                    <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                         {/* Note: Inner modules might still have dark theme styles if they are shared components */}
                         {renderContent()}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MobileAdminPanel;
