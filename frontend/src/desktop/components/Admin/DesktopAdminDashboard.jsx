import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useDialog } from '../../../context/DialogContext';
import { getApiBase } from 'services/api';
import {
  LayoutDashboard,
  Server,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Settings,
  ChevronRight,
  Activity,
  LogOut,
  Power,
  Plus,
  Boxes,
  Menu,
  X,
  PieChart
} from 'lucide-react';

// Import Admin Sub-Modules
import AdminOverview from '../../../components/Admin/Modules/Overview/AdminOverview';
import AnalyticsReports from '../../../components/Admin/Modules/AnalyticsReports/AnalyticsReports';
import DeviceManager from './DeviceManager/DeviceManager';
import BillingSettings from '../../../components/Admin/Modules/Billing/BillingSettings';
import MissionControl from '../../../components/Admin/Modules/Alerts/MissionControl';
import SystemCore from '../../../components/Admin/Modules/System/SystemCore';
import ExtensionControl from '../../../components/Admin/Modules/Extension/ExtensionControl';
import PhotoViewEditor from '../../../components/Admin/Modules/PhotoView/PhotoViewEditor';
import UniversalControl from '../../../components/Admin/Modules/Control/UniversalControl';

const DesktopAdminDashboard = () => {
  const navigate = useNavigate();
  const { activePanel, setActivePanel, setIsAdminMode, projects, selectedProject, selectProject, createProject } = useApp();
  const { showConfirm } = useDialog();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectError, setCreateProjectError] = useState('');

  const handleLogout = async () => {
    const confirmed = await showConfirm('ยืนยันการออกจากระบบ', 'คุณต้องการออกจากระบบ Admin ใช่หรือไม่?');
    if (!confirmed) return;
    
    try {
      const API = getApiBase();
      await fetch(`${API}/logout_admin`, { method: 'POST', credentials: 'include' });
    } catch (e) { }
    try {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('isAdminMode');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('selectedProject');
      localStorage.removeItem('selectedProject');
    } catch (e) { }
    setIsAdminMode(false);
    navigate('/login');
  };

  const openCreateProject = () => {
    setCreateProjectError('');
    setCreateProjectName('');
    setCreateProjectOpen(true);
  };

  const closeCreateProject = () => {
    if (creatingProject) return;
    setCreateProjectOpen(false);
    setCreateProjectError('');
    setCreateProjectName('');
  };

  const submitCreateProject = async () => {
    if (creatingProject) return;
    const trimmed = String(createProjectName || '').trim();
    if (!trimmed) {
      setCreateProjectError('กรุณาใส่ชื่อโปรเจกต์');
      return;
    }
    setCreatingProject(true);
    setCreateProjectError('');
    try {
      const res = await createProject(trimmed);
      if (!res?.project_id) {
        setCreateProjectError('สร้างโปรเจกต์ไม่สำเร็จ');
        return;
      }
      setCreateProjectOpen(false);
      setCreateProjectName('');
    } catch (e) {
      setCreateProjectError('สร้างโปรเจกต์ไม่สำเร็จ');
    } finally {
      setCreatingProject(false);
    }
  };

  const MENU_ITEMS = [
    { id: 'admin_overview', label: 'Command Overview', icon: LayoutDashboard },
    { id: 'admin_analytics', label: 'Analytics & Reports', icon: PieChart },
    { id: 'admin_control', label: 'Universal Control', icon: Power },
    { id: 'admin_devices', label: 'Device Manager', icon: Server },
    { id: 'admin_billing', label: 'Fiscal Engine', icon: CreditCard },
    { id: 'admin_alerts', label: 'Mission Control', icon: ShieldAlert },
    { id: 'admin_screens', label: 'PhotoView Editor', icon: Settings },
    { id: 'admin_extension', label: 'Extension Overlay', icon: Activity },
    { id: 'admin_info', label: 'System Core', icon: ShieldCheck },
  ];

  const renderContent = () => {
    switch (activePanel) {
      case 'admin_overview': return <AdminOverview />;
      case 'admin_analytics': return <AnalyticsReports />;
      case 'admin_control': return <UniversalControl />;
      case 'admin_devices': return <DeviceManager />;
      case 'admin_billing': return <BillingSettings />;
      case 'admin_alerts': return <MissionControl />;
      case 'admin_screens': return <PhotoViewEditor />;
      case 'admin_extension': return <ExtensionControl />;
      case 'admin_info': return <SystemCore />;
      default: return <AdminOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-rajdhani overflow-hidden text-sm">
      {/* Desktop Sidebar */}
      <div className={`
        ${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative z-20 shadow-xl shadow-slate-200/50
      `}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold font-orbitron shadow-lg shadow-amber-500/30">
              A
            </div>
            {isSidebarOpen && (
              <div>
                <div className="font-bold font-orbitron text-slate-800 tracking-wider">ADMIN</div>
                <div className="text-[8px] text-slate-400 uppercase tracking-widest">DESKTOP v2.0</div>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 space-y-1 px-3 scrollbar-hide">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative overflow-hidden
                ${activePanel === item.id
                  ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}
              `}
            >
              <div className="relative z-10">
                <item.icon size={18} className={activePanel === item.id ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'} />
              </div>
              {isSidebarOpen && (
                <>
                  <span className={`text-xs font-bold uppercase tracking-wider ${activePanel === item.id ? 'font-orbitron' : 'font-rajdhani'}`}>
                    {item.label}
                  </span>
                  {activePanel === item.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all uppercase font-bold text-xs tracking-widest"
          >
            <LogOut size={16} />
            {isSidebarOpen && "Exit"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-50">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-100" />

        {/* Top Bar */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-8 relative z-10 bg-white/80 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-500 hover:text-slate-800 transition-colors hover:bg-slate-100 rounded-lg"
              >
                <Menu size={20} />
              </button>
            )}
            
            <div className="h-6 w-px bg-slate-200" />

            {/* Project Selector */}
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Site:</div>
              <div className="relative group">
                <select
                  value={selectedProject || ''}
                  onChange={(e) => selectProject(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none cursor-pointer min-w-[200px] hover:bg-slate-50 transition-colors shadow-sm"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={14} />
              </div>
              <button
                onClick={openCreateProject}
                disabled={creatingProject}
                className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Add Project"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2 ml-auto">
            Status: <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE</span>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-hidden relative z-10 ${(activePanel === 'admin_screens' || activePanel === 'admin_devices') ? 'p-0' : 'p-4 md:p-8'}`}>
          <div className={`h-full w-full animate-in fade-in duration-500 slide-in-from-bottom-2 ${(activePanel === 'admin_screens' || activePanel === 'admin_devices') ? '' : 'max-w-7xl mx-auto'}`}>
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {createProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="text-xs font-bold font-orbitron text-amber-600 uppercase tracking-widest">Create Project</div>
              <button
                onClick={closeCreateProject}
                disabled={creatingProject}
                className="text-slate-400 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Project Name</div>
                <input
                  value={createProjectName}
                  onChange={(e) => setCreateProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreateProject();
                    if (e.key === 'Escape') closeCreateProject();
                  }}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
                  placeholder="เช่น CPRAM"
                />
              </div>
              {createProjectError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{createProjectError}</div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeCreateProject}
                  disabled={creatingProject}
                  className="px-4 py-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCreateProject}
                  disabled={creatingProject}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-widest"
                >
                  {creatingProject ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopAdminDashboard;