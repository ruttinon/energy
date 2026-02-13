import React, { useState } from 'react';

import { useApp } from '../context/AppContext';

import MobileLayout from './components/Layout/MobileLayout';
import MobileDashboard from './components/Dashboard/MobileDashboard';
import MobileBilling from './components/Modules/Billing/MobileBilling';
import MobileMonitor from './components/Monitor/MobileMonitor';
import MobileTrends from './components/Modules/Trends/MobileTrends';
import MobileAlarms from './components/Modules/Alarms/MobileAlarms';
import MobileMenu from './components/Layout/MobileMenu';
import MobileConsumption from './components/Modules/Consumption/MobileConsumption';
import MobilePhotoView from './components/Modules/PhotoView/MobilePhotoView';
import MobilePowerStudio from './components/Modules/PowerStudio/MobilePowerStudio';
import MobileAdminDashboard from './components/Admin/MobileAdminDashboard';
import MobileSupport from './components/Modules/Support/MobileSupport';
import MobileProfileSettings from './components/Modules/Profile/MobileProfileSettings';
import MobileServiceCenter from './components/Modules/Service/MobileServiceCenter';
import MobilePayment from './components/Modules/Payment/MobilePayment';
import MobileCostAnalysis from './components/Modules/CostAnalysis/MobileCostAnalysis';
import AnalyticsReports from '../components/Admin/Modules/AnalyticsReports/AnalyticsReports';

const App = () => {
    const { activePanel, isAdminMode, setActivePanel } = useApp();

    const renderContent = () => {
        switch (activePanel) {
            case 'dashboard': return <MobileDashboard />;
            case 'monitor': return <MobileMonitor />;
            case 'trends': return <MobileTrends />;
            case 'alarms': return <MobileAlarms />;
            case 'consumption': return <MobileConsumption />;
            case 'billing': return <MobileBilling />;
            case 'costanalysis': return <MobileCostAnalysis />;
            case 'reports': return <AnalyticsReports />;
            case 'photoview': return <MobilePhotoView />;
            case 'powerstudio': return <MobilePowerStudio />;
            case 'support': return <MobileSupport />;
            case 'profile': return <MobileProfileSettings />;
            case 'payment': return <MobilePayment />;
            case 'service': return <MobileServiceCenter />;
            case 'menu': return <MobileMenu onNavigate={setActivePanel} />;

            default: return <MobileDashboard />;
        }
    };

    if (isAdminMode || (typeof activePanel === 'string' && activePanel.startsWith('admin_'))) {
        return <MobileAdminDashboard />;
    }

    return (
        <MobileLayout>
            {renderContent()}
        </MobileLayout>
    );
};

export default App;
