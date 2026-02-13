/**
 * Centralized API Service
 * Handles data fetching and backend communication
 */

export const getApiBase = () => {
    if (typeof window !== 'undefined') {
        const isCapacitor = Boolean(window.Capacitor);
        const ua = String(window.navigator?.userAgent || '').toLowerCase();
        const proto = String(window.location?.protocol || '').toLowerCase();
        const host = String(window.location?.hostname || '').toLowerCase();
        const port = String(window.location?.port || '');
        const isViteDevPort = port === '5173' || port === '5174';
        
        // Priority: Local Dev (Vite) - Always use proxy /api to avoid CORS and ensure local backend
        if (!isCapacitor && (host === 'localhost' || host === '127.0.0.1') && (isViteDevPort || port === '3000')) {
            return '/api';
        }

        const looksLikeMobileWebView = ua.includes('android') || ua.includes('wv') || proto.startsWith('capacitor') || proto.startsWith('file') || (host === 'localhost' && !port);
        if (isCapacitor || looksLikeMobileWebView) {
            return 'http://61.91.56.190:5000/api';
        }
        if (port === '5000') {
            return '/api';
        }
        let envBaseWin = import.meta?.env?.VITE_API_BASE ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '') : '';
        if (envBaseWin && (envBaseWin.includes('localhost') || envBaseWin.includes('127.0.0.1'))) {
            if (!isCapacitor && host !== 'localhost' && host !== '127.0.0.1') {
                return '/api';
            }
        }
        if (envBaseWin) return `${envBaseWin}/api`;
        if (!isCapacitor && (host === 'localhost' || host === '127.0.0.1' || isViteDevPort)) {
            return '/api';
        }
    }

    // Prefer explicit environment configuration if provided (non-window context)
    const envBase = import.meta?.env?.VITE_API_BASE ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '') : '';
    if (envBase) return `${envBase}/api`;

    // Use runtime config from legacy config.js if available
    if (typeof window !== 'undefined') {
        const cfg = window.__CONFIG && window.__CONFIG.apiBase ? String(window.__CONFIG.apiBase).replace(/\/$/, '') : '';
        if (cfg) return `${cfg}/api`;
    }

    // Fallback to relative /api (use dev proxy if configured)
    return '/api';
};
const API_BASE = getApiBase();

export const api = {
    // Generic Fetcher
    async get(endpoint) {
        try {
            const token = sessionStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE}${endpoint}`, { headers });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`GET ${endpoint} failed`, err);
            return null;
        }
    },

    async post(endpoint, body, isFormData = false) {
        try {
            const token = sessionStorage.getItem('auth_token');
            const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const options = {
                method: 'POST',
                headers,
                body: isFormData ? body : JSON.stringify(body)
            };
            const res = await fetch(`${API_BASE}${endpoint}`, options);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`POST ${endpoint} failed`, err);
            return null;
        }
    },

    // Specific Services
    devices: {
        list: () => api.get('/device/registers?device=all'),
        // Add more device endpoints as needed
    },

    photoview: {
        getPages: (projectId) => api.get(`/photoview/${projectId}/pages`),
        getPageData: (projectId, pageId) => api.get(`/photoview/${projectId}/drawings/${pageId}`),
        savePageData: (projectId, pageId, data) => api.post(`/photoview/${projectId}/drawings/${pageId}`, data),
        createPage: (data) => api.post('/photoview/create_page', data, true), // FormData
    },

    alerts: {
        getActive: (projectId) => api.get(`/alert/${projectId}/active`),
        getHistory: (projectId) => api.get(`/alert/${projectId}/history`),
    },

    billing: {
        getSummary: (projectId) => api.get(`/billing/${projectId}/summary`),
        submitPayment: (payload) => api.post('/billing/payment', payload),
        getPayments: (projectId) => api.get(`/billing/payments?project_id=${projectId}`),
        updateTransactionStatus: (txId, action) => api.post(`/billing/transactions/${txId}/${action}`, {}),
        getConfig: (projectId) => api.get(`/billing/config?project_id=${projectId}`),
        saveConfig: (payload) => api.post(`/billing/config?project_id=${payload.project_id || payload.projectId}`, payload),
    },

    support: {
        submit: (projectId, payload) => api.post(`/support/${projectId}/submit`, payload, true),
        list: (projectId) => api.get(`/support/${projectId}/tickets`),
        download: (projectId, ticketId, filename) => `${API_BASE}/support/${projectId}/attachment/${ticketId}/${encodeURIComponent(filename)}`,
    },
    
    user: {
        me: () => api.get('/me'),
        getProfile: () => api.get('/user/profile'),
        saveProfile: (payload) => api.post('/user/profile', payload),
        changePassword: (payload) => api.post('/user/change_password', payload),
    },
    
    store: {
        getCatalog: (projectId) => api.get(`/store/catalog${projectId ? `?project_id=${projectId}` : ''}`),
        createOrder: (payload) => api.post('/store/order', payload),
        listOrders: (projectId) => api.get(`/store/orders${projectId ? `?project_id=${projectId}` : ''}`),
        // Admin inventory
        getInventory: (projectId) => api.get(`/store/inventory?project_id=${projectId}`),
        saveInventory: (projectId, items) => api.post(`/store/inventory/save`, { project_id: projectId, items }),
        addCategory: (projectId, name) => api.post(`/store/inventory/category`, { project_id: projectId, name }),
        deleteCategory: (projectId, name) => api.post(`/store/inventory/category/delete`, { project_id: projectId, name }),
    },
    
    service: {
        listJobs: (projectId) => api.get(`/service/jobs${projectId ? `?project_id=${projectId}` : ''}`),
        listAllJobs: (projectId) => api.get(`/service/jobs/all${projectId ? `?project_id=${projectId}` : ''}`),
        createJob: (payload) => api.post('/service/jobs/create', payload),
        updateJob: (jobId, payload) => api.post(`/service/jobs/update/${encodeURIComponent(jobId)}`, payload),
    },
    
    notifications: {
        list: (projectId) => api.get(`/notification/list${projectId ? `?project_id=${projectId}` : ''}`),
        markRead: (id) => api.post(`/notification/read/${id}`),
        markAllRead: (projectId) => api.post(`/notification/read_all`, { project_id: projectId }),
        create: (payload) => api.post(`/notification/create`, payload),
    },

    project: {
        getConfig: (projectId) => api.get(`/projects/${projectId}/config`),
        saveConfig: (projectId, config) => api.post(`/projects/${projectId}/config`, config),
        parseImport: (projectId, formData) => api.post(`/projects/${projectId}/parse_import`, formData, true),
        getTemplates: () => api.get('/templates/devices'),
        getProtocols: () => api.get('/templates/protocols'),
        getDevicesStatus: (projectId) => api.get(`/devices/status?project_id=${encodeURIComponent(projectId)}`),
    }
};

export default api;