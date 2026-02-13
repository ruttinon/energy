import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Zap, LogOut, ShieldAlert } from 'lucide-react';
import { getApiBase } from 'services/api';

export default function Header() {
    const navigate = useNavigate();
    const { projectName, lastUpdate, isAdminMode, setActivePanel, projects, selectedProject, selectProject } = useApp();

    const handleLogout = () => {
        if (!confirm('TERMINATE SESSION?')) return;
        (async () => {
            try {
                const API = getApiBase();
                await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
            } catch (e) { }
            
            // Clear storage
            sessionStorage.clear();
            localStorage.removeItem('selectedProject');
            localStorage.removeItem('selectedDevice');
            
            window.location.href = '/login';
        })();
    };

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-50 sticky top-0 shadow-sm shadow-slate-200/50">
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Zap size={18} className="text-white" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-bold text-lg tracking-wider font-orbitron">ENERGYLINK</span>
                        <span className="text-[10px] text-yellow-600 tracking-[3px] font-bold uppercase">AI Command</span>
                    </div>
                </div>
                {projectName && (
                    <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-200 h-8">
                        <span className="text-slate-500 font-medium text-sm">
                            {projectName}
                        </span>
                    </div>
                )}
            </div>

            {/* Center Project Selector */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:block">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm shadow-slate-200/50 group hover:border-yellow-400 transition-all">
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Active Project</span>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <select
                        value={selectedProject || ''}
                        onChange={(e) => {
                            if (selectProject) selectProject(e.target.value);
                            // Optional: Refresh page if needed for full context switch
                        }}
                        className="bg-transparent border-none text-slate-700 font-semibold text-sm focus:ring-0 cursor-pointer min-w-[150px] text-center outline-none appearance-none hover:text-yellow-600 transition-colors"
                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-3">
                {isAdminMode && (
                    <div className="flex items-center gap-2 mr-2">
                        <button
                            className="px-3 py-1.5 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-600 text-[10px] font-bold tracking-wider hover:bg-cyan-100 transition-colors"
                            onClick={() => setActivePanel('admin_extension')}
                        >
                            EXTENSION
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-full border border-yellow-200 bg-yellow-50 text-yellow-600 text-[10px] font-bold tracking-wider hover:bg-yellow-100 transition-colors"
                            onClick={() => setActivePanel('admin_quickcontrol')}
                        >
                            CONTROL
                        </button>
                    </div>
                )}
                <button
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-100 bg-red-50 text-red-500 text-[10px] font-bold tracking-wider hover:bg-red-100 hover:border-red-200 transition-all shadow-sm"
                    onClick={handleLogout}
                >
                    <LogOut size={14} />
                    <span>LOGOUT</span>
                </button>
            </div>
        </header>
    );
}
