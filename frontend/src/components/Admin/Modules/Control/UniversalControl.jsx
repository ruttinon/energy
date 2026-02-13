import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Power, Zap, ShieldCheck, RefreshCw, Search, Circle, Clock, User, Server, Activity, Filter, LayoutGrid } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { useControl } from '../../../../context/ControlContext';
import { getApiBase } from 'services/api';

const UniversalControl = () => {
    const { selectedProject } = useApp();
    const { 
        controlDevices: devices, 
        setControlDevices: setDevices,
        deviceStatuses, 
        setDeviceStatuses,
        deviceOutputs, 
        fetchControlDevices, 
        fetchDeviceStatus: contextFetchDeviceStatus, 
        fetchDeviceOutputs: contextFetchDeviceOutputs 
    } = useControl();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const isMountedRef = useRef(true);
    const statusReqRef = useRef({ inFlight: false, controller: null });
    const logsReqRef = useRef({ inFlight: false, controller: null });

    // Selection & Filtering
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('ALL');

    // NOTE: deviceOutputs and deviceStatuses are now managed by ControlContext
    // We can use local useEffects to trigger updates but read from context.

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            try {
                statusReqRef.current.controller?.abort();
            } catch { }
            try {
                logsReqRef.current.controller?.abort();
            } catch { }
        };
    }, []);

    // Fetch ALL devices initially (if empty)
    useEffect(() => {
        if (devices.length === 0) {
            fetchControlDevices();
        }
        fetchLogs();
    }, [refreshKey]); 

    // Auto-select first device if none selected
    useEffect(() => {
        if (!selectedDeviceId && devices.length > 0) {
            // Check if we have a previously selected device in session?
            // For now, default to first.
            setSelectedDeviceId(devices[0].device_id);
        }
    }, [devices]);

    // Fetch data for selected device with debounce
    useEffect(() => {
        if (!selectedDeviceId) return;
        
        // Clear previous pending status request if any
        if (statusReqRef.current.controller) {
            statusReqRef.current.controller.abort();
            statusReqRef.current.inFlight = false;
        }

        const timer = setTimeout(() => {
            // Use Context methods
            contextFetchDeviceOutputs(selectedDeviceId);
            // We use local wrapper for status to handle AbortController if needed, 
            // but Context method is simpler. 
            // However, to keep debounce+abort logic working perfect, let's keep local wrapper calling context logic?
            // Actually, contextFetchDeviceStatus doesn't support signal aborting yet.
            // Let's use the local fetchDeviceStatus which now updates Context State.
            fetchDeviceStatus(selectedDeviceId);
        }, 300); // 300ms debounce for rapid switching

        return () => clearTimeout(timer);
    }, [selectedDeviceId, refreshKey]);

    useEffect(() => {
        if (!selectedDeviceId) return;
        const intervalId = setInterval(() => {
            if (!document.hidden) {
                fetchDeviceStatus(selectedDeviceId);
            }
        }, 2000); // Slightly relaxed from 1500 to 2000
        return () => clearInterval(intervalId);
    }, [selectedDeviceId]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (!document.hidden) {
                fetchLogs();
            }
        }, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // Keep fetchDevices for Refresh Button
    const fetchDevices = async () => {
        await fetchControlDevices();
    };

    const fetchLogs = async () => {
        try {
            if (logsReqRef.current.inFlight) return;
            const API = getApiBase();
            const controller = new AbortController();
            logsReqRef.current.inFlight = true;
            logsReqRef.current.controller = controller;
            
            // Add auth headers with JWT token
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch(`${API}/control/audit_log`, { 
                credentials: 'include', 
                signal: controller.signal,
                headers
            });
            const ct = res.headers.get('content-type') || '';
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            if (!ct.includes('application/json')) throw new Error('Invalid JSON');
            const data = await res.json();
            if (!isMountedRef.current) return;
            setLogs(data || []);
        } catch (err) {
            if (err?.name === 'AbortError') {
                console.debug("Failed to fetch logs - request aborted");
            } else {
                console.error("Failed to fetch logs", err);
            }
        } finally {
            logsReqRef.current.inFlight = false;
            logsReqRef.current.controller = null;
        }
    };

    // No local fetchDeviceOutputs needed, use Context's or implicit
    
    // Updated fetchDeviceStatus to write to Context
    const fetchDeviceStatus = async (deviceId) => {
        try {
            if (statusReqRef.current.inFlight) return;
            const API = getApiBase();
            const controller = new AbortController();
            statusReqRef.current.inFlight = true;
            statusReqRef.current.controller = controller;
            
            // Add auth headers with JWT token
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch(`${API}/control/devices/${deviceId}/status`, { 
                credentials: 'include', 
                signal: controller.signal,
                headers
            });
            const ct = res.headers.get('content-type') || '';
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            if (!ct.includes('application/json')) throw new Error('Invalid JSON');
            const data = await res.json();
            const statusMap = {};
            (data.statuses || []).forEach(s => {
                statusMap[s.key] = { status: s.status, value: s.value };
            });
            if (!isMountedRef.current) return;
            
            // UPDATE CONTEXT STATE
            setDeviceStatuses(prev => ({
                ...prev,
                [deviceId]: statusMap
            }));
        } catch (err) {
            if (err?.name === 'AbortError') {
                console.debug(`Status request aborted for device ${deviceId}`);
            } else {
                console.error(`Failed to get status for device ${deviceId}`, err);
            }
        } finally {
            statusReqRef.current.inFlight = false;
            statusReqRef.current.controller = null;
        }
    };



    const handleControl = async (deviceId, action, target, address, outputKey) => {
        setLoading(true);
        try {
            const operatorName = (typeof window !== 'undefined' && sessionStorage.getItem('username')) ? sessionStorage.getItem('username') : 'admin';
            const payload = {
                device_id: String(deviceId),
                control_mode: "internal",
                control_target: target,
                action,
                reason: "manual",
                operator: operatorName
            };

            const API = getApiBase();
            
            // Add auth headers with JWT token
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(`${API}/control/execute`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                    return;
                }
                const errData = await response.json();
                throw new Error(JSON.stringify(errData.detail || errData));
            }

            const result = await response.json();
            if (result.status === "success") {
                showToast(`✓ ${target}: ${action}`, 'success');

                // Optimistic Update
                setDeviceStatuses(prev => ({
                    ...prev,
                    [deviceId]: {
                        ...prev[deviceId],
                        [outputKey || address]: {
                            ...prev[deviceId]?.[outputKey || address],
                            status: action,
                            value: action === 'ON' ? 1 : 0
                        }
                    }
                }));

                // Poll multiple times to catch the state change (device might be slow)
                setTimeout(() => fetchDeviceStatus(deviceId), 500);
                setTimeout(() => fetchDeviceStatus(deviceId), 1500);
                setTimeout(() => {
                    fetchDeviceStatus(deviceId);
                    fetchLogs();
                }, 3000);
            } else {
                showToast(`✗ ${result.error_message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            showToast(`✗ ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type) => {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-bold text-sm z-50 animate-fade-in border shadow-lg ${type === 'success' ? 'bg-white text-emerald-600 border-emerald-500' : 'bg-white text-red-500 border-red-500'
            }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // Filter Logic
    const filteredDevices = useMemo(() => {
        return devices.filter(d => {
            const matchSearch = d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(d.device_id).includes(searchTerm);
            // Optional: Filter by project if selected, but if 'Universal' we might want all
            // For now, removing rigid project filter to show everything as requested
            return matchSearch;
        });
    }, [devices, searchTerm]);

    const selectedDevice = devices.find(d => d.device_id === selectedDeviceId);
    const selectedOutputs = selectedDevice ? (deviceOutputs[selectedDeviceId] || selectedDevice.outputs || []) : [];

    return (
        <div className="h-full flex overflow-hidden bg-slate-50">
            {/* Sidebar - Device List */}
            <aside className="w-80 flex flex-col border-r border-slate-200 bg-white flex-shrink-0">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-4 text-yellow-600">
                        <LayoutGrid size={20} />
                        <h2 className="font-orbitron font-bold text-lg tracking-wider">DEVICES</h2>
                    </div>

                    {/* Search Box */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search devices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-yellow-500/50 transition-all font-rajdhani"
                        />
                    </div>
                </div>

                {/* Device List */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
                    {filteredDevices.map(device => (
                        <button
                            key={device.device_id}
                            onClick={() => setSelectedDeviceId(device.device_id)}
                            className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${selectedDeviceId === device.device_id
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'
                                }`}
                        >
                            <div className="flex items-center justify-between pointer-events-none relative z-10">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`p-2 rounded-lg transition-all flex-shrink-0 ${selectedDeviceId === device.device_id ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                                        }`}>
                                        <Zap size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-sm font-orbitron truncate ${selectedDeviceId === device.device_id ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-800'
                                            }`}>{device.device_name}</h3>
                                        <p className="text-[10px] text-slate-400 font-mono truncate">ID: {device.device_id} • {device.project}</p>
                                    </div>
                                </div>
                                {selectedDeviceId === device.device_id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)] flex-shrink-0" />
                                )}
                            </div>
                        </button>
                    ))}

                    {filteredDevices.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                            <Filter className="mx-auto mb-2 opacity-50" size={24} />
                            <p className="text-xs">No devices found</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer */}
                <div className="p-3 border-t border-slate-200 text-[10px] text-slate-400 text-center font-mono">
                    Total Devices: {devices.length}
                </div>
            </aside>

            {/* Main Content - Control Panel */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('/img/grid.svg')] bg-center opacity-5" />

                {/* Header */}
                <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 relative z-10 bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold font-orbitron text-slate-800">Universal Control Center</h1>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="px-3 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                            <Activity size={12} />
                            System Active
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setRefreshKey(prev => prev + 1);
                            if (selectedDeviceId) fetchDeviceStatus(selectedDeviceId);
                        }}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} />
                    </button>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-0 relative z-10">
                    {selectedDevice ? (
                        <div className="w-full h-full flex flex-col">
                            {/* Device Info Header Banner */}
                            <div className="bg-white border-b border-slate-200 p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                                    <Server size={120} className="text-yellow-600" />
                                </div>
                                <div className="relative z-10 flex items-end justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-3xl font-bold font-orbitron text-yellow-600">{selectedDevice.device_name}</h2>
                                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono text-slate-500">ID: {selectedDevice.device_id}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 font-mono">
                                            <span>{selectedDevice.manufacturer} {selectedDevice.model}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-yellow-600/80">{selectedDevice.project}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-6 space-y-6">
                                {/* Controls Grid */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Power size={14} className="text-yellow-600" />
                                        Output Controls
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        {selectedOutputs.map((output, idx) => {
                                            const status = deviceStatuses[selectedDeviceId]?.[output.key];
                                            // Corrected Logic: Rely on backend status text which handles Inversion
                                            const isOn = status?.status === 'ON';

                                            // Determine target action
                                            const targetAction = isOn ? "OFF" : "ON";
                                            // Use a loading spinner if global loading is true
                                            // For better UX, we could track loading per ID, but global is acceptable as per "slow is fine"
                                            const isActionLoading = loading;

                                            return (
                                                <div key={idx} className={`bg-white border rounded-xl p-5 transition-all group hover:border-opacity-50 flex flex-col justify-between ${isOn ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5' :
                                                    'border-slate-200 hover:border-yellow-500/30'
                                                    }`}>
                                                    <div className="mb-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className={`w-2 h-2 rounded-full ${isOn ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                                                            <div className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                                ADDR: {output.address}
                                                            </div>
                                                        </div>
                                                        <h4 className="font-bold text-slate-800 font-rajdhani text-lg leading-tight mb-1">{output.key}</h4>
                                                        <p className="text-xs text-slate-400 line-clamp-2">{output.description}</p>
                                                    </div>

                                                    <div className="mt-auto">
                                                        <button
                                                            onClick={() => handleControl(selectedDeviceId, targetAction, output.control_target, output.address, output.key)}
                                                            disabled={isActionLoading}
                                                            className={`w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 relative overflow-hidden ${isOn
                                                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 border border-slate-200'
                                                                } ${isActionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            {isActionLoading ? (
                                                                <>
                                                                    <RefreshCw className="animate-spin" size={16} />
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Power size={18} className={isOn ? "fill-current" : ""} />
                                                                    {isOn ? "Active" : "Inactive"}
                                                                </>
                                                            )}

                                                            {/* Slide effect overlay */}
                                                            <div className={`absolute inset-0 bg-white/10 transform transition-transform duration-300 ${isOn ? 'translate-x-[100%] opacity-0' : '-translate-x-[100%] opacity-0'}`} />
                                                        </button>
                                                        <div className="text-center mt-2">
                                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                                                                Click to {isOn ? "Turn OFF" : "Turn ON"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Device Audit Log */}
                                <div className="pt-6 border-t border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-yellow-600" />
                                        Recent Activity
                                    </h3>
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                                <tr>
                                                    <th className="p-3 pl-4">Time</th>
                                                    <th className="p-3">Operator</th>
                                                    <th className="p-3">Action</th>
                                                    <th className="p-3 pr-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {logs.filter(l => String(l.device_id) === String(selectedDeviceId)).slice(0, 5).map((log, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 text-slate-600">
                                                        <td className="p-3 pl-4 font-mono">{new Date(log.executed_at).toLocaleTimeString()}</td>
                                                        <td className="p-3">{log.operator}</td>
                                                        <td className="p-3">
                                                            <span className={log.action === 'ON' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{log.action}</span>
                                                        </td>
                                                        <td className="p-3 pr-4">{log.status}</td>
                                                    </tr>
                                                ))}
                                                {logs.filter(l => String(l.device_id) === String(selectedDeviceId)).length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" className="p-4 text-center italic text-slate-400">No recent activity for this device</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <Server size={64} className="mb-4 text-slate-300" />
                            <p className="text-lg font-orbitron">Select a device to configure</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UniversalControl;