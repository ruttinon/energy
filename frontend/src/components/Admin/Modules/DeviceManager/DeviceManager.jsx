import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { api, getApiBase } from '../../../../../../services/api';
import {
    Cpu, Server, Plus, Search, Filter, MoreVertical, Settings as SettingsIcon,
    Trash2, Save, X, RefreshCw, Activity, Zap, FileSpreadsheet, Upload, AlertTriangle, CheckCircle, FileText
} from 'lucide-react';

const DeviceManager = () => {
    const { selectedProject } = useApp();
    const { showConfirm, showAlert } = useDialog();
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
            showAlert("Error", "Failed to save changes");
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
        const confirmed = await showConfirm("Delete Cabinet", "Delete Cabinet?");
        if (!confirmed) return;
        const newConfig = { ...config };
        newConfig.converters.splice(idx, 1);
        await saveConfig(newConfig);
    };

    const deleteDevice = async (hubIdx, devId) => {
        const confirmed = await showConfirm("Delete Device", "Delete Device?");
        if (!confirmed) return;
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
            showAlert("Error", "Failed to parse file");
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
        showAlert("Success", "Import Successful");
    };

    // --- Renderers ---

    const filteredTemplates = templates.filter(t =>
        (mfgFilter ? t.manufacturer === mfgFilter : true) &&
        (filter ? t.model.toLowerCase().includes(filter.toLowerCase()) : true)
    );

    return (
        <div className="flex flex-col h-full gap-0 w-full">
            {/* Main Network Canvas */}
            <div className="flex-1 relative bg-white border border-yellow-200 overflow-hidden flex flex-col min-h-screen">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(234,179,8,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(234,179,8,0.08)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>

                {/* Header / Toolbar */}
                <div className="relative z-10 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-yellow-100 backdrop-blur-sm bg-white/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-50 to-white flex items-center justify-center border border-yellow-200 text-yellow-600 shadow-sm">
                            <Server size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-600 bg-clip-text text-transparent tracking-wider">NETWORK TOPOLOGY</h2>
                            <p className="text-[10px] text-slate-500 font-mono tracking-wide">
                                {config.converters?.length || 0} CABINETS •{' '}
                                {config.converters?.reduce((acc, c) => acc + (c.devices?.length || 0), 0)} DEVICES
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setImportModal(true)}
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-2 border border-yellow-300 bg-white hover:bg-yellow-50 text-yellow-700 font-bold transition-colors"
                        >
                            <FileSpreadsheet size={16} /> <span className="hidden sm:inline">IMPORT EXCEL</span><span className="inline sm:hidden">IMPORT</span>
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
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-md hover:shadow-lg transition-all font-bold"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">ADD CABINET</span><span className="inline sm:hidden">ADD</span>
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto p-4 md:p-8 relative z-0 scrollbar-hide">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-max">
                        {config.converters?.map((hub, idx) => (
                            <div
                                key={hub.id}
                                onDragOver={(e) => { e.preventDefault(); setDragOverHub(idx); }}
                                onDragLeave={() => setDragOverHub(null)}
                                onDrop={(e) => handleDrop(e, idx)}
                                className={`
                                    relative group rounded-2xl border transition-all duration-300 shadow-sm
                                    ${dragOverHub === idx ? 'border-yellow-500 bg-yellow-50 scale-[1.02]' : 'border-yellow-100 bg-white hover:border-yellow-200 hover:shadow-md'}
                                `}
                            >
                                {/* Hub Header */}
                                <div className="p-4 border-b border-yellow-100 flex justify-between items-start bg-white/80 backdrop-blur-sm rounded-t-2xl">
                                    <div className="flex gap-3">
                                        <div className="mt-1 flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${(() => {
                                                const devs = hub.devices || [];
                                                if (devs.length === 0) return 'bg-slate-300';
                                                const offline = devs.some(d => (statusMap[String(d.id)] || 'unknown') !== 'online');
                                                return offline ? 'bg-red-500' : 'bg-yellow-500';
                                            })()} animate-pulse`}></div>
                                            <div className={`${(() => {
                                                const devs = hub.devices || [];
                                                if (devs.length === 0) return 'bg-slate-100 text-slate-500 border-slate-200';
                                                const offline = devs.some(d => (statusMap[String(d.id)] || 'unknown') !== 'online');
                                                return offline ? 'bg-red-50 text-red-600 border-red-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200';
                                            })()} text-[10px] px-2 py-0.5 rounded-full border font-bold`}>{(() => {
                                                const devs = hub.devices || [];
                                                if (devs.length === 0) return 'EMPTY';
                                                const offline = devs.some(d => (statusMap[String(d.id)] || 'unknown') !== 'online');
                                                return offline ? 'OFFLINE' : 'ONLINE';
                                            })()}</div>
                                        </div>
                                        <div>
                                            <div className="text-base font-bold text-slate-900">{hub.name}</div>
                                            <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                                                {hub.settings?.host}:{hub.settings?.port} ({hub.protocol})
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingItem(hub); setActiveModal('converter'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800 transition-colors"><SettingsIcon size={14} /></button>
                                        <button onClick={() => deleteConverter(idx)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {/* Hub Devices Grid */}
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
                                    {hub.devices?.map(dev => (
                                        <div
                                            key={dev.id}
                                            draggable
                                            onDragStart={() => setDragItem({ type: 'device', data: { hubIdx: idx, deviceId: dev.id } })}
                                            onClick={() => { setParentHubIdx(idx); setEditingItem(dev); setActiveModal('device'); }}
                                            className={`bg-white/90 border border-yellow-100 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-yellow-200 hover:shadow-sm transition-all group/dev`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${(() => { const st = statusMap[String(dev.id)] || 'unknown'; if (st === 'online') return 'bg-yellow-500'; if (st === 'offline') return 'bg-red-500'; return 'bg-slate-300'; })()}`}></div>
                                            {(() => {
                                                const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect width=%2264%22 height=%2264%22 fill=%22#f8fafc%22/><text x=%2232%22 y=%2236%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22>NO IMG</text></svg>';
                                                const src = imageMap[String(dev.id)] ? imageMap[String(dev.id)] : fallback;
                                                return (
                                                    <img
                                                        src={src}
                                                        onError={(e) => { e.currentTarget.src = fallback; }}
                                                        alt={dev.model || 'device'}
                                                        className="w-8 h-8 rounded bg-white border border-yellow-100 object-contain mix-blend-multiply"
                                                    />
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-800 truncate">{dev.name}</div>
                                                <div className="text-[11px] text-slate-500 truncate">{dev.model}</div>
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-600 bg-white border border-yellow-100 px-2 rounded">#{dev.modbus_slave}</div>
                                        </div>
                                    ))}
                                    {(!hub.devices || hub.devices.length === 0) && (
                                        <div className="col-span-2 flex flex-col items-center justify-center text-slate-400 text-[10px] py-4 border border-dashed border-yellow-200 rounded-lg bg-white/60">
                                            <span>Drop Devices Here</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Sidebar (Templates) */}
            <div className="w-full h-64 md:h-72 lg:h-80 bg-white border-t border-yellow-200 flex flex-col overflow-hidden shrink-0 shadow-inner">
                <div className="p-4 border-b border-yellow-100 bg-white/80">
                    <h3 className="text-xs font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-600 bg-clip-text text-transparent uppercase flex items-center gap-2">
                        <Cpu size={14} /> Templates Library
                    </h3>
                    <div className="mt-3 space-y-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                className="w-full bg-white border border-yellow-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-yellow-500 outline-none transition-all"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                        <select
                            className="w-full bg-white border border-yellow-200 rounded-lg px-3 py-2 text-xs text-slate-600 focus:border-yellow-500 outline-none appearance-none"
                            value={mfgFilter}
                            onChange={e => setMfgFilter(e.target.value)}
                        >
                            <option value="">All Manufacturers</option>
                            {[...new Set(templates.map(t => t.manufacturer))].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredTemplates.map(t => (
                        <div
                            key={t.path}
                            draggable
                            onDragStart={() => setDragItem({ type: 'template', data: t })}
                            className="p-3 rounded-lg border border-yellow-200 bg-white hover:bg-yellow-50 hover:border-yellow-300 cursor-grab active:cursor-grabbing group transition-all flex flex-col items-center shadow-sm"
                        >
                            {(() => {
                                const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22#f8fafc%22/><text x=%2220%22 y=%2224%22 font-size=%228%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22>NO</text></svg>';
                                const src = `/resources/devices/${t.manufacturer || ''}/${t.model || ''}.png`;
                                return <img src={src} onError={(e) => { e.currentTarget.src = fallback; }} alt={t.model || 'device'} className="w-12 h-12 rounded border border-yellow-100 object-contain mb-2 mix-blend-multiply" />;
                            })()}
                            <div className="text-center w-full">
                                <div className="text-sm font-bold text-slate-800 group-hover:text-yellow-700 transition-colors truncate">{t.model}</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase truncate">{t.manufacturer}</div>
                                <div className="text-[9px] bg-white text-slate-600 px-2 py-0.5 rounded border border-yellow-100 mt-1 inline-block">
                                    {t.registers_count || 0} Regs
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Converter Modal */}
            {activeModal === 'converter' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-[400px] p-6 rounded-2xl animate-in zoom-in-95 shadow-2xl border border-slate-100">
                        <h3 className="text-lg font-bold font-orbitron text-yellow-600 mb-6 border-b border-slate-100 pb-2">
                            {editingItem?.id && config.converters.find(c => c.id === editingItem.id) ? 'Edit Configuration' : 'New Cabinet'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase block mb-1">Name</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                    value={editingItem?.name || ''}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">IP Host</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem?.settings?.host || ''}
                                        onChange={e => setEditingItem({ ...editingItem, settings: { ...(editingItem.settings || {}), host: e.target.value } })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Port</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem?.settings?.port || 502}
                                        onChange={e => setEditingItem({ ...editingItem, settings: { ...(editingItem.settings || {}), port: parseInt(e.target.value || '502') } })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-8">
                            <button
                                onClick={async () => {
                                    await deleteDevice(parentHubIdx, editingItem.id);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors"
                            >
                                Delete Meter
                            </button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">Cancel</button>
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
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold hover:shadow-lg transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Device Modal */}
            {activeModal === 'device' && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-[480px] p-6 rounded-2xl animate-in zoom-in-95 shadow-2xl border border-slate-100">
                        <h3 className="text-lg font-bold font-orbitron text-yellow-600 mb-6 border-b border-slate-100 pb-2">
                            Edit Meter
                        </h3>
                        <div className="flex items-center gap-3 mb-4">
                            {(() => {
                                const fallback = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22#f8fafc%22/><text x=%2240%22 y=%2244%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22>NO IMG</text></svg>';
                                const src = imageMap[String(editingItem.id)] ? imageMap[String(editingItem.id)] : fallback;
                                return <img src={src} onError={(e) => { e.currentTarget.src = fallback; }} alt={editingItem.model || 'device'} className="w-16 h-16 rounded border border-slate-200 object-contain mix-blend-multiply" />;
                            })()}
                            <div className="text-xs text-slate-500">
                                <div className="font-bold text-slate-800">{editingItem.name || ''}</div>
                                <div>{editingItem.model || ''}</div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">ID</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.id}
                                        onChange={e => setEditingItem({ ...editingItem, id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Name</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.name || ''}
                                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Modbus IP</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.modbus_ip || ''}
                                        onChange={e => setEditingItem({ ...editingItem, modbus_ip: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Port</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.modbus_port || 502}
                                        onChange={e => setEditingItem({ ...editingItem, modbus_port: parseInt(e.target.value || '502') })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Slave</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.modbus_slave || 1}
                                        onChange={e => setEditingItem({ ...editingItem, modbus_slave: parseInt(e.target.value || '1') })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Polling Interval (s)</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.polling_interval || 3}
                                        onChange={e => setEditingItem({ ...editingItem, polling_interval: parseInt(e.target.value || '3') })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Manufacturer</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.manufacturer || ''}
                                        onChange={e => setEditingItem({ ...editingItem, manufacturer: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Model</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.model || ''}
                                        onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Metadata Fields (Visible in Edit) */}
                            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                                <div className="col-span-3 text-[10px] uppercase text-yellow-600 font-bold">Metadata</div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Serial</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.meta_serial || ''}
                                        onChange={e => setEditingItem({ ...editingItem, meta_serial: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">Panel</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.meta_panel || ''}
                                        onChange={e => setEditingItem({ ...editingItem, meta_panel: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase block mb-1">CT Ratio</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm text-slate-800 focus:border-yellow-500 outline-none"
                                        value={editingItem.meta_ct || ''}
                                        onChange={e => setEditingItem({ ...editingItem, meta_ct: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-8">
                            <button
                                onClick={async () => {
                                    await deleteDevice(parentHubIdx, editingItem.id);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 font-bold hover:bg-red-100 transition-colors"
                            >
                                Delete Meter
                            </button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">Cancel</button>
                            <button
                                onClick={async () => {
                                    const newConfig = { ...config };
                                    const hub = newConfig.converters[parentHubIdx];
                                    if (!hub) return;
                                    const idx = hub.devices.findIndex(d => String(d.id) === String(editingItem.id));
                                    const base = idx !== -1 ? hub.devices[idx] : {};
                                    const payload = {
                                        ...base,
                                        ...editingItem, // Spread everything including metadata
                                        modbus_port: parseInt(editingItem.modbus_port || '502'),
                                        modbus_slave: parseInt(editingItem.modbus_slave || '1'),
                                        polling_interval: parseInt(editingItem.polling_interval || '3'),
                                    };
                                    if (idx !== -1) hub.devices[idx] = payload;
                                    await saveConfig(newConfig);
                                    setActiveModal(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold hover:shadow-lg transition-all"
                            >
                                Save Device
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-md p-4">
                    <div className="bg-white w-full max-w-[900px] max-h-[90vh] flex flex-col rounded-2xl animate-in zoom-in-95 border border-slate-200 shadow-2xl">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold font-orbitron text-yellow-600">Import Devices from Excel</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Sheet Name = Converter Name | Rows = Devices with Address/Name/Model
                                </p>
                            </div>
                            <button onClick={() => { setImportModal(false); setImportData(null); }} className="text-slate-400 hover:text-slate-800 transition-colors"><X /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                            {!importData ? (
                                <div className="h-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-yellow-400 hover:bg-yellow-50 transition-all">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center shadow-sm">
                                        <FileSpreadsheet className="text-yellow-600" size={32} />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-slate-800 mb-2">Drag & Drop Excel File here</div>
                                        <div className="text-xs text-slate-500">Supports .xlsx</div>
                                    </div>
                                    <label className="px-6 py-2 rounded-lg cursor-pointer bg-white border border-slate-200 text-slate-600 font-bold shadow-sm hover:bg-slate-50 transition-all">
                                        Browse File
                                        <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                    {importing && <div className="text-yellow-600 text-xs animate-pulse">Analyzing file...</div>}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-white border border-yellow-200">
                                            <div className="text-xs text-slate-500 uppercase">Total Converters</div>
                                            <div className="text-2xl font-bold text-slate-800">{importData.converters.length}</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white border border-yellow-200">
                                            <div className="text-xs text-slate-500 uppercase">Total Devices</div>
                                            <div className="text-2xl font-bold text-slate-800">{importData.summary.total_devices}</div>
                                        </div>
                                        <div className={`p-4 rounded-xl border ${importData.summary.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                            <div className="text-xs uppercase opacity-70 text-slate-600">Errors Found</div>
                                            <div className={`text-2xl font-bold ${importData.summary.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {importData.summary.errors}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {importData.converters.map((conv, idx) => (
                                            <div key={idx} className="border border-yellow-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
                                                <div className="bg-white p-3 flex justify-between items-center border-b border-yellow-100">
                                                    <div className="font-bold text-yellow-700 flex items-center gap-2">
                                                        <Server size={14} /> {conv.name}
                                                        {conv.exists && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 rounded-full">Existing Cabinet</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{conv.devices.length} Devices</div>
                                                </div>
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-yellow-50 text-slate-600 uppercase font-mono">
                                                        <tr>
                                                            <th className="p-3">Status</th>
                                                            <th className="p-3">Address</th>
                                                            <th className="p-3">Name</th>
                                                            <th className="p-3">Serial</th>
                                                            <th className="p-3">Panel</th>
                                                            <th className="p-3">CT</th>
                                                            <th className="p-3">Model</th>
                                                            <th className="p-3">Msg</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-yellow-100 bg-white">
                                                        {conv.devices.map((dev, di) => (
                                                            <tr key={di} className={`hover:bg-yellow-50 ${dev.errors?.length > 0 ? 'bg-red-50' : ''}`}>
                                                                <td className="p-3 w-8">
                                                                    {dev.errors?.length > 0 ? (
                                                                        <AlertTriangle size={14} className="text-red-500" />
                                                                    ) : (
                                                                        <CheckCircle size={14} className="text-green-500" />
                                                                    )}
                                                                </td>
                                                                <td className="p-3 font-mono text-yellow-600">{dev.address}</td>
                                                                <td className="p-3 font-bold text-slate-800">{dev.name}</td>
                                                                <td className="p-3 text-slate-500 font-mono">{dev.serial_number || '-'}</td>
                                                                <td className="p-3 text-slate-500">{dev.panel || '-'}</td>
                                                                <td className="p-3 text-slate-500">{dev.ct_ratio || '-'}</td>
                                                                <td className="p-3 text-slate-500">{dev.model || '-'}</td>
                                                                <td className="p-3 text-slate-500">
                                                                    {dev.errors?.length > 0 ? (
                                                                        <span className="text-red-500">{dev.errors.join(', ')}</span>
                                                                    ) : (
                                                                        <span className="text-green-600 text-[10px]">OK</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-yellow-200 flex justify-end gap-3 bg-white rounded-b-2xl">
                            <button
                                onClick={() => { setImportModal(false); setImportData(null); }}
                                className="px-6 py-3 rounded-xl border border-yellow-200 hover:bg-yellow-50 text-slate-600 font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            {importData && (
                                <button
                                    onClick={confirmImport}
                                    disabled={importData.summary.errors > 0 && false}
                                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg ${importData.summary.errors > 0
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                                        }`}
                                >
                                    {importData.summary.errors > 0 ? 'Fix Errors First' : 'Confirm Import'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceManager;
