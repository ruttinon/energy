import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import EnergyLinkLogin from './Login';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import MonitorDashboard from './components/Monitor/MonitorDashboard';
import TrendModule from './components/Modules/Trends/TrendModule';
import AlarmModule from './components/Modules/Alarms/AlarmModule';
import ConsumptionMonitor from './components/Modules/Consumption/ConsumptionMonitor';
import BillingModule from './components/Modules/Billing/BillingModule';
import PhotoViewModule from './components/Modules/PhotoView/PhotoViewModule';
import AnalyticsReports from '../components/Admin/Modules/AnalyticsReports/AnalyticsReports';
import AdminDashboard from './components/Admin/DesktopAdminDashboard';

import { useApp } from '../context/AppContext';

import PowerStudioAdmin from './components/Modules/PowerStudio/PowerStudioAdmin';

const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const AppLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { activePanel, isAdminMode } = useApp();

    const renderContent = () => {
        switch (activePanel) {
            // User Panels
            case 'dashboard': return <Dashboard />;
            case 'monitor': return <MonitorDashboard />;
            case 'trends': return <TrendModule />;
            case 'alarms': return <AlarmModule />;
            case 'consumption': return <ConsumptionMonitor />;
            case 'billing': return <BillingModule />;
            case 'reports': return <AnalyticsReports />;
            case 'photoview': return <PhotoViewModule />;

            default: return <Dashboard />;
        }
    };

    // If in Admin Mode, render the dedicated Admin Console layout (Full Screen)
    if (isAdminMode || (typeof activePanel === 'string' && activePanel.startsWith('admin_'))) {
        return <AdminDashboard />;
    }

    // Otherwise, render the Standard User Layout
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-rajdhani text-slate-800 selection:bg-yellow-200 selection:text-yellow-900">
            {/* Background Texture/Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                 <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-500/5 rounded-full blur-[120px]" />
                 <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/5 rounded-full blur-[120px]" />
                 <div className="absolute inset-0 bg-[url('/img/grid.svg')] opacity-[0.03] bg-center [mask-image:linear-gradient(180deg,white,transparent)]" />
            </div>

            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

            <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden transition-all duration-300">
                <Header isCollapsed={isCollapsed} />
                
                <main className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

const App = () => {
    return (
        <Routes>
            <Route path="/login" element={<EnergyLinkLogin />} />
            <Route path="/app/*" element={
                <ProtectedRoute>
                    <AppLayout />
                </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
    );
};

export default App;
