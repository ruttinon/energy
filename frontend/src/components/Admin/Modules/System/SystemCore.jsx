import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from '../../../../../../services/api';
import {
    ShieldCheck,
    Key,
    Users,
    Cpu,
    QrCode,
    Copy,
    Save,
    RefreshCw,
    Search,
    Lock,
    UserPlus,
    Trash2,
    Eye,
    EyeOff,
    Sliders
} from 'lucide-react';

const SystemCore = () => {
    const { showAlert } = useDialog();
    const { selectedProject } = useApp();
    const [projectInfo, setProjectInfo] = useState({});
    const [operators, setOperators] = useState([]);
    const [ingestToken, setIngestToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [credentials, setCredentials] = useState({ username: '', password: '', display_name: '' });
    const [features, setFeatures] = useState({
        user_dashboard: true,
        user_trends: true,
        user_alarms: true,
        user_service: true,
        user_profile: true,
        user_billing: true,
        user_support: true,
        user_photoview: true
    });
    const [savingFeatures, setSavingFeatures] = useState(false);

    const fetchData = useCallback(async () => {
        if (!selectedProject || selectedProject === 'null' || selectedProject === 'undefined') return;
        setLoading(true);
        try {
            // Get auth token
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            // Project info & QR
            const API = getApiBase();
            const piRes = await fetch(`${API}/projects/${selectedProject}/info`, { 
                credentials: 'include',
                headers
            });
            if (piRes.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
                return;
            }
            if (piRes.ok) {
                const pj = await piRes.json();
                setProjectInfo(pj);
            } else {
                console.warn('Failed to fetch project info:', piRes.status);
            }

            // Ingest token
            const tokRes = await fetch(`${API}/projects/${selectedProject}/ingest_token`, { 
                credentials: 'include',
                headers
            });
            if (tokRes.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
                return;
            }
            if (tokRes.ok) {
                const tj = await tokRes.json();
                setIngestToken(tj.ingest_token || '');
            } else {
                console.warn('Failed to fetch ingest token:', tokRes.status);
            }

            // Users
            const uRes = await fetch(`${API}/projects/${selectedProject}/users`, { 
                credentials: 'include',
                headers
            });
            if (uRes.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
                return;
            }
            if (uRes.ok) {
                const uj = await uRes.json();
                setOperators(uj.users || []);
            } else {
                console.warn('Failed to fetch users:', uRes.status);
            }
        } catch (err) {
            console.error('Error fetching system core data:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedProject]);

    const toggleFeature = (featureKey) => {
        setFeatures(prev => ({
            ...prev,
            [featureKey]: !prev[featureKey]
        }));
    };

    const saveFeatures = async () => {
        if (!selectedProject) return;
        setSavingFeatures(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const API = getApiBase();
            const res = await fetch(`${API}/projects/${selectedProject}/features`, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({ features })
            });
                if (res.ok) {
                    showAlert('Success', '✓ Features updated successfully');
                }
            } catch (e) {
                console.error('Failed to save features:', e);
                showAlert('Error', 'Failed to save features');
            } finally {
                setSavingFeatures(false);
            }
        };

    const FEATURE_LIST = [
        { key: 'user_dashboard', label: 'Dashboard', desc: 'Main dashboard view' },
        { key: 'user_trends', label: 'Trends', desc: 'Energy trend analytics' },
        { key: 'user_alarms', label: 'Alarms', desc: 'Alert notifications' },
        { key: 'user_service', label: 'Service Center', desc: 'Service management' },
        { key: 'user_profile', label: 'Profile', desc: 'User settings' },
        { key: 'user_billing', label: 'Billing', desc: 'Billing information' },
        { key: 'user_support', label: 'Support', desc: 'Support section' },
        { key: 'user_photoview', label: 'Photo View', desc: 'Photo overlay editor' }
    ];

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCopyToken = () => {
        navigator.clipboard.writeText(ingestToken);
        // Add toast notification later
    };

    const handleUpdateAccess = async () => {
        if (!credentials.username || !credentials.password || !selectedProject) return;
        try {
            const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const API = getApiBase();
            const res = await fetch(`${API}/projects/${selectedProject}/users/upsert`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ 
                    ...credentials, 
                    username: credentials.username.trim(),
                    role: 'user' 
                })
            });
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('auth_token');
                    sessionStorage.removeItem('auth_token');
                    window.location.href = '/login';
                    return;
                } else if (res.status === 403) {
                    alert('Unauthorized - must be logged in as Global Admin to manage project users.');
                    return;
                } else {
                    const errText = await res.text();
                    alert('Failed to update access: ' + res.status + ' ' + errText);
                    return;
                }
            }
            setCredentials({ username: '', password: '', display_name: '' });
            fetchData();
            alert('User updated successfully.');
        } catch (err) {
            console.error(err);
            alert('Failed to update access (see console for details).');
        }
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-orbitron bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent tracking-tighter italic">System Core</h1>
                    <p className="text-xs text-slate-500 font-rajdhani uppercase tracking-[0.4em] mt-1 opacity-80">Strategic Security & Architecture Controller</p>
                </div>
                <button onClick={fetchData} className="p-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-800 shadow-sm hover:shadow-md transition-all">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Left: Project Instance & Identity */}
                <div className="space-y-8 h-full overflow-y-auto scrollbar-hide pr-2">
                    <div className="glass-card p-8 bg-white border-yellow-500/20 overflow-hidden relative shadow-lg shadow-yellow-900/5">
                        <div className="absolute -right-8 -top-8 text-yellow-500 opacity-[0.05]">
                            <ShieldCheck size={160} />
                        </div>
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-6 flex items-center gap-3 underline decoration-yellow-500/20 underline-offset-8">
                            <ShieldCheck size={16} /> Instance Identity
                        </h3>

                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                {projectInfo.qr_code && (
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-2xl blur group-hover:blur-md transition-all" />
                                        <div className="relative p-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
                                            <img src={projectInfo.qr_code} alt="Project QR" className="w-48 h-48 mix-blend-multiply contrast-125" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Project Identifier</div>
                                        <div className="text-lg font-bold font-orbitron text-slate-800">{selectedProject}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Strategic Alias</div>
                                        <div className="text-sm font-bold text-slate-600 font-rajdhani uppercase tracking-widest">{projectInfo.project_name || 'NO ALIAS'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-8 bg-white border-yellow-200 shadow-sm">
                        <h3 className="text-xs font-bold font-orbitron text-slate-600 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Key size={16} className="text-yellow-600" /> Ingest Authentication
                        </h3>
                        <div className="p-6 rounded-2xl bg-white border border-yellow-200 space-y-4 shadow-inner">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gateway Access Token</div>
                            <div className="p-4 rounded-xl bg-white border border-yellow-200 font-mono text-[10px] text-slate-600 break-all leading-relaxed relative group">
                                {ingestToken || 'LOAD-FAILURE-ERR'}
                                <button
                                    onClick={handleCopyToken}
                                    className="absolute right-2 top-2 p-1.5 rounded bg-white border border-slate-200 text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button className="text-[9px] font-bold text-yellow-600 hover:text-yellow-700 transition-colors uppercase tracking-[0.2em]">Generate New Payload Protocol</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Access Management */}
                <div className="space-y-8 h-full overflow-y-auto scrollbar-hide pr-2">
                    <div className="glass-card p-8 bg-white border-yellow-200 h-full flex flex-col shadow-lg shadow-slate-200/50">
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-8 flex items-center gap-3">
                            <Users size={16} /> Operator Access Matrix
                        </h3>

                        <div className="space-y-8">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Terminal ID</label>
                                    <input
                                        type="text"
                                        value={credentials.username}
                                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
                                        placeholder="ACCOUNT_HANDLE"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Authorization PIN</label>
                                    <input
                                        type="password"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <button
                                    onClick={handleUpdateAccess}
                                    className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold font-rajdhani uppercase tracking-widest text-xs hover:scale-[1.02] transition-all shadow-lg shadow-yellow-500/30 flex items-center justify-center gap-2"
                                >
                                    <UserPlus size={16} /> Update Protocol Access
                                </button>
                            </div>

                            <div className="pt-8 border-t border-slate-100">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Authorized Fleet Operators ({operators.length})</h4>
                                <div className="flex flex-wrap gap-2">
                                    {operators.map((user, idx) => {
                                        const username = typeof user === 'string' ? user : user.username;
                                        const displayName = typeof user === 'string' ? '' : user.display_name;
                                        const hasPassword = typeof user === 'string' ? false : user.has_password;
                                        
                                        return (
                                            <div key={username || idx} className="px-4 py-2 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center gap-3 group hover:bg-yellow-100 transition-all">
                                                <div className={`w-2 h-2 rounded-full ${hasPassword ? 'bg-green-500' : 'bg-yellow-500'} group-hover:animate-ping`} title={hasPassword ? 'Password Set' : 'No Password'} />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{username}</span>
                                                    {displayName && <span className="text-[9px] text-slate-500 font-rajdhani">{displayName}</span>}
                                                    <span className="text-[8px] text-slate-400 font-mono mt-0.5">PID: {selectedProject}</span>
                                                </div>
                                                <button className="ml-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={12} /></button>
                                            </div>
                                        );
                                    })}
                                    {operators.length === 0 && <span className="text-[10px] text-slate-400 italic uppercase">No Node Accessors Detected</span>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8 flex gap-3">
                            <button className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white text-slate-600 hover:text-slate-900 border border-yellow-200 shadow-sm hover:shadow-md transition-all text-[10px] font-bold uppercase tracking-widest">
                                <QrCode size={14} /> Global QR Sync
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white text-slate-600 hover:text-red-600 border border-yellow-200 shadow-sm hover:shadow-md transition-all text-[10px] font-bold uppercase tracking-widest">
                                <Lock size={14} /> Revoke All
                            </button>
                        </div>
                    </div>

                    {/* Feature Management */}
                    <div className="glass-card p-8 bg-white border-yellow-500/20 overflow-hidden relative shadow-lg shadow-yellow-900/5">
                        <div className="absolute -right-8 -top-8 text-yellow-500 opacity-[0.05]">
                            <Sliders size={160} />
                        </div>
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-6 flex items-center gap-3 underline decoration-yellow-500/20 underline-offset-8">
                            <Sliders size={16} /> User Interface Modules
                        </h3>

                        <div className="space-y-3">
                            {FEATURE_LIST.map(feat => (
                                <div key={feat.key} className="flex items-center justify-between p-3 rounded-lg bg-white border border-yellow-200 hover:border-yellow-500/30 transition-all group">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">{feat.label}</div>
                                        <div className="text-[9px] text-slate-500 mt-1">{feat.desc}</div>
                                    </div>
                                    <button
                                        onClick={() => toggleFeature(feat.key)}
                                        className={features[feat.key] 
                                            ? 'ml-4 p-2 rounded-lg transition-all flex-shrink-0 bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm'
                                            : 'ml-4 p-2 rounded-lg transition-all flex-shrink-0 bg-slate-100 text-slate-400 border border-slate-200'}
                                    >
                                        {features[feat.key] ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={saveFeatures}
                            disabled={savingFeatures}
                            className="w-full mt-6 py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold font-rajdhani uppercase tracking-widest text-xs hover:scale-[1.02] transition-all shadow-lg shadow-yellow-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Save size={14} /> {savingFeatures ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemCore;
