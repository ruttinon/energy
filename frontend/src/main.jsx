import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './mobile/App.jsx'
import DesktopApp from './desktop/App.jsx'
import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '../LoginPage.jsx'
import { AppProvider } from './context/AppContext'
import { ControlProvider } from './context/ControlContext'
import { DialogProvider } from './context/DialogContext'

// --- Import Desktop Styles ---
// These are imported here to ensure they are available when DesktopApp is active.
// Note: This might cause some style bleeding depending on how specific the CSS selectors are.
// Ideally, these should be scoped or imported dynamically, but for now we import them globally.
import './styles/user/dashboard/base-module.css'
import './styles/user/dashboard/energy-module.css'
import './styles/user/dashboard/overview-module.css'
import './styles/user/dashboard/power-module.css'
import './styles/user/dashboard/quality-module.css'
import './styles/user/dashboard/responsive-fixes.css'
import './styles/user/dashboard/summary-module.css'
import './styles/user/dashboard/ui-module.css'
import './styles/user/consumption/consumption.css'
import './styles/user/traebds/trend.css'
import './styles/user/photoview/photoview_user.css'
import './styles/user/alarms/User Alert.css'
import './styles/admin/admincss/control_room.css'
import './styles/admin/admincss/admin_overview.css'
import './styles/admin/admincss/edit.css'
import './styles/admin/billing/billing_admin.css'
import './styles/admin/photoview_admin/photoview_admin.css'
import './styles/admin/report_admin/report_admin.css'

const MainRoot = () => {
    // Updated Requirement: Mobile UI should support iPads and Tablets.
    // iPad Pro 12.9 landscape is 1366px.
    // Standard Desktop starts around 1280px (Laptop), but we want tablets to use Mobile UI.
    // Let's set a safe breakpoint. If it's a touch device or width <= 1366px, use Mobile UI? 
    // For now, let's revert to the higher breakpoint of 1100px or even 1200px to cover most tablets in portrait/landscape.
    // iPad Air is 1180px in landscape.
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1200);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1200);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isMobile) {
        return <DesktopApp />;
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<App />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AppProvider>
                <ControlProvider>
                    <DialogProvider>
                        <MainRoot />
                    </DialogProvider>
                </ControlProvider>
            </AppProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
