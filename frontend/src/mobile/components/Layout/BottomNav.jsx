import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, 
    Activity,
    Menu,
    CreditCard
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const BottomNav = () => {
    const { activePanel, setActivePanel, t } = useApp();
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

    const navItems = [
        { id: 'dashboard', labelKey: 'home', icon: LayoutDashboard },
        { id: 'monitor', labelKey: 'monitor_label', icon: Activity },
        { id: 'billing', labelKey: 'billing', icon: CreditCard },
        { id: 'menu', labelKey: 'menu', icon: Menu }, 
    ];

    return (
        <div className={`fixed ${isLandscape && window.innerWidth >= 768 ? 'left-0 bottom-0 top-16 w-72 h-auto flex-col px-4 py-6 border-r' : 'bottom-0 left-0 right-0 h-[88px] flex-row pb-6 pt-2 px-6 border-t'} bg-white/80 backdrop-blur-2xl border-white/50 flex items-center justify-around z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]`}>
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePanel === item.id;
                
                return (
                    <button
                        key={item.id}
                        onClick={() => setActivePanel(item.id)}
                        className={`group flex ${isLandscape && window.innerWidth >= 768 ? 'flex-row gap-4 justify-start px-5 w-full rounded-2xl mb-2 py-4' : 'flex-col items-center justify-center'} flex-1 h-full transition-all duration-500 relative ${
                            isActive 
                                ? 'text-slate-900' 
                                : 'text-slate-400 hover:text-slate-600'
                        } ${isActive && isLandscape && window.innerWidth >= 768 ? 'bg-gradient-to-r from-yellow-50 to-white shadow-sm ring-1 ring-yellow-100' : ''}`}
                    >
                        {/* Active Indicator (Mobile Bottom) */}
                        {!isLandscape && isActive && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-b-full shadow-[0_2px_10px_rgba(251,191,36,0.5)]" />
                        )}
                        
                        {/* Active Indicator (Desktop Side) */}
                        {isLandscape && window.innerWidth >= 768 && isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-r-full shadow-[2px_0_10px_rgba(251,191,36,0.3)]" />
                        )}
                        
                        {/* Icon Container */}
                        <div className={`relative p-2.5 rounded-2xl transition-all duration-500 ${
                            isActive 
                                ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30 translate-y-[-4px]' 
                                : 'bg-transparent group-hover:bg-slate-100'
                        }`}>
                            <Icon size={24} strokeWidth={isActive ? 2 : 2} className={`transition-transform duration-500 ${isActive ? 'scale-100' : 'scale-90'}`} />
                        </div>
                        
                        <span className={`text-[10px] font-bold tracking-widest mt-2 transition-all duration-500 ${
                            isActive ? 'opacity-100 translate-y-[-2px] text-yellow-700' : 'opacity-60 font-medium'
                        }`}>
                            {t(item.labelKey).toUpperCase()}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNav;
