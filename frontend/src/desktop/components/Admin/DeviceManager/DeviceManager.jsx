import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../../context/AppContext';
import { api, getApiBase } from 'services/api';
import {
    Cpu, Server, Plus, Search, Filter, MoreVertical,
    Trash2, Save, X, RefreshCw, Activity, Zap, FileSpreadsheet, 
    Upload, AlertTriangle, CheckCircle, FileText, Settings,
    LayoutGrid, Monitor, Smartphone, Tablet
} from 'lucide-react';

const DeviceManager = () => {
    const { selectedProject } = useApp();
    const [config, setConfig] = useState({ converters: [] });
    const [templates, setTemplates] = useState([]);
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [mfgFilter, setMfgFilter] = useState('');

    // Drag & Drop State
    const [dragItem, setDragItem] = useState(null); // { type: 'template'|'device'|'hub', data: ... }
    const [dragOverHub, setDragOverHub] = useState(null);

    // Modal State
    const [activeModal, setActiveModal] = useState(null); // 'converter' | 'device'
    const [editingItem, setEditingItem] = useState(null); // Item being edited
    const [parentHubIdx, setParentHubIdx] = useState(null); // For device editing
    const [statusMap, setStatusMap] = useState({}); // { [device_id]: 'online'|'offline'|'unknown' }
    const [imageMap, setImageMap] = useState({}); // { [device_id]: image_url }

    // Import State
    const [importModal, setImportModal] = useState(false);
    const [importData, setImportData] = useState(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (selectedProject) loadData();
    }, [selectedProject]);

    useEffect(() => {
        let timer;
        const refreshStatus = async () => {
            if (!selectedProject) return;
            const res = await api.project.getDevicesStatus(selectedProject);
            const map = {};
            const items = res?.devices || res?.items || [];
            items.forEach(d => {
                const stat = d.status || (d.online ? 'online' : 'offline');
                map[String(d.device_id)] = stat || 'unknown';
            });
            setStatusMap(map);
        };
        refreshStatus();
        timer = setInterval(refreshStatus, 10000);
        return () => { if (timer) clearInterval(timer); };
    }, [selectedProject]);

    useEffect(() => {
        const fetchImages = async () => {
            if (!selectedProject) return;
            try {
                const API = getApiBase();
                const origin = API.replace(/\/api$/, '');
                const res = await fetch(`${origin}/api/public/projects/${encodeURIComponent(selectedProject)}/devices`);
                if (!res.ok) return;
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) return;
                const data = await res.json();
                const items = Array.isArray(data.devices) ? data.devices : [];
                const map = {};
                for (const d of items) {
                    const id = String(d.id ?? d.device_id ?? '');
                    if (id) {
                        map[id] = d.image_url || null;
                    }
                }
                setImageMap(map);
            } catch (e) {
                // silent
            }
        };
        fetchImages();
    }, [selectedProject]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cfgRes, tplRes, protoRes] = await Promise.all([
                api.project.getConfig(selectedProject),
                api.project.getTemplates(),
                api.project.getProtocols()
            ]);

            // Handle 404/Empty config by defaulting
            setConfig(cfgRes || { converters: [] });
            setTemplates(tplRes?.templates || []);
            setProtocols(protoRes?.protocols || []);
        } catch (e) {
            console.error("Load failed", e);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async (newConfig) => {
        try {
            await api.project.saveConfig(selectedProject, { converters: newConfig.converters });
            setConfig(newConfig);
        } catch (e) {
            console.error("Save failed", e);
            alert("Failed to save changes");
        }
    };

    // --- Logic ---
    const generateId = () => {
        let max = 0;
        config.converters.forEach(c => {
            if (typeof c.id === 'number') max = Math.max(max, c.id);
            c.devices?.forEach(d => { if (typeof d.id === 'number') max = Math.max(max, d.id); });
        });
        return max + 1;
    };

    const handleDrop = async (e, targetHubIdx) => {
        e.preventDefault();
        setDragOverHub(null);
        if (!dragItem) return;

        const newConfig = { ...config };
        const targetHub = newConfig.converters[targetHubIdx];

        if (dragItem.type === 'template') {
            // Add new device from template
            const tpl = dragItem.data;
            const newDev = {
                id: generateId(),
                type: 'meter',
                name: `${tpl.model}_${(targetHub.devices?.length || 0) + 1}`,
                template: `${tpl.manufacturer}/${tpl.model}`,
                template_ref: tpl.path,
                driver: tpl.path?.split('/').pop(),
                model: tpl.model,
                manufacturer: tpl.manufacturer,
                modbus_slave: (targetHub.devices?.length || 0) + 1,
                modbus_ip: targetHub.settings?.host || '',
                modbus_port: targetHub.settings?.port || 502,
                polling_interval: 3,
                parent: targetHub.id
            };
            if (!targetHub.devices) targetHub.devices = [];
            targetHub.devices.push(newDev);
            await saveConfig(newConfig);
        } else if (dragItem.type === 'device') {
            // Move device between hubs
            const { hubIdx: srcHubIdx, deviceId } = dragItem.data;
            if (srcHubIdx === targetHubIdx) return; // Same hub, maybe reorder later

            const srcHub = newConfig.converters[srcHubIdx];
            const devIndex = srcHub.devices.findIndex(d => d.id === deviceId);
            if (devIndex === -1) return;

            const [device] = srcHub.devices.splice(devIndex, 1);
            device.parent = targetHub.id;
            device.modbus_ip = targetHub.settings?.host || device.modbus_ip;
            device.modbus_port = targetHub.settings?.port || device.modbus_port;

            if (!targetHub.devices) targetHub.devices = [];
            targetHub.devices.push(device);
            await saveConfig(newConfig);
        }
    };

    const deleteConverter = async (idx) => {
        if (!confirm("Delete Cabinet?")) return;
        const newConfig = { ...config };
        newConfig.converters.splice(idx, 1);
        await saveConfig(newConfig);
    };

    const deleteDevice = async (hubIdx, devId) => {
        if (!confirm("Delete Device?")) return;
        const newConfig = { ...config };
        const hub = newConfig.converters[hubIdx];
        hub.devices = (hub.devices || []).filter(d => String(d.id) !== String(devId));
        await saveConfig(newConfig);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.project.parseImport(selectedProject, formData);
            if (res) {
                setImportData(res);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to parse file");
        } finally {
            setImporting(false);
        }
    };

    const confirmImport = async () => {
        if (!importData) return;

        const newConfig = { ...config };
        const converters = newConfig.converters || [];

        // Merge Logic
        importData.converters.forEach(impConv => {
            // Check if converter exists by name
            let targetConv = converters.find(c => c.name === impConv.name);

            if (!targetConv) {
                // Create new converter
                targetConv = {
                    id: generateId(),
                    name: impConv.name,
                    protocol: 'modbus_tcp', // Default
                    settings: { host: '', port: 502 },
                    devices: []
                };
                converters.push(targetConv);
            }

            // Add devices
            if (!targetConv.devices) targetConv.devices = [];

            impConv.devices.forEach(impDev => {
                // Skip if error
                if (impDev.errors && impDev.errors.length > 0) return;

                // Add device
                targetConv.devices.push({
                    id: generateId(), 
                    name: impDev.name,
                    type: 'meter',
                    template: '',
                    template_ref: '', 
                    manufacturer: 'Generic',
                    model: impDev.model || 'Unknown',
                    modbus_slave: impDev.address_int,
                    modbus_ip: '',
                    modbus_port: 502,
                    polling_interval: 3,
                    parent: targetConv.id,
                    // Metadata
                    meta_serial: impDev.serial_number,
                    meta_panel: impDev.panel,
                    meta_ct: impDev.ct_ratio
                });
            });
        });

        await saveConfig({ ...newConfig, converters });
        setImportModal(false);
        setImportData(null);
        alert("Import Successful");
    };

    // --- Renderers ---

    const filteredTemplates = templates.filter(t =>
        (mfgFilter ? t.manufacturer === mfgFilter : true) &&
        (filter ? t.model.toLowerCase().includes(filter.toLowerCase()) : true)
    );

    return (
        <div className="flex flex-row h-full gap-0 w-full bg-slate-50 font-sans text-slate-800">
            {/* Main Network Canvas */}
            <div className="flex-1 relative flex flex-col min-h-screen overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                {/* Header / Toolbar */}
                <div className="relative z-10 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                            <Server size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold font-orbitron text-slate-800 tracking-wide">DEVICE MANAGER</h2>
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                                <span className="flex items-center gap-1"><LayoutGrid size={12}/> {config.converters?.length || 0} Cabinets</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="flex items-center gap-1"><Activity size={12}/> {config.converters?.reduce((acc, c) => acc + (c.devices?.length || 0), 0)} Devices</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setImportModal(true)}
                            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all hover:shadow-md"
                        >
                            <FileSpreadsheet size={16} className="text-green-600" /> 
                            <span className="hidden sm:inline">IMPORT EXCEL</span>
                            <span className="inline sm:hidden">IMPORT</span>
                        </button>
                        <button
                            onClick={() => {
                                setEditingItem({
                                    id: generateId(),
                                    name: '',
                                    protocol: 'modbus_tcp',
                                    settings: { host: '', port: 502 }
                                });
                                setActiveModal('converter');
                            }}
                            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-slate-900/20"
                        >
                            <Plus size={16} /> 
                            <span className="hidden sm:inline">ADD CABINET</span>
                            <span className="inline sm:hidden">ADD</span>
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto p-4 md:p-8 relative z-0 scrollbar-hide">
                    {loading ? (
                         <div className="flex items-center justify-center h-64">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 auto-rows-max">
                            {config.converters?.map((hub, idx) => (
                                <div
                                    key={hub.id}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverHub(idx); }}
                                    onDragLeave={() => setDragOverHub(null)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    className={`
                                        relative group rounded-2xl border transition-all duration-300 flex flex-col shadow-sm hover:shadow-xl
                                        ${dragOverHub === idx ? 'border-amber-500 bg-amber-50 scale-[1.02] ring-2 ring-amber-500/20' : 'border-slate-200 bg-white hover:border-amber-400'}
                                    `}
                                >
                                    {/* Hub Header */}
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 rounded-t-2xl">
                                        <div className="flex gap-3">
                                            <div className="mt-1">
                                                <div className={`w-2.5 h-2.5 rounded-full ${(() => {
                                                    const devs = hub.devices || [];
                                                    if (devs.length === 0) return 'bg-slate-300';
                                                    const offline = devs.some(d => (statusMap[String(d.id)] || 'unknown') !== 'online');
                                                    return offline ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
                                                })()} animate-pulse`}></div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors">{hub.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-500 font-bold">
                                                        {hub.settings?.host || '0.0.0.0'}:{hub.settings?.port}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{hub.protocol}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingItem(hub); setActiveModal('converter'); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Settings size={14} /></button>
                                            <button onClick={() => deleteConverter(idx)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    {/* Hub Devices Grid */}
                                    <div className="p-4 flex-1">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {hub.devices?.map(dev => (
                                                <div
                                                    key={dev.id}
                                                    draggable
                                                    onDragStart={() => setDragItem({ type: 'device', data: { hubIdx: idx, deviceId: dev.id } })}
                                                    onClick={() => { setParentHubIdx(idx); setEditingItem(dev); setActiveModal('device'); }}
                                                    className={`
                                                        bg-slate-50 border rounded-xl p-3 flex items-center gap-3 cursor-pointer 
                                                        hover:bg-white hover:shadow-md transition-all group/dev relative overflow-hidden
                                                        ${(() => { 
                                                            const st = statusMap[String(dev.id)] || 'unknown'; 
                                                            if (st === 'online') return 'border-emerald-200 hover:border-emerald-400'; 
                                                            if (st === 'offline') return 'border-red-200 hover:border-red-400'; 
                                                            return 'border-slate-200 hover:border-amber-400'; 
                                                        })()}
                                                    `}
                                                >
                                                    {/* Status Indicator Dot */}
                                                    <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${(() => {
                                                        const st = statusMap[String(dev.id)] || 'unknown';
                                                        if (st === 'online') return 'bg-emerald-500';
                                                        if (st === 'offline') return 'bg-red-500';
                                                        return 'bg-slate-300';
                                                    })()}`}></div>

                                                    {(() => {
                                                        const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect width=%2264%22 height=%2264%22 fill=%22#f1f5f9%22/><text x=%2232%22 y=%2236%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22>IMG</text></svg>';
                                                        const src = imageMap[String(dev.id)] ? imageMap[String(dev.id)] : fallback;
                                                        return (
                                                            <div className="w-10 h-10 shrink-0 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center">
                                                                <img
                                                                    src={src}
                                                                    onError={(e) => { e.currentTarget.src = fallback; }}
                                                                    alt={dev.model || 'device'}
                                                                    className="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold text-slate-700 truncate group-hover/dev:text-amber-600 transition-colors">{dev.name}</div>
                                                        <div className="text-[9px] text-slate-400 truncate">{dev.model}</div>
                                                        <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 text-[8px] font-mono text-slate-600 font-bold">
                                                            ID: {dev.modbus_slave}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {(!hub.devices || hub.devices.length === 0) && (
                                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 mt-2">
                                                <Upload size={24} className="mb-2 opacity-50" />
                                                <span className="text-xs font-medium">Drop Devices Here</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Footer Stats */}
                                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex justify-between items-center">
                                        <div className="text-[10px] text-slate-400 font-medium">{hub.devices?.length || 0} Devices</div>
                                        <div className="text-[10px] text-slate-400 font-mono">TCP/IP</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar (Templates) */}
            <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0 shadow-xl z-20">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-bold font-orbitron text-slate-800 uppercase flex items-center gap-2 mb-3">
                        <Cpu size={16} className="text-amber-500" /> Templates Library
                    </h3>
                    <div className="space-y-3">
                        <div className="relative group">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                        <select
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none cursor-pointer"
                            value={mfgFilter}
                            onChange={e => setMfgFilter(e.target.value)}
                        >
                            <option value="">All Manufacturers</option>
                            {[...new Set(templates.map(t => t.manufacturer))].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 grid grid-cols-2 gap-2 content-start bg-slate-50/30">
                    {filteredTemplates.map(t => (
                        <div
                            key={t.path}
                            draggable
                            onDragStart={() => setDragItem({ type: 'template', data: t })}
                            className="p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md cursor-grab active:cursor-grabbing group transition-all flex flex-col items-center aspect-square justify-between"
                        >
                            <div className="flex-1 flex items-center justify-center w-full">
                                {(() => {
                                    const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22#f8fafc%22/><text x=%2220%22 y=%2224%22 font-size=%228%22 text-anchor=%22middle%22 fill=%22#94a3b8%22>IMG</text></svg>';
                                    const src = `/resources/devices/${t.manufacturer || ''}/${t.model || ''}.png`;
                                    return <img src={src} onError={(e) => { e.currentTarget.src = fallback; }} alt={t.model || 'device'} className="w-12 h-12 object-contain transition-transform group-hover:scale-110" />;
                                })()}
                            </div>
                            <div className="text-center w-full mt-2">
                                <div className="text-[10px] font-bold text-slate-700 group-hover:text-amber-600 transition-colors truncate w-full">{t.model}</div>
                                <div className="text-[8px] text-slate-400 font-bold uppercase truncate">{t.manufacturer}</div>
                                <div className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                    {t.registers_count || 0} Regs
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Converter Modal */}
            {activeModal === 'converter' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-[400px] p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-bold font-orbitron text-slate-800">
                                {editingItem?.id && config.converters.find(c => c.id === editingItem.id) ? 'Edit Configuration' : 'New Cabinet'}
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">Name</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-amber-500 outline-none transition-colors"
                                    value={editingItem?.name || ''}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    placeholder="Cabinet Name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">IP Host</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-amber-500 outline-none transition-colors font-mono"
                                        value={editingItem?.settings?.host || ''}
                                        onChange={e => setEditingItem({ ...editingItem, settings: { ...(editingItem.settings || {}), host: e.target.value } })}
                                        placeholder="192.168.1.x"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">Port</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-amber-500 outline-none transition-colors font-mono"
                                        value={editingItem?.settings?.port || 502}
                                        onChange={e => setEditingItem({ ...editingItem, settings: { ...(editingItem.settings || {}), port: parseInt(e.target.value || '502') } })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                            {editingItem?.id && config.converters.find(c => c.id === editingItem.id) && (
                                <button
                                    onClick={async () => {
                                        await deleteConverter(config.converters.findIndex(c => c.id === editingItem.id));
                                        setActiveModal(null);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors"
                                >
                                    Delete
                                </button>
                            )}
                            <button
                                onClick={async () => {
                                    const newConfig = { ...config };
                                    const idx = newConfig.converters.findIndex(c => c.id === editingItem.id);
                                    const payload = {
                                        id: editingItem.id,
                                        name: editingItem.name || `Cabinet_${editingItem.id}`,
                                        protocol: editingItem.protocol || 'modbus_tcp',
                                        settings: {
                                            host: editingItem.settings?.host || '',
                                            port: editingItem.settings?.port || 502
                                        },
                                        devices: idx !== -1 ? newConfig.converters[idx].devices || [] : []
                                    };
                                    if (idx !== -1) newConfig.converters[idx] = payload;
                                    else newConfig.converters.push(payload);
                                    await saveConfig(newConfig);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Device Modal */}
            {activeModal === 'device' && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-[500px] p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold font-orbitron text-slate-800">Edit Meter</h3>
                                <p className="text-xs text-slate-400 mt-1">Configure device parameters and metadata</p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>

                        <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            {(() => {
                                const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22#f1f5f9%22/><text x=%2240%22 y=%2244%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22#94a3b8%22>IMG</text></svg>';
                                const src = imageMap[String(editingItem.id)] ? imageMap[String(editingItem.id)] : fallback;
                                return <img src={src} onError={(e) => { e.currentTarget.src = fallback; }} alt={editingItem.model || 'device'} className="w-16 h-16 rounded-lg border border-slate-200 bg-white object-contain" />;
                            })()}
                            <div>
                                <div className="font-bold text-slate-800 text-lg">{editingItem.name || 'Unnamed Device'}</div>
                                <div className="text-sm text-slate-500 font-medium">{editingItem.model || 'Unknown Model'}</div>
                                <div className="text-xs text-amber-600 font-bold mt-1 uppercase">{editingItem.manufacturer}</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">System ID</label>
                                    <input
                                        className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-500 font-mono"
                                        value={editingItem.id}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">Name</label>
                                    <input
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-amber-500 outline-none"
                                        value={editingItem.name || ''}
                                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Modbus Configuration</div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Host IP</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                                            value={editingItem.modbus_ip || ''}
                                            onChange={e => setEditingItem({ ...editingItem, modbus_ip: e.target.value })}
                                            placeholder="Inherit"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Port</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                                            value={editingItem.modbus_port || 502}
                                            onChange={e => setEditingItem({ ...editingItem, modbus_port: parseInt(e.target.value || '502') })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Slave ID</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                                            value={editingItem.modbus_slave || 1}
                                            onChange={e => setEditingItem({ ...editingItem, modbus_slave: parseInt(e.target.value || '1') })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Polling (s)</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                                            value={editingItem.polling_interval || 3}
                                            onChange={e => setEditingItem({ ...editingItem, polling_interval: parseInt(e.target.value || '3') })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">Manufacturer</label>
                                    <input
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800"
                                        value={editingItem.manufacturer || ''}
                                        onChange={e => setEditingItem({ ...editingItem, manufacturer: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1.5">Model</label>
                                    <input
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800"
                                        value={editingItem.model || ''}
                                        onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Metadata Fields */}
                            <div className="pt-4 border-t border-slate-100">
                                <div className="text-xs uppercase text-amber-600 font-bold mb-3 flex items-center gap-2">
                                    <FileText size={14}/> Metadata
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Serial No.</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                                            value={editingItem.meta_serial || ''}
                                            onChange={e => setEditingItem({ ...editingItem, meta_serial: e.target.value })}
                                            placeholder="S/N"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Panel Name</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                                            value={editingItem.meta_panel || ''}
                                            onChange={e => setEditingItem({ ...editingItem, meta_panel: e.target.value })}
                                            placeholder="DB-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">CT Ratio</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                                            value={editingItem.meta_ct || ''}
                                            onChange={e => setEditingItem({ ...editingItem, meta_ct: e.target.value })}
                                            placeholder="100:5"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                            <button
                                onClick={async () => {
                                    await deleteDevice(parentHubIdx, editingItem.id);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors"
                            >
                                Delete Meter
                            </button>
                            <button
                                onClick={async () => {
                                    const newConfig = { ...config };
                                    const hub = newConfig.converters[parentHubIdx];
                                    if (!hub) return;
                                    const idx = hub.devices.findIndex(d => String(d.id) === String(editingItem.id));
                                    const base = idx !== -1 ? hub.devices[idx] : {};
                                    const payload = {
                                        ...base,
                                        ...editingItem,
                                    };
                                    if (idx !== -1) hub.devices[idx] = payload;
                                    else hub.devices.push(payload);
                                    await saveConfig(newConfig);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-bold font-orbitron text-slate-800">Import Devices</h3>
                            <button onClick={() => { setImportModal(false); setImportData(null); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>

                        {!importData ? (
                            <div className="space-y-6">
                                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        accept=".xlsx,.xls" 
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    {importing ? (
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-4"></div>
                                    ) : (
                                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                                            <FileSpreadsheet size={32} />
                                        </div>
                                    )}
                                    <div className="text-sm font-bold text-slate-800">Click to upload Excel</div>
                                    <div className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls</div>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                        <div className="text-xs text-amber-800">
                                            <p className="font-bold mb-1">Format Requirement</p>
                                            <p>Excel should contain columns: Name, Serial Number, Panel, CT Ratio, Address, Model.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left font-bold text-slate-600">Cabinet</th>
                                                <th className="p-3 text-left font-bold text-slate-600">Devices</th>
                                                <th className="p-3 text-center font-bold text-slate-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {importData.converters?.map((c, i) => (
                                                <tr key={i}>
                                                    <td className="p-3 font-bold text-slate-800">{c.name}</td>
                                                    <td className="p-3 text-slate-600">{c.devices?.length || 0} meters</td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 font-bold">Ready</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button
                                    onClick={confirmImport}
                                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    Confirm Import ({importData.converters?.reduce((acc, c) => acc + (c.devices?.length || 0), 0)} Devices)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceManager;
