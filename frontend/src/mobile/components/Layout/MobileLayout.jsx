import React, { useEffect, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import BottomNav from './BottomNav';
import { Bell, User, Zap } from 'lucide-react';
import api from 'services/api';

const MobileLayout = ({ children }) => {
    const { activePanel, setActivePanel, selectedProject, t } = useApp();
    const [showNoti, setShowNoti] = useState(false);
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [isLandscape, setIsLandscape] = useState(window.innerHeight < window.innerWidth);

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

    const loadActiveAlerts = async () => {
        if (!selectedProject) return;
        setLoadingAlerts(true);
        const res = await api.alerts.getActive(selectedProject);
        setActiveAlerts((res && res.data) || []);
        setLoadingAlerts(false);
    };

    useEffect(() => {
        const loadAll = async () => {
            await loadActiveAlerts();
            try {
                const res = await api.notifications.list(selectedProject);
                setNotifications((res && res.items) || []);
            } catch (e) {
                setNotifications([]);
            }
        };
        loadAll();
    }, [selectedProject]);

    // Determine header title based on active panel
    const getHeaderTitleKey = () => {
        switch(activePanel) {
            case 'dashboard': return 'app_title';
            case 'monitor': return 'live_monitor';
            case 'billing': return 'billing';
            case 'trends': return 'trends';
            case 'alarms': return 'notifications';
            case 'menu': return 'menu';
            default: return 'app_title';
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.notifications.markAllRead(selectedProject);
            const res = await api.notifications.list(selectedProject);
            setNotifications((res && res.items) || []);
        } catch (e) { }
    };

    const allItems = [
        ...(notifications || []),
        ...(activeAlerts || []).map(a => ({
            isAlert: true,
            title: a.title || a.type || 'Alert',
            message: a.desc || a.message || '',
            time: a.time || a.timestamp || '',
            type: a.type || 'warning',
            device_id: a.device_id,
            severity: a.severity
        }))
    ];

    // Conditional layout: flex-row for landscape, flex-col for portrait
    return (
        <div className={`flex ${isLandscape && window.innerWidth >= 768 ? 'flex-row' : 'flex-col'} h-[100dvh] bg-[#FAFAFA] text-slate-800 font-rajdhani relative overflow-hidden selection:bg-yellow-500/20`}>
            {/* Global Background Effects - Premium White/Gold Theme */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                 {/* Main gradient blobs - Gold/Amber/White */}
                 <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-yellow-200/20 to-amber-100/20 rounded-full blur-[120px] mix-blend-multiply" />
                 <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-gradient-to-tl from-orange-100/30 to-yellow-100/20 rounded-full blur-[120px] mix-blend-multiply" />
                 <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-white rounded-full blur-[80px] opacity-80" />
                 
                 {/* High-tech Grid Overlay */}
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-darken" />
                 <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            {/* Mobile Header - Glassmorphism Premium */}
            <header className={`flex-none sticky ${isLandscape && window.innerWidth >= 768 ? 'left-0 top-0 flex-col border-r border-b-0 w-72 px-4 py-6' : 'top-0 flex-row border-b px-5 h-[72px]'} z-40 bg-white/70 backdrop-blur-xl border-white/50 flex items-center justify-between shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]`}>
                <div className="flex items-center gap-4">
                    {/* Brand Logo / Text */}
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500" />
                        <div className="relative w-10 h-10 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-white/60 flex items-center justify-center shadow-lg shadow-yellow-500/10 ring-1 ring-black/5">
                            <Zap size={20} className="text-yellow-600 fill-yellow-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="font-orbitron font-bold text-xl tracking-tight text-slate-900">
                            {t(getHeaderTitleKey())}
                        </h1>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-yellow-600/80 uppercase tracking-[0.2em]">
                                PREMIUM SCADA
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setShowNoti(v => !v); loadActiveAlerts(); }}
                        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white border border-white/60 shadow-sm hover:shadow-md hover:scale-105 transition-all active:scale-95 group"
                        aria-label="Notifications"
                    >
                        <Bell size={20} className="text-slate-400 group-hover:text-yellow-600 transition-colors" />
                        {activeAlerts.length > 0 && (
                            <span className="absolute top-2 right-2.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActivePanel('menu')}
                        className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-br from-yellow-100 to-white border border-white/60 shadow-sm hover:shadow-md hover:scale-105 transition-all active:scale-95 overflow-hidden"
                        aria-label="Profile"
                    >
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center">
                            <User size={20} className="text-slate-400" />
                        </div>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className={`relative z-10 flex-1 ${isLandscape && window.innerWidth >= 768 ? 'w-auto' : 'w-full'} overflow-x-hidden overflow-y-auto scrollbar-hide`}>
                {children}
            </main>

            {showNoti && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                        onClick={() => setShowNoti(false)}
                    />
                    <div className={`absolute ${isLandscape && window.innerWidth >= 768 ? 'right-auto left-64 top-8' : 'right-4 top-20'} w-[90vw] max-w-[420px] rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl`}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                                    <Bell size={16} className="text-red-600" />
                                </div>
                                <span className="font-bold text-slate-800 text-sm">{t('notifications')} ({allItems.length})</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleMarkAllRead}
                                    className="px-3 py-1 rounded-lg text-xs bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 transition-colors"
                                >
                                    {t('mark_all_read')}
                                </button>
                                <button
                                    onClick={() => setShowNoti(false)}
                                    className="px-3 py-1 rounded-lg text-xs bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors"
                                >
                                    {t('close')}
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
                            {loadingAlerts && (
                                <div className="text-xs text-slate-400 px-2 py-1">{t('loading')}</div>
                            )}
                            {!loadingAlerts && allItems.length === 0 && (
                                <div className="text-xs text-slate-500 px-2 py-1">{t('no_notifications')}</div>
                            )}
                            {allItems.map((al, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl border ${al.isAlert ? 'bg-red-50 border-red-200' : (al.read ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 shadow-sm')}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className={`text-sm font-bold ${al.isAlert ? 'text-red-600' : (al.read ? 'text-slate-500' : 'text-slate-800')}`}>
                                            {al.title || al.type || 'Alert'}
                                        </div>
                                        <span className="text-[10px] text-slate-400">{al.time || al.timestamp || ''}</span>
                                    </div>
                                    <div className="text-xs text-slate-600 mt-1">{al.message || al.desc || ''}</div>
                                    <div className="mt-2 flex gap-2">
                                        {al.isAlert && typeof al.device_id !== 'undefined' && (
                                            <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                {String(al.device_id)}
                                            </span>
                                        )}
                                        {al.isAlert && typeof al.severity !== 'undefined' && (
                                            <span className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 border border-red-200">
                                                {String(al.severity)}
                                            </span>
                                        )}
                                        {!al.isAlert && (
                                            <span className={`text-[10px] px-2 py-1 rounded border ${al.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {al.type || 'info'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <BottomNav />
        </div>
    );
};

export default MobileLayout;
