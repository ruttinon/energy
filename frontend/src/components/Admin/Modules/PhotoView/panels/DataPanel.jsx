import React from 'react';
import SelectBox from './SelectBox';
import { listStatusImages, uploadStatusImage } from '../utils/picAssets';
import { getApiBase } from '../../../../../../../services/api';

const DataPanel = ({
    props,
    updateProp,
    selectedObject,
    selectedProject,
    deviceList,
    fetchDeviceList,
    fetchDeviceParams,
    deviceParamsCache,
    fetchDeviceOutputs,
    fabricCanvas
}) => {
    const [imgOn, setImgOn] = React.useState([]);
    const [imgOff, setImgOff] = React.useState([]);
    const [paramOpts, setParamOpts] = React.useState([]);
    const [outputs, setOutputs] = React.useState([]);
    const [outputStatus, setOutputStatus] = React.useState({});
    React.useEffect(() => {
        if (selectedProject && Array.isArray(deviceList) && deviceList.length === 0) {
            try { fetchDeviceList(selectedProject); } catch {}
        }
    }, [selectedProject]);
    React.useEffect(() => {
        (async () => {
            try {
                const { listStatusImages } = await import('../utils/picAssets');
                const imgs = await listStatusImages();
                setImgOn(imgs.on || []);
                setImgOff(imgs.off || []);
            } catch {}
        })();
    }, []);
    const rawDeviceId = String(props.deviceId || (selectedObject?.deviceId || ''));
    const { deviceModel } = React.useMemo(() => {
        const hit = (deviceList || []).find(d => String(d.name).trim() === rawDeviceId || String(d.model || '').trim() === rawDeviceId || String(d.id) === rawDeviceId);
        return { deviceModel: hit?.model || '', resolvedId: hit ? String(hit.id) : rawDeviceId };
    }, [rawDeviceId, deviceList]);
    const resolvedDeviceId = React.useMemo(() => {
        if (/^\d+$/.test(rawDeviceId)) return rawDeviceId;
        const hit = (deviceList || []).find(d => String(d.name).trim() === rawDeviceId || String(d.model || '').trim() === rawDeviceId);
        return hit ? String(hit.id) : rawDeviceId;
    }, [rawDeviceId, deviceList]);
    React.useEffect(() => {
        (async () => {
            if (!selectedProject || !resolvedDeviceId) { setParamOpts([]); return; }
            try {
                let keys = [];
                try {
                    const API = getApiBase();
                    const rTpl = await fetch(`${API}/photoview/${selectedProject}/device_template_registers/${resolvedDeviceId}`);
                    const jTpl = await rTpl.json();
                    keys = (jTpl.registers || []).map(p => p.key);
                } catch {}
                if (!keys || keys.length === 0) {
                    try {
                        const hit = (deviceList || []).find(d => String(d.id) === String(resolvedDeviceId));
                        if (hit) {
                            const { getRegistersFromTemplate } = await import('../utils/templateLoader');
                            const regs = getRegistersFromTemplate({
                                manufacturer: hit.manufacturer,
                                model: hit.model,
                                templateRef: hit.template_ref || hit.template
                            });
                            if (regs && regs.length) keys = regs;
                        }
                    } catch {}
                }
                if (!keys || keys.length === 0) {
                    const params = await fetchDeviceParams(selectedProject, resolvedDeviceId);
                    const arr = Array.isArray(params) ? params : (params?.params || []);
                    keys = (arr || []).map(p => p.key);
                }
                if (!keys || keys.length === 0) {
                    const API = getApiBase();
                    const r = await fetch(`${API}/photoview/${selectedProject}/device_data/${resolvedDeviceId}`);
                    const j = await r.json();
                    const data = j.data || {};
                    keys = Object.keys(data);
                }
                setParamOpts(keys.map(k => ({ value: k, label: k })));
            } catch {
                setParamOpts([]);
            }
        })();
    }, [selectedProject, resolvedDeviceId, deviceParamsCache, selectedObject]);

    React.useEffect(() => {
        (async () => {
            try {
                if (!selectedProject || !props.deviceId) { setOutputs([]); setOutputStatus({}); return; }
                const API = getApiBase();
                const ro = await fetch(`${API}/control/devices/${props.deviceId}/outputs`, { credentials: 'include' });
                const jo = await ro.json();
                const allowed = (jo.outputs || []).filter(o => {
                    const name = String(o.control_target || o.name || '').toLowerCase();
                    return ['alarm relay 1','alarm relay 2','digital output 1','digital output 2'].some(x => name.includes(x));
                });
                setOutputs(allowed);
                const rs = await fetch(`${API}/control/devices/${props.deviceId}/status`, { credentials: 'include' });
                const js = await rs.json();
                const map = {};
                (js.statuses || []).forEach(s => { map[s.key] = s.value; });
                setOutputStatus(map);
            } catch {
                setOutputs([]);
                setOutputStatus({});
            }
        })();
    }, [props.deviceId, selectedProject]);

    const executeControl = async (target, action) => {
        try {
            const API = getApiBase();
            const operatorName = (typeof window !== 'undefined' && sessionStorage.getItem('username')) ? sessionStorage.getItem('username') : 'admin';
            const payload = {
                device_id: String(props.deviceId || selectedObject.deviceId || resolvedDeviceId),
                control_mode: "internal",
                control_target: target,
                action,
                reason: "manual",
                operator: operatorName
            };
            const res = await fetch(`${API}/control/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const j = await res.json();
            if (res.ok && j.status === 'success') {
                try {
                    const rs = await fetch(`${API}/control/devices/${props.deviceId}/status`, { credentials: 'include' });
                    const js = await rs.json();
                    const map = {};
                    (js.statuses || []).forEach(s => { map[s.key] = s.value; });
                    setOutputStatus(map);
                } catch {}
            }
        } catch {}
    };

    const convertShapeImmediate = (shape) => {
        try {
            const c = fabricCanvas?.current;
            const obj = selectedObject;
            if (!c || !obj) return;
            let newObj = null;
            if (shape === 'square') {
                newObj = new window.fabric.Rect({
                    left: obj.left, top: obj.top,
                    width: (obj.width || 20), height: (obj.height || 20),
                    fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth
                });
            } else {
                newObj = new window.fabric.Circle({
                    left: obj.left, top: obj.top,
                    radius: Math.min((obj.width || 20)/2, (obj.height || 20)/2),
                    fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth
                });
            }
            newObj.set('customType', 'status_indicator');
            newObj.shape = shape;
            newObj.statusMode = obj.statusMode || 'device';
            newObj.converterId = obj.converterId || props.converterId || '';
            newObj.deviceId = obj.deviceId || props.deviceId || '';
            newObj.onColor = obj.onColor || props.onColor || '#10b981';
            newObj.offColor = obj.offColor || props.offColor || '#ef4444';
            newObj.onImageUrl = obj.onImageUrl || '';
            newObj.offImageUrl = obj.offImageUrl || '';
            c.remove(obj);
            c.add(newObj);
            c.setActiveObject(newObj);
            c.requestRenderAll();
        } catch {}
    };
    const convertToImageImmediate = async (url, target) => {
        try {
            const c = fabricCanvas?.current;
            const obj = c?.getActiveObject() || selectedObject;
            if (!c || !obj || !url) return;
            await new Promise((resolve) => {
                window.fabric.Image.fromURL(url, (img) => {
                    if (!img) return resolve();
                    const w = (obj.width || ((obj.radius || 12) * 2));
                    const h = (obj.height || ((obj.radius || 12) * 2));
                    img.set({ left: obj.left, top: obj.top, selectable: true, originX: 'center', originY: 'center' });
                    if (w && h) {
                        const target = Math.max(w, h);
                        img.scaleToWidth(target);
                    }
                    img.set('customType', 'status_indicator');
                    img.shape = obj.shape || 'circle';
                    img.statusMode = obj.statusMode || 'device';
                    img.converterId = obj.converterId || props.converterId || '';
                    img.deviceId = obj.deviceId || props.deviceId || '';
                    img.onColor = obj.onColor || '#10b981';
                    img.offColor = obj.offColor || '#ef4444';
                    img.onImageUrl = target === 'on' ? url : (obj.onImageUrl || '');
                    img.offImageUrl = target === 'off' ? url : (obj.offImageUrl || '');
                    c.remove(obj);
                    c.add(img);
                    c.setActiveObject(img);
                    c.requestRenderAll();
                    resolve();
                });
            });
        } catch {}
    };
    return (
        <div className="bg-white border border-slate-200 p-2 rounded shadow-sm text-slate-800">
            <div className="mb-2 font-bold text-slate-800 border-b border-slate-100 pb-1 flex justify-between items-center">
                <span>Data Binding</span>
                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono uppercase">{selectedObject.customType}</span>
            </div>
            <div className="space-y-3">
                <div>
                    <div className="flex justify-between items-center mb-0.5">
                        <label className="text-[10px] text-slate-500 font-medium">Device</label>
                        <button onClick={() => fetchDeviceList(selectedProject)} className="text-[9px] text-blue-600 hover:text-blue-700 hover:underline">Refresh</button>
                    </div>
                    <SelectBox
                        value={props.converterId || ''}
                        options={[{ value: '', label: '-- Converter --' }, ...[...new Set(deviceList.map(d => d.converter))].map(c => ({ value: c, label: c }))]}
                        onChange={(val) => { updateProp('converterId', val); updateProp('deviceId', ''); }}
                        placeholder="-- Converter --"
                    />
                    <SelectBox
                        value={props.deviceId || ''}
                        options={[{ value: '', label: '-- Device --' }, ...deviceList.filter(d => d.converter === props.converterId).map(d => ({ value: d.id, label: d.name }))]}
                        onChange={(val) => { updateProp('deviceId', val); fetchDeviceParams(selectedProject, val); }}
                        placeholder="-- Device --"
                        disabled={!props.converterId}
                    />
                </div>

                {['data_value', 'billing_value'].includes(selectedObject.customType) && (
                    <div>
                        {selectedObject.customType === 'billing_value' ? (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="text-[10px] text-slate-500 font-medium">Billing Scope</label>
                                    <label className="flex items-center gap-1 text-[10px] text-slate-600 ml-auto cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="accent-yellow-500"
                                            checked={(selectedObject.billingScope || 'device') === 'converter'}
                                            onChange={(e) => {
                                                const scope = e.target.checked ? 'converter' : 'device';
                                                updateProp('billingScope', scope);
                                                if (scope === 'converter') updateProp('deviceId', '');
                                            }}
                                        />
                                        <span>Converter only</span>
                                    </label>
                                </div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Converter</label>
                                <SelectBox
                                    value={props.converterId || ''}
                                    options={[{ value: '', label: '-- Converter --' }, ...[...new Set(deviceList.map(d => d.converter))].map(c => ({ value: c, label: c }))]}
                                    onChange={(val) => { updateProp('converterId', val); updateProp('deviceId', ''); }}
                                    placeholder="-- Converter --"
                                />
                                {(selectedObject.billingScope || 'device') === 'device' && (
                                    <>
                                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Device</label>
                                        <SelectBox
                                            value={props.deviceId || ''}
                                            options={[{ value: '', label: '-- Device --' }, ...deviceList.filter(d => d.converter === props.converterId).map(d => ({ value: d.id, label: d.name }))]}
                                            onChange={(val) => updateProp('deviceId', val)}
                                            placeholder="-- Device --"
                                            disabled={!props.converterId}
                                        />
                                    </>
                                )}
                                <label className="block text-[10px] text-slate-500 font-medium mt-2 mb-0.5">Period</label>
                                <div className="flex gap-2">
                                    <SelectBox
                                        value={props.billingPeriod || 'day'}
                                        options={[
                                            { value: 'day', label: 'Daily Cost' },
                                            { value: 'month', label: 'Monthly Cost' }
                                        ]}
                                        onChange={(val) => updateProp('billingPeriod', val)}
                                        placeholder=""
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Parameter</label>
                                <SelectBox
                                    value={props.param || ''}
                                    options={[{ value: '', label: '-- Select --' }, ...paramOpts]}
                                    onChange={(val) => updateProp('param', val)}
                                    placeholder="-- Select --"
                                    disabled={!resolvedDeviceId}
                                />
                            </>
                        )}
                    </div>
                )}

                {selectedObject.customType === 'switch_button' && (
                    <div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">ON Image</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {(imgOn || []).map(i => (
                                        <button key={i.url} className={`h-10 border ${selectedObject.onImageUrl===i.url?'border-emerald-500 ring-1 ring-emerald-500':'border-slate-200 hover:border-slate-300'} rounded overflow-hidden transition-all`} onClick={()=>{ updateProp('onImageUrl', i.url); convertToImageImmediate(i.url, 'on'); }}>
                                            <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">OFF Image</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {(imgOff || []).map(i => (
                                        <button key={i.url} className={`h-10 border ${selectedObject.offImageUrl===i.url?'border-rose-500 ring-1 ring-rose-500':'border-slate-200 hover:border-slate-300'} rounded overflow-hidden transition-all`} onClick={()=>{ updateProp('offImageUrl', i.url); convertToImageImmediate(i.url, 'off'); }}>
                                            <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Outputs</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(outputs || []).map((o, idx) => {
                                const name = o.control_target || o.name || `Output ${idx+1}`;
                                const key = o.key || o.address || name;
                                const val = outputStatus[key];
                                const active = Number(val) === 1;
                                return (
                                    <div key={name} className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-xs font-bold text-slate-800 mb-1">{name}</div>
                                        <div className="text-[10px] text-slate-500 mb-2">Status: <span className={active ? 'text-emerald-600 font-medium' : 'text-slate-400'}>{active ? 'Enabled' : 'Disabled'}</span></div>
                                        <div className="flex gap-2">
                                            <button className={`px-2 h-6 rounded text-[10px] font-medium transition-colors shadow-sm ${active?'bg-emerald-500 text-white':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`} onClick={() => executeControl(name, 'ON')}>ON</button>
                                            <button className={`px-2 h-6 rounded text-[10px] font-medium transition-colors shadow-sm ${!active?'bg-rose-500 text-white':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`} onClick={() => executeControl(name, 'OFF')}>OFF</button>
                                        </div>
                                    </div>
                                );
                            })}
                            {outputs.length === 0 && <div className="text-[10px] text-slate-400 italic">No outputs available</div>}
                        </div>
                    </div>
                )}

                {selectedObject.customType === 'status_indicator' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <label className="text-[10px] text-slate-500 font-medium">Converter</label>
                            <label className="flex items-center gap-1 text-[10px] text-slate-600 ml-auto cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="accent-yellow-500"
                                    checked={(selectedObject.statusMode || 'converter') === 'converter'}
                                    onChange={(e) => {
                                        const mode = e.target.checked ? 'converter' : 'device';
                                        updateProp('statusMode', mode);
                                        if (mode === 'converter') updateProp('deviceId', '');
                                    }}
                                />
                                <span>Converter only</span>
                            </label>
                        </div>
                        <SelectBox
                            value={props.converterId || ''}
                            options={[{ value: '', label: '-- Converter --' }, ...[...new Set(deviceList.map(d => d.converter))].map(c => ({ value: c, label: c }))]}
                            onChange={(val) => { updateProp('converterId', val); updateProp('deviceId', ''); }}
                            placeholder="-- Converter --"
                        />
                        {(selectedObject.statusMode || 'converter') === 'device' && (
                            <>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Device</label>
                                <SelectBox
                                    value={props.deviceId || ''}
                                    options={[{ value: '', label: '-- Device --' }, ...deviceList.filter(d => d.converter === props.converterId).map(d => ({ value: d.id, label: d.name }))]}
                                    onChange={(val) => updateProp('deviceId', val)}
                                    placeholder="-- Device --"
                                    disabled={!props.converterId}
                                />
                            </>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">ON Image</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {(imgOn || []).map(i => (
                                        <button key={i.url} className={`h-10 border ${selectedObject.onImageUrl===i.url?'border-yellow-500 ring-1 ring-yellow-500':'border-slate-200 hover:border-slate-300'} rounded overflow-hidden transition-all`} onClick={()=>{ updateProp('onImageUrl', i.url); convertToImageImmediate(i.url, 'on'); }}>
                                            <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                                <input type="file" accept="image/*" className="mt-1 w-full text-[10px] text-slate-500 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await uploadStatusImage(file, 'on');
                                    const imgs = await listStatusImages();
                                    setImgOn(imgs.on || []);
                                    const match = (imgs.on || []).find(x => x.name === file.name);
                                    if (match) updateProp('onImageUrl', match.url);
                                    e.target.value = '';
                                }} />
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">OFF Image</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {(imgOff || []).map(i => (
                                        <button key={i.url} className={`h-10 border ${selectedObject.offImageUrl===i.url?'border-yellow-500 ring-1 ring-yellow-500':'border-slate-200 hover:border-slate-300'} rounded overflow-hidden transition-all`} onClick={()=>{ updateProp('offImageUrl', i.url); convertToImageImmediate(i.url, 'off'); }}>
                                            <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                                <input type="file" accept="image/*" className="mt-1 w-full text-[10px] text-slate-500 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await uploadStatusImage(file, 'off');
                                    const imgs = await listStatusImages();
                                    setImgOff(imgs.off || []);
                                    const match = (imgs.off || []).find(x => x.name === file.name);
                                    if (match) updateProp('offImageUrl', match.url);
                                    e.target.value = '';
                                }} />
                            </div>
                        </div>
                        {/* Conditions section removed for simplified status */}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Unit</label>
                        <input type="text" value={props.unit || ''} onChange={(e) => updateProp('unit', e.target.value)} className="w-full border border-slate-200 rounded px-1 h-6 bg-white text-xs text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Decimals</label>
                        <input type="number" value={selectedObject.decimals ?? 2} onChange={(e) => updateProp('decimals', parseInt(e.target.value))} className="w-full border border-slate-200 rounded px-1 h-6 bg-white text-xs text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataPanel;
