import React from 'react';
import { useApp } from '../../../context/AppContext';
import { 
    User, Settings, LogOut, ChevronRight, 
    Zap, Database, FileText,
    Shield, CreditCard, Bell, QrCode, Wrench, TrendingUp
} from 'lucide-react';

const MobileMenu = ({ onNavigate }) => {
    const { user, logout, t, sessionStart, sessionId, projectName } = useApp();

    const formatDuration = (start) => {
        const diff = Math.max(0, Date.now() - (start || Date.now()));
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    const menuItems = [
        { 
            section_key: 'core_modules',
            items: [
                { id: 'consumption', label_key: 'energy_consumption', icon: Zap },
                { id: 'costanalysis', label_key: 'cost_analysis', icon: TrendingUp },
                { id: 'reports', label_key: 'analytics_reports', icon: FileText },
                { id: 'powerstudio', label_key: 'power_studio', icon: Database },
                { id: 'payment', label_key: 'payment', icon: QrCode },
                { id: 'service', label_key: 'service', icon: Wrench }
            ]
        },
        {
            section_key: 'system_settings',
            items: [
                { id: 'profile', label_key: 'profile_settings', icon: User },
                { id: 'billing', label_key: 'billing_and_payments', icon: CreditCard },
                { id: 'support', label_key: 'support_ticket', icon: Shield },
                { id: 'alarms', label_key: 'notifications', icon: Bell }
            ]
        }
    ];

    // Reusable Glass Card Component (Updated to White Gold Theme)
    const GlassCard = ({ children, className = "", onClick }) => (
        <div 
            onClick={onClick}
            className={`relative bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] p-5 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(234,179,8,0.15)] transition-all duration-500 group ${className}`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-yellow-50/20 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-yellow-400/10 to-amber-300/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10">{children}</div>
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full p-4 gap-6 pb-40 relative overflow-visible font-rajdhani">
            {/* Background Decorations for Menu - Extra Premium Layers */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-yellow-200/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-20 left-[-50px] w-48 h-48 bg-gradient-to-tr from-amber-100/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
            
            {/* User Profile Card - Premium Glass */}
            <GlassCard 
                onClick={() => onNavigate && onNavigate('profile')}
                className="cursor-pointer active:scale-[0.98] border-yellow-500/10 hover:border-yellow-500/30"
            >
                {/* Premium Glow Effects */}
                <div className="absolute top-4 right-4 opacity-5 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">
                    <User size={100} className="text-yellow-900" />
                </div>
                
                <div className="flex items-center gap-5">
                    {/* Avatar Container with Ring */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full blur-md opacity-30 animate-pulse" />
                        <div className="w-18 h-18 p-[2px] rounded-full bg-gradient-to-tr from-yellow-100 to-amber-200 shadow-inner">
                            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-yellow-600 relative overflow-hidden border border-white/50">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={32} />
                                )}
                            </div>
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-[3px] border-white rounded-full shadow-sm" />
                    </div>
                    
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-wide group-hover:text-yellow-700 transition-colors">
                            {user?.display_name || user?.username || 'Administrator'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                             <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 border border-yellow-100 uppercase tracking-wider shadow-sm">
                                {user?.role || 'Super User'}
                             </span>
                             {projectName && (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/50 text-slate-600 border border-slate-100 uppercase truncate max-w-[120px] backdrop-blur-sm">
                                    {projectName}
                                </span>
                             )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100/50 pt-4 bg-white/30 rounded-xl px-2 pb-1 -mx-2">
                    <div className="text-center flex-1">
                        <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">{t('session_label')}</div>
                        <div className="text-slate-700 font-mono text-xs font-medium bg-white/50 rounded py-0.5">{formatDuration(sessionStart)}</div>
                    </div>
                    <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-slate-200 to-transparent" />
                    <div className="text-center flex-1">
                        <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">{t('status_label')}</div>
                        <div className={`${user ? 'text-emerald-600' : 'text-slate-500'} font-bold text-xs bg-emerald-50/50 rounded py-0.5 px-2 inline-block`}>
                            {t(user ? 'active_label' : 'offline_label')}
                        </div>
                    </div>
                    <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-slate-200 to-transparent" />
                    <div className="text-center flex-1">
                        <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">{t('id_label')}</div>
                        <div className="text-slate-500 font-mono text-xs bg-white/50 rounded py-0.5">#{sessionId || '-'}</div>
                    </div>
                </div>
            </GlassCard>

            {/* Menu Sections */}
            {menuItems.map((section, idx) => (
                <div key={idx} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 ml-4 flex items-center gap-3">
                        <div className="h-[1px] w-4 bg-yellow-500/30" />
                        {t(section.section_key)}
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-yellow-500/30 to-transparent" />
                    </h3>
                    <div className="space-y-3">
                        {section.items.map((item, itemIdx) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate && onNavigate(item.id)}
                                    className="w-full flex items-center justify-between p-3.5 rounded-[1.2rem] bg-white/60 backdrop-blur-md border border-white/60 hover:bg-gradient-to-r hover:from-white hover:to-yellow-50/40 hover:border-yellow-300/50 transition-all duration-300 group active:scale-[0.98] shadow-sm hover:shadow-lg hover:shadow-yellow-500/10"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm bg-gradient-to-br from-white to-slate-50 border border-white shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] group-hover:border-yellow-200">
                                            <Icon size={20} className="text-slate-500 group-hover:text-yellow-600 transition-colors" />
                                        </div>
                                        <span className="text-[15px] font-semibold text-slate-700 group-hover:text-slate-900 tracking-wide">
                                            {t(item.label_key)}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center group-hover:translate-x-1 transition-transform duration-300 group-hover:bg-yellow-50">
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-yellow-600" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Logout Button */}
            <button
                onClick={logout}
                className="mt-6 w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/40 border border-red-100/50 text-red-500 hover:bg-red-50/50 hover:border-red-200 hover:text-red-600 transition-all hover:shadow-lg hover:shadow-red-500/5 active:scale-[0.98] backdrop-blur-sm group"
            >
                <div className="p-2 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                    <LogOut size={18} />
                </div>
                <span className="font-bold text-sm tracking-widest uppercase">{t('logout')}</span>
            </button>
            
            <div className="text-center mt-4 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/50 border border-slate-200/50 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                        EL3 MOBILE v3.0.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MobileMenu;
