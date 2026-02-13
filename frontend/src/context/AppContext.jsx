import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { getApiBase } from 'services/api';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [activePanel, setActivePanel] = useState('dashboard'); // dashboard, monitor, trends, alarms, consumption, billing, photoview, admin_overview, admin_devices, admin_screens, admin_alerts, admin_reports, admin_info
    const [user, setUser] = useState(null);
    const [sessionStart, setSessionStart] = useState(() => {
        if (typeof window === 'undefined') return Date.now();
        const s = sessionStorage.getItem('session_start_ts');
        if (s) return Number(s) || Date.now();
        const now = Date.now();
        sessionStorage.setItem('session_start_ts', String(now));
        return now;
    });
    const [sessionId, setSessionId] = useState(() => {
        if (typeof window === 'undefined') return '';
        const sid = sessionStorage.getItem('session_id');
        if (sid) return sid;
        const newId = String(Math.floor(1000 + Math.random() * 9000));
        sessionStorage.setItem('session_id', newId);
        return newId;
    });
    const [language, setLanguage] = useState(() => {
        if (typeof window === 'undefined') return 'th';
        const saved = localStorage.getItem('app_language');
        return saved || 'th';
    });
    const [isAdminMode, setIsAdminMode] = useState(() => {
        if (typeof window === 'undefined') return false;
        // Priority: Session (Tab-specific) > Local (Browser-wide fallback)
        const sessionVal = sessionStorage.getItem('isAdminMode');
        if (sessionVal !== null) return sessionVal === '1';

        const localVal = localStorage.getItem('isAdminMode');
        return localVal === '1';
    });

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectName, setProjectName] = useState('LOADING...');
    const [devices, setDevices] = useState([]);
    const [readings, setReadings] = useState([]);
    const [lastUpdate, setLastUpdate] = useState('--:--:--');
    const [selectedDevice, setSelectedDevice] = useState(localStorage.getItem('selectedDevice') || '');
    const [selectedConverter, setSelectedConverter] = useState('');
    const [deviceStatus, setDeviceStatus] = useState({});
    const [billingSummary, setBillingSummary] = useState(null);

    // Persistent cache for readings to prevent flickering using TTL
    const readingsCache = useRef({});
    const lastReadingsErrorTs = useRef(0);

    // Initialize Projects
    const fetchProjects = async () => {
        const API = getApiBase();
        try {
            // Use public endpoint to avoid auth issues during initial load
            const res = await fetch(`${API}/public/projects`);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Invalid JSON from /public/projects');
            const data = await res.json();

            const mapped = (data.projects || []).map(p => ({
                id: p.project_id,
                name: p.project_name || p.project_id
            }));
            setProjects(mapped);

            // Get active project from session/backend via public endpoint if available, or session
            // Priority: URL Param > SessionStorage > LocalStorage > Global Server Default > First available
            const urlPid = new URLSearchParams(window.location.search).get('pid');
            const sessionPid = sessionStorage.getItem('selectedProject');
            const localPid = localStorage.getItem('selectedProject');

            // We verify data.active (Global) only as a last resort fallback
            let activePid = urlPid || sessionPid || localPid || data.active;

            if (!activePid && mapped.length > 0) {
                activePid = mapped[0].id;
            }

            // Validate that activePid exists in available projects; if not, fallback to first
            const availableIds = new Set(mapped.map(p => p.id));
            if (activePid && !availableIds.has(activePid)) {
                activePid = mapped.length > 0 ? mapped[0].id : null;
            }

            if (activePid) {
                setSelectedProject(activePid);
                sessionStorage.setItem('selectedProject', activePid); // Ensure session has it
                if (activePid !== localPid) localStorage.setItem('selectedProject', activePid); // Upkeep local

                // Ensure URL matches (silent update)
                const currentUrl = new URL(window.location);
                if (currentUrl.searchParams.get('pid') !== activePid) {
                    currentUrl.searchParams.set('pid', activePid);
                    window.history.replaceState({}, '', currentUrl);
                }

                const p = mapped.find(x => x.id === activePid);
                if (p) setProjectName(p.name);
                try {
                    const infoRes = await fetch(`${API}/public/projects/${encodeURIComponent(activePid)}/info`);
                    if (infoRes.ok) {
                        const info = await infoRes.json();
                        if (info?.project_name) setProjectName(info.project_name);
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (err) {
            console.error('Failed to load projects:', err);
            setProjects([]); // No fallback, strictly use backend data
        }
    };

    const selectProject = async (pid) => {
        // REMOVED GLOBAL BACKEND CALL to prevent session cross-contamination

        setSelectedProject(pid);
        sessionStorage.setItem('selectedProject', pid);
        localStorage.setItem('selectedProject', pid);

        // Update URL so refresh keeps the same project
        const url = new URL(window.location);
        url.searchParams.set('pid', pid);
        window.history.pushState({}, '', url);

        const p = projects.find(x => x.id === pid);
        if (p) setProjectName(p.name);
    };

    useEffect(() => {
        fetchProjects();
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'admin') setIsAdminMode(true);
        const s = sessionStorage.getItem('session_start_ts');
        if (!s) {
            const now = Date.now();
            sessionStorage.setItem('session_start_ts', String(now));
            setSessionStart(now);
        }
    }, []);

    // Ensure activePanel matches Admin Mode state
    useEffect(() => {
        if (isAdminMode && !(typeof activePanel === 'string' && activePanel.startsWith('admin_'))) {
            setActivePanel('admin_devices');
        } else if (!isAdminMode && (typeof activePanel === 'string' && activePanel.startsWith('admin_'))) {
            setActivePanel('dashboard');
        }
    }, [isAdminMode]);

    // Load Devices when project changes
    useEffect(() => {
        if (!selectedProject) return;
        const API = getApiBase();
        const fetchDevices = async () => {
            try {
                const res = await fetch(`${API}/public/projects/${encodeURIComponent(selectedProject)}/devices`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) throw new Error('Invalid JSON from /public devices');
                const data = await res.json();
                const devList = (data.devices || []).map(d => ({
                    id: String(d.id),
                    name: d.name,
                    converter: d.converter,
                    converter_index: d.converter_index,
                    meta_serial: d.meta_serial,
                    meta_panel: d.meta_panel,
                    meta_ct: d.meta_ct,
                    type: d.type,
                    modbus_ip: d.modbus_ip,
                    modbus_port: d.modbus_port,
                    modbus_slave: d.modbus_slave || d.address
                }));
                setDevices(devList);
                console.log('[AppContext] Devices fetched:', devList);

                // Set project name from public info to ensure accuracy
                try {
                    const infoRes = await fetch(`${API}/public/projects/${encodeURIComponent(selectedProject)}/info`);
                    if (infoRes.ok) {
                        const info = await infoRes.json();
                        if (info?.project_name) setProjectName(info.project_name);
                    } else {
                        const p = projects.find(x => x.id === selectedProject);
                        if (p) setProjectName(p.name || selectedProject);
                    }
                } catch (e) {
                    const p = projects.find(x => x.id === selectedProject);
                    if (p) setProjectName(p.name || selectedProject);
                }
            } catch (err) {
                console.error('Failed to fetch devices:', err);
            }
        };
        fetchDevices();
    }, [selectedProject, projects]);

    const fetchReadings = async () => {
        if (!selectedProject) return;
        const API = getApiBase();
        try {
            const res = await fetch(`${API}/public/projects/${encodeURIComponent(selectedProject)}/readings`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Invalid JSON from /public readings');
            const data = await res.json();
            const now = Date.now();
            const ttlMs = 8000;

            // Use Persistent Ref Cache
            const cache = readingsCache.current;

            const incoming = Array.isArray(data.items) ? data.items : [];
            const out = [];
            const seen = new Set();
            for (const it of incoming) {
                const did = String(it.device_id || '');
                const p = String(it.parameter || '');
                const val = it.value;
                const ts = Date.parse(it.timestamp || '') || now;
                const metaUnit = it.unit || '';
                const metaDesc = it.description || '';
                const metaName = it.device_name || '';
                const devInfo = devices.find(d => String(d.id) === did);
                const convName = (devInfo && devInfo.converter) ? String(devInfo.converter) : '';
                if (!cache[did]) cache[did] = {};
                // if (!cache[did][p]) cache[did][p] = { value: null, ts: 0, unit: metaUnit, description: metaDesc, device_name: metaName, converter: convName };

                if (val !== null && val !== undefined) {
                    cache[did][p] = { value: val, ts, unit: metaUnit, description: metaDesc, device_name: metaName, converter: convName };
                    out.push({ ...it, converter: convName, _ts: ts });
                    seen.add(did + '|' + p);
                } else {
                    const prev = cache[did][p];
                    if (prev && now - prev.ts <= ttlMs && prev.value !== null && prev.value !== undefined) {
                        out.push({ ...it, value: prev.value, unit: prev.unit, description: prev.description, device_name: prev.device_name, converter: prev.converter || convName, timestamp: new Date(prev.ts).toLocaleString(), _ts: prev.ts });
                        seen.add(did + '|' + p);
                    } else {
                        // Keep providing structure even if value is missing, if we had it before?
                        // No, push invalid/empty usually means we rely on device list iteration downstream.
                        // But for compatibility, let's just push what we have.
                        out.push({ ...it, converter: convName, _ts: ts });
                        seen.add(did + '|' + p);
                    }
                }
            }

            // Fill gaps from cache
            for (const did of Object.keys(cache)) {
                for (const p of Object.keys(cache[did])) {
                    const k = did + '|' + p;
                    if (!seen.has(k)) {
                        const prev = cache[did][p];
                        if (prev && now - prev.ts <= ttlMs && prev.value !== null && prev.value !== undefined) {
                            out.push({
                                device_id: did,
                                device_name: prev.device_name || '',
                                parameter: p,
                                value: prev.value,
                                unit: prev.unit || '',
                                description: prev.description || '',
                                converter: prev.converter || '',
                                timestamp: new Date(prev.ts).toLocaleString()
                            });
                        }
                    }
                }
            }
            setReadings(out);
            setLastUpdate(new Date().toLocaleTimeString());
            console.log('[AppContext] Readings fetched:', out);
        } catch (err) {
            try {
                const devIds = devices.map(d => String(d.id));
                const res2 = await fetch(`${API}/photoview/${encodeURIComponent(selectedProject)}/readings/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(devIds)
                });
                const j = await res2.json();
                const dataMap = j.data || {};
                const now2 = Date.now();
                const cache2 = readingsCache.current;
                const out2 = [];
                for (const did of Object.keys(dataMap)) {
                    const devMap = dataMap[did] || {};
                    if (!cache2[did]) cache2[did] = {};
                    const devInfo = devices.find(d => String(d.id) === did);
                    const convName = (devInfo && devInfo.converter) ? String(devInfo.converter) : '';
                    for (const p of Object.keys(devMap)) {
                        const val = devMap[p];
                        cache2[did][p] = { value: val, ts: now2, unit: '', description: '', device_name: devInfo?.name || '', converter: convName };
                        out2.push({ device_id: did, device_name: devInfo?.name || '', parameter: p, value: val, unit: '', description: '', converter: convName, timestamp: new Date(now2).toLocaleString(), _ts: now2 });
                    }
                }
                setReadings(out2);
                setLastUpdate(new Date().toLocaleTimeString());
            } catch (e) {
                const nowTs = Date.now();
                if (nowTs - lastReadingsErrorTs.current > 10000) {
                    console.error('Failed to fetch readings:', err);
                    lastReadingsErrorTs.current = nowTs;
                }
            }
        }
    };

    const fetchStatus = async () => {
        if (!selectedProject) return;
        const API = getApiBase();
        try {
            const res = await fetch(`${API}/public/projects/${encodeURIComponent(selectedProject)}/status`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Invalid JSON from /public/status');
            const data = await res.json();

            const statusMap = {};
            (data.devices || []).forEach(d => {
                statusMap[d.device_id] = d.status;
            });
            setDeviceStatus(statusMap);
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    };

    const fetchBilling = async () => {
        if (!selectedProject) return;
        const API = getApiBase();
        try {
            // Updated to use the correct endpoint /api/billing/summary
            const res = await fetch(`${API}/billing/summary?project_id=${encodeURIComponent(selectedProject)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Invalid JSON from /billing/summary');
            const data = await res.json();
            setBillingSummary(data.data);
        } catch (err) {
            console.error('Failed to fetch billing:', err);
        }
    };

    // Polling
    useEffect(() => {
        if (!selectedProject) return;
        fetchReadings();
        fetchStatus();
        fetchBilling();
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchReadings();
                fetchStatus();
                fetchBilling();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [selectedProject]);

    // Derived States
    const converters = useMemo(() => {
        return Array.from(new Set(devices.map(d => d.converter).filter(Boolean)));
    }, [devices]);

    const readingsByDevice = useMemo(() => {
        const map = {};
        readings.forEach(r => {
            if (!map[r.device_id]) map[r.device_id] = { ts: 0 };
            map[r.device_id][r.parameter] = r.value;
            // Aggregate timestamp to find latest for device
            if (r._ts && r._ts > map[r.device_id].ts) {
                map[r.device_id].ts = r._ts;
            }
        });
        console.log('[AppContext] readingsByDevice:', map);
        return map;
    }, [readings]);

    const translations = useMemo(() => ({
        th: {
            app_title: 'ENERGY LINK',
            live_monitor: 'LIVE MONITOR',
            billing: 'BILLING',
            trends: 'TRENDS',
            home: 'หน้าหลัก',
            monitor_label: 'มอนิเตอร์',
            notifications: 'การแจ้งเตือน',
            system_alerts_logs: 'การแจ้งเตือนของระบบ & บันทึก',
            menu: 'เมนู',
            mark_all_read: 'อ่านทั้งหมด',
            close: 'ปิด',
            loading: 'กำลังโหลด...',
            no_notifications: 'ยังไม่มีการแจ้งเตือน',
            no_alarms_found: 'ไม่พบการแจ้งเตือน',
            session_label: 'เซสชัน',
            status_label: 'สถานะ',
            id_label: 'ไอดี',
            active_label: 'ใช้งานอยู่',
            offline_label: 'ออฟไลน์',
            personal_info: 'ข้อมูลส่วนตัว',
            notify_and_app: 'การแจ้งเตือน & แอป',
            security: 'ความปลอดภัย',
            change_password: 'เปลี่ยนรหัสผ่าน',
            current_password: 'รหัสผ่านปัจจุบัน',
            new_password: 'รหัสผ่านใหม่',
            confirm_new_password: 'ยืนยันรหัสผ่านใหม่',
            save_changes: 'บันทึกการเปลี่ยนแปลง',
            logout: 'ออกจากระบบ',
            email_notify: 'แจ้งเตือนผ่านอีเมล',
            push_notify: 'Push Notification',
            full_name: 'ชื่อ-นามสกุล',
            phone_number: 'เบอร์โทรศัพท์',
            email: 'อีเมล',
            language_label: 'ภาษา',
            thai_label: 'ภาษาไทย (Thai)',
            english_label: 'English',
            welcome_back: 'WELCOME BACK',
            hello: 'สวัสดี',
            system_status: 'สถานะระบบ',
            total_power: 'พลังงานรวม',
            energy_consumption: 'การใช้พลังงาน',
            cost_analysis: 'วิเคราะห์ต้นทุน',
            analytics_reports: 'รายงานวิเคราะห์',
            power_studio: 'พาวเวอร์สตูดิโอ',
            payment: 'การชำระเงิน',
            service: 'การบริการ',
            profile_settings: 'ตั้งค่าโปรไฟล์',
            billing_and_payments: 'บิล & การชำระเงิน',
            support_ticket: 'ทิกเก็ตสนับสนุน',
            app_settings: 'ตั้งค่าแอป',
            core_modules: 'โมดูลหลัก',
            system_settings: 'การตั้งค่าระบบ',
            unpaid_invoice: 'ใบแจ้งหนี้ค้างชำระ',
            current_usage_estimate: 'ประมาณการการใช้งานปัจจุบัน',
            checking: 'กำลังตรวจสอบ',
            unpaid: 'ค้างชำระ',
            live: 'สด',
            total_amount: 'ยอดรวม',
            due: 'กำหนดชำระ',
            ref: 'เลขอ้างอิง',
            usage: 'การใช้',
            rate: 'อัตรา',
            pay_now: 'ชำระตอนนี้',
            no_due_bills: 'ไม่มีบิลค้างชำระ',
            details: 'รายละเอียด',
            vs_last_month: 'เทียบกับเดือนก่อน',
            improved: 'ปรับปรุง',
            billing_hub: 'ศูนย์บิล',
            secure_payment_gateway: 'ระบบชำระเงินปลอดภัย',
            pay_bill: 'ชำระบิล',
            history: 'ประวัติ',
            unbilled_usage_estimate: 'ประมาณการการใช้ที่ยังไม่ออกบิล',
            tariff: 'อัตรา',
            estimate_note: 'คำนวณจากข้อมูลมิเตอร์แบบเรียลไทม์',
            pending_invoices: 'บิลที่ค้างชำระ',
            due_short: 'ค้าง',
            all_clear: 'เคลียร์ทั้งหมด',
            no_outstanding: 'ไม่มีบิลค้างชำระในขณะนี้',
            verified: 'ตรวจสอบแล้ว',
            reviewing: 'กำลังตรวจสอบ',
            rejected: 'ปฏิเสธ',
            summary: 'สรุป',
            overview: 'ภาพรวม',
            power: 'พลังงาน',
            energy: 'พลังงานไฟฟ้า',
            quality: 'คุณภาพไฟฟ้า',
            iv_tab: 'I/V',
            all: 'ทั้งหมด',
            critical: 'วิกฤติ',
            warning: 'เตือน'
        },
        en: {
            app_title: 'ENERGY LINK',
            live_monitor: 'LIVE MONITOR',
            billing: 'BILLING',
            trends: 'TRENDS',
            home: 'Home',
            monitor_label: 'Monitor',
            notifications: 'Notifications',
            system_alerts_logs: 'System Alerts & Logs',
            menu: 'Menu',
            mark_all_read: 'Mark all read',
            close: 'Close',
            loading: 'Loading...',
            no_notifications: 'No notifications',
            no_alarms_found: 'No alarms found',
            session_label: 'Session',
            status_label: 'Status',
            id_label: 'ID',
            active_label: 'Active',
            offline_label: 'Offline',
            personal_info: 'Personal Information',
            notify_and_app: 'Notifications & App',
            security: 'Security',
            change_password: 'Change Password',
            current_password: 'Current Password',
            new_password: 'New Password',
            confirm_new_password: 'Confirm New Password',
            save_changes: 'Save Changes',
            logout: 'Sign Out',
            email_notify: 'Email Notifications',
            push_notify: 'Push Notification',
            full_name: 'Full Name',
            phone_number: 'Phone Number',
            email: 'Email',
            language_label: 'Language',
            thai_label: 'Thai',
            english_label: 'English',
            welcome_back: 'WELCOME BACK',
            hello: 'Hello',
            system_status: 'System Status',
            total_power: 'Total Power',
            energy_consumption: 'Energy Consumption',
            cost_analysis: 'Cost Analysis',
            analytics_reports: 'Analytics Reports',
            power_studio: 'Power Studio',
            payment: 'Payment',
            service: 'Service',
            profile_settings: 'Profile Settings',
            billing_and_payments: 'Billing & Payments',
            support_ticket: 'Support Ticket',
            app_settings: 'App Settings',
            core_modules: 'Core Modules',
            system_settings: 'System Settings',
            unpaid_invoice: 'Unpaid Invoice',
            current_usage_estimate: 'Current Usage Estimate',
            checking: 'CHECKING',
            unpaid: 'UNPAID',
            live: 'LIVE',
            total_amount: 'Total Amount',
            due: 'Due',
            ref: 'Ref',
            usage: 'Usage',
            rate: 'Rate',
            pay_now: 'PAY NOW',
            no_due_bills: 'NO DUE BILLS',
            details: 'DETAILS',
            vs_last_month: 'vs Last Month',
            improved: 'Improved',
            billing_hub: 'BILLING HUB',
            secure_payment_gateway: 'Secure Payment Gateway',
            pay_bill: 'Pay Bill',
            history: 'History',
            unbilled_usage_estimate: 'Unbilled Usage Estimate',
            tariff: 'Tariff',
            estimate_note: '*Estimates based on real-time meter readings',
            pending_invoices: 'Pending Invoices',
            due_short: 'DUE',
            all_clear: 'All Clear',
            no_outstanding: 'No outstanding invoices at this time.',
            verified: 'VERIFIED',
            reviewing: 'REVIEWING',
            rejected: 'REJECTED',
            summary: 'Summary',
            overview: 'Overview',
            power: 'Power',
            energy: 'Energy',
            quality: 'Quality',
            iv_tab: 'I/V',
            all: 'All',
            critical: 'Critical',
            warning: 'Warning'
        }
    }), []);

    const t = useMemo(() => {
        return (key) => {
            const table = translations[language] || {};
            return table[key] || key;
        };
    }, [language, translations]);

    // Admin Actions
    // Initialize user from sessionStorage
    useEffect(() => {
        const username = sessionStorage.getItem('username');
        if (username) {
            const savedProfileStr = localStorage.getItem('user_profile_settings');
            let avatar = null;
            let displayName = sessionStorage.getItem('display_name');
            
            if (savedProfileStr) {
                try {
                    const saved = JSON.parse(savedProfileStr);
                    if (saved.avatar) avatar = saved.avatar;
                    if (saved.displayName) displayName = saved.displayName;
                } catch(e) {}
            }
            
            setUser({ 
                username, 
                role: isAdminMode ? 'admin' : 'user',
                display_name: displayName || username,
                avatar: avatar
            });
        }
    }, []);

    const logout = async () => {
        try {
            const API = getApiBase();
            const token = sessionStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            await fetch(`${API}/logout`, {
                method: 'POST',
                headers,
                credentials: 'include'
            }).catch(() => {}); // Ignore logout API errors
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            // Clear session
            sessionStorage.clear();
            localStorage.removeItem('selectedDevice');
            localStorage.removeItem('selectedProject'); // Clear sticky project selection
            
            // Force reload to clear context state
            window.location.href = '/login';
        }
    };

    const createProject = async (name) => {
        const API = getApiBase();
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
        const headers = { "Content-Type": "application/json" };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API}/projects`, {
            method: "POST",
            credentials: 'include',
            headers,
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.project_id) {
            await selectProject(data.project_id);
            await fetchProjects();
        }
        return data;
    };



    const value = {
        activePanel,
        setActivePanel,
        user,
        setUser,
        logout,
        isAdminMode,
        setIsAdminMode: (v) => {
            setIsAdminMode(v);
            try {
                sessionStorage.setItem('isAdminMode', v ? '1' : '0');
                localStorage.setItem('isAdminMode', v ? '1' : '0');
            } catch (e) { }
        },
        language,
        setLanguage: (lng) => {
            setLanguage(lng);
            try {
                localStorage.setItem('app_language', lng);
            } catch (e) {}
        },
        t,
        sessionStart,
        sessionId,
        projects,
        selectedProject,
        selectProject,
        createProject,
        projectName,
        devices,
        readings,
        readingsByDevice,
        deviceStatus,
        lastUpdate,
        selectedDevice,
        setSelectedDevice: (id) => {
            setSelectedDevice(id);
            if (id) localStorage.setItem('selectedDevice', id);
        },
        converters,
        selectedConverter,
        setSelectedConverter,
        billingSummary
    };
    console.log('[AppContext] Provider value:', value);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
