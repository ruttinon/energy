import React, { useState, useEffect } from 'react';
import {
    Save, Server, Activity, Database, FileText,
    CheckCircle, XCircle, Play, Layers, Zap, ToggleRight
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';

const PowerStudioAdmin = () => {
    const { selectedProject } = useApp();
    const [activeTab, setActiveTab] = useState('integration'); // integration, control

    const [config, setConfig] = useState({
        enabled: false,
        mode: 'api',
        connection: { url: '', db_path: '', file_path: '' },
        mapping: {}
    });

    const [controlConfig, setControlConfig] = useState({
        relays: [], // [{ip, port, name}]
        mappings: [] // [{device_id, relay_idx, channel}]
    });

    const [status, setStatus] = useState('idle');
    const [preview, setPreview] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        if (selectedProject) {
            loadConfig();
            loadControlConfig();
        }
    }, [selectedProject]);

    const loadConfig = async () => {
        try {
            const res = await fetch(`/api/powerstudio/config/${selectedProject}`);
            const data = await res.json();
            if (data && data.mode) {
                setConfig({
                    enabled: data.enabled || false,
                    mode: data.mode,
                    connection: data.connection || { url: '', db_path: '', file_path: '' },
                    mapping: data.mapping || {}
                });
            }
        } catch (err) { console.error(err); }
    };

    const loadControlConfig = async () => {
        try {
            const res = await fetch(`/api/powerstudio/config/control/${selectedProject}`);
            const data = await res.json();
            setControlConfig({
                relays: data.relays || [],
                mappings: data.mappings || []
            });
        } catch (err) { console.error(err); }
    };

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
    };

    const handleTestRelay = async (relay, channel, state) => {
        try {
            const res = await fetch('/api/powerstudio/control/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip: relay.ip,
                    port: relay.port || 502,
                    channel: channel,
                    state: state
                })
            });
            const data = await res.json();
            if (data.status === 'ok') addLog(`Relay Command: ${data.message}`, 'success');
            else addLog(`Relay Error: ${data.message}`, 'error');
        } catch (e) { addLog(e.message, 'error'); }
    };

    const handleTest = async () => {
        setStatus('testing');
        addLog('Testing connection...', 'info');
        setPreview(null);
        try {
            const payload = {
                mode: config.mode,
                api_base: config.connection.url,
                db_path: config.connection.db_path,
                file_path: config.connection.file_path
            };
            const res = await fetch('/api/powerstudio/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.reachable) {
                setStatus('success');
                addLog(`Connection Success! Latency: ${result.response_time_ms || 0}ms`, 'success');
                const res2 = await fetch('/api/powerstudio/preview', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                const previewData = await res2.json();
                setPreview(previewData);
                addLog(`Fetched ${previewData.raw.length} raw items`, 'info');
            } else {
                setStatus('error');
                addLog(`Connection Failed: ${result.error}`, 'error');
            }
        } catch (err) {
            setStatus('error');
            addLog(`Network Error: ${err.message}`, 'error');
        }
    };

    const handleSave = async () => {
        try {
            // Save Monitor Config
            await fetch(`/api/powerstudio/config/${selectedProject}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config)
            });
            // Save Control Config
            await fetch(`/api/powerstudio/config/control/${selectedProject}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(controlConfig)
            });
            addLog('All Configuration Saved', 'success');
        } catch (err) {
            addLog(`Save Failed: ${err.message}`, 'error');
        }
    };

    return (
        <div className="p-6 text-slate-200 h-full overflow-hidden flex flex-col gap-4">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-xl font-bold text-amber-500 tracking-wider flex items-center gap-2">
                            POWER STUDIO <span className="text-slate-500 text-sm">INTEGRATION</span>
                        </h1>
                    </div>

                    {/* TABS */}
                    <div className="flex bg-slate-800 rounded p-1 gap-1">
                        <button
                            onClick={() => setActiveTab('integration')}
                            className={`px-4 py-1 text-xs font-bold rounded uppercase flex items-center gap-2 ${activeTab === 'integration' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Database size={14} /> Data Integration
                        </button>
                        <button
                            onClick={() => setActiveTab('control')}
                            className={`px-4 py-1 text-xs font-bold rounded uppercase flex items-center gap-2 ${activeTab === 'control' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Zap size={14} /> Control Logic
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    {activeTab === 'integration' && (
                        <button onClick={handleTest} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition-all border border-slate-600 text-amber-500/80">
                            <Play size={14} /> TEST INPUT
                        </button>
                    )}
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded text-xs font-bold shadow-lg shadow-black/50 text-white">
                        <Save size={14} /> SAVE ALL
                    </button>
                </div>
            </div>

            {/* INTEGRATION TAB */}
            {activeTab === 'integration' && (
                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* LEFT: CONFIG */}
                    <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-4 text-amber-500 font-bold text-sm uppercase">
                                <Server size={14} /> Connection Settings
                            </div>
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Connection Mode</label>
                                    <div className="flex gap-1 bg-slate-900/50 p-1 rounded border border-slate-700">
                                        {['api', 'db', 'file'].map(m => (
                                            <button key={m} onClick={() => setConfig({ ...config, mode: m })}
                                                className={`flex-1 py-1 text-xs font-bold rounded uppercase ${config.mode === m ? 'bg-amber-600 text-white' : 'text-slate-500'}`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {config.mode === 'api' && <input value={config.connection.url} onChange={e => setConfig({ ...config, connection: { ...config.connection, url: e.target.value } })} className="input-field" placeholder="http://192.168.1.100/api" />}
                                {config.mode === 'db' && <input value={config.connection.db_path} onChange={e => setConfig({ ...config, connection: { ...config.connection, db_path: e.target.value } })} className="input-field" placeholder="C:\PowerStudio\data.sqlite" />}
                            </div>
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex-1">
                            <div className="flex items-center gap-2 mb-2 text-amber-500 font-bold text-sm uppercase"><Layers size={14} /> Quick Mapping</div>
                            <textarea
                                className="w-full h-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-green-400"
                                value={JSON.stringify(config.mapping, null, 2)}
                                onChange={e => { try { setConfig({ ...config, mapping: JSON.parse(e.target.value) }); } catch (e) { } }}
                            />
                        </div>
                    </div>

                    {/* RIGHT: PREVIEW */}
                    <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 flex flex-col overflow-hidden">
                        <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                            <span className="text-xs font-bold text-slate-300">DATA INSPECTOR</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex gap-4">
                            <div className="flex-1"><h4 className="title-sm">RAW</h4><pre className="code-block">{preview ? JSON.stringify(preview.raw, null, 2) : 'No Data'}</pre></div>
                            <div className="w-px bg-slate-800"></div>
                            <div className="flex-1"><h4 className="title-sm text-green-500">NORMALIZED</h4><pre className="code-block text-green-400">{preview ? JSON.stringify(preview.normalized, null, 2) : 'Waiting...'}</pre></div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROL TAB */}
            {activeTab === 'control' && (
                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* LEFT: RELAY CONFIG */}
                    <div className="w-1/3 bg-slate-800/50 border border-slate-700 rounded-lg p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-amber-500 font-bold text-sm uppercase flex items-center gap-2"><ToggleRight size={14} /> Relay Boards</div>
                            <button onClick={() => setControlConfig({ ...controlConfig, relays: [...controlConfig.relays, { name: 'New Relay', ip: '192.168.1.200', port: 502 }] })}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white">+ ADD BOARD</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {controlConfig.relays.map((relay, i) => (
                                <div key={i} className="bg-slate-900 border border-slate-700 p-3 rounded flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <input value={relay.name} onChange={e => { const n = [...controlConfig.relays]; n[i].name = e.target.value; setControlConfig({ ...controlConfig, relays: n }) }}
                                            className="bg-transparent border-b border-slate-700 text-xs font-bold text-white w-2/3" placeholder="Board Name" />
                                        <button onClick={() => { const n = [...controlConfig.relays]; n.splice(i, 1); setControlConfig({ ...controlConfig, relays: n }) }} className="text-red-500"><XCircle size={12} /></button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input value={relay.ip} onChange={e => { const n = [...controlConfig.relays]; n[i].ip = e.target.value; setControlConfig({ ...controlConfig, relays: n }) }}
                                            className="bg-slate-800 text-xs p-1 rounded border border-slate-700 w-2/3" placeholder="IP Address" />
                                        <input value={relay.port} onChange={e => { const n = [...controlConfig.relays]; n[i].port = parseInt(e.target.value); setControlConfig({ ...controlConfig, relays: n }) }}
                                            className="bg-slate-800 text-xs p-1 rounded border border-slate-700 w-1/3" placeholder="Port" />
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 mt-2">
                                        {[1, 2, 3, 4].map(ch => (
                                            <button key={ch} onClick={() => handleTestRelay(relay, ch, true)}
                                                className="bg-slate-800 hover:bg-amber-900 border border-slate-700 rounded py-1 text-[10px] text-slate-400 hover:text-amber-500 transition-colors">
                                                CH{ch} ON
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {controlConfig.relays.length === 0 && <div className="text-center text-slate-500 text-xs py-10">No Relay Boards Added</div>}
                        </div>
                    </div>

                    {/* RIGHT: LOGIC MAPPING */}
                    <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-amber-500 font-bold text-sm uppercase"><Layers size={14} className="inline mr-2" /> Control Logic Mapping</div>
                            <button onClick={() => setControlConfig({ ...controlConfig, mappings: [...controlConfig.mappings, { device_id: '', relay_idx: 0, channel: 1 }] })}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-[10px] text-white font-bold">+ ADD RULE</button>
                        </div>

                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] text-slate-500 border-b border-slate-800 uppercase">
                                    <th className="p-2">Power Studio Device</th>
                                    <th className="p-2">Target Relay Board</th>
                                    <th className="p-2">Channel</th>
                                    <th className="p-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {controlConfig.mappings.map((rule, i) => (
                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                        <td className="p-2">
                                            <input value={rule.device_id} onChange={e => { const n = [...controlConfig.mappings]; n[i].device_id = e.target.value; setControlConfig({ ...controlConfig, mappings: n }) }}
                                                className="bg-slate-800 text-xs p-1 rounded border border-slate-700 w-full text-amber-200" placeholder="e.g. meter_01" />
                                        </td>
                                        <td className="p-2">
                                            <select value={rule.relay_idx} onChange={e => { const n = [...controlConfig.mappings]; n[i].relay_idx = parseInt(e.target.value); setControlConfig({ ...controlConfig, mappings: n }) }}
                                                className="bg-slate-800 text-xs p-1 rounded border border-slate-700 w-full text-slate-300">
                                                {controlConfig.relays.map((r, idx) => <option key={idx} value={idx}>{r.name} ({r.ip})</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select value={rule.channel} onChange={e => { const n = [...controlConfig.mappings]; n[i].channel = parseInt(e.target.value); setControlConfig({ ...controlConfig, mappings: n }) }}
                                                className="bg-slate-800 text-xs p-1 rounded border border-slate-700 w-20 text-center">
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map(c => <option key={c} value={c}>CH {c}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => { const n = [...controlConfig.mappings]; n.splice(i, 1); setControlConfig({ ...controlConfig, mappings: n }) }}
                                                className="text-red-500 hover:text-red-400"><XCircle size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* LOGS FOOTER */}
            <div className="bg-black/40 border-t border-slate-800 p-2 h-24 overflow-y-auto font-mono text-[10px]">
                {logs.map((L, i) => (
                    <div key={i} className={`${L.includes('Error') ? 'text-red-400' : L.includes('Success') ? 'text-green-400' : 'text-slate-400'}`}>{L}</div>
                ))}
            </div>
        </div>
    );
};

export default PowerStudioAdmin;
