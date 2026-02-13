import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../../context/AppContext';
import { getApiBase } from 'services/api';
import {
    Maximize2,
    RefreshCw,
    Map as MapIcon,
    Layers,
    Info
} from 'lucide-react';

const PhotoViewModule = () => {
    const { selectedProject } = useApp();
    const [pages, setPages] = useState([]);
    const [activePage, setActivePage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [deviceData, setDeviceData] = useState({});
    const [styleCanvas, setStyleCanvas] = useState(null);
    const imgCacheRef = useRef({});
    const converterCacheRef = useRef({});
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    const fetchPages = async () => {
        if (!selectedProject) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/pages`);
            if (res.ok) {
                const data = await res.json();
                setPages(data.pages || []);
                if (data.pages?.length > 0 && !activePage) {
                    setActivePage(data.pages[0]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch PV pages:', err);
        }
    };

    const fetchDrawings = async (pageId) => {
        if (!selectedProject || !pageId) return null;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/drawings/${pageId}`);
            if (res.ok) return await res.json();
        } catch (err) {
            console.error('Failed to fetch PV drawings:', err);
        }
        return null;
    };
    const fetchStyle = async (pageId) => {
        if (!selectedProject || !pageId) return null;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/get_style/${pageId}`);
            if (res.ok) {
                const j = await res.json();
                const sc = j?.style?.canvas || null;
                setStyleCanvas(sc);
                return sc;
            }
        } catch {}
        return null;
    };
    const loadImageCached = (url) => {
        return new Promise((resolve) => {
            if (!url) return resolve(null);
            const cache = imgCacheRef.current || {};
            if (cache[url] && cache[url].complete) return resolve(cache[url]);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { cache[url] = img; resolve(img); };
            img.onerror = () => resolve(null);
            img.src = url;
            imgCacheRef.current = cache;
        });
    };
    const normalizeImageUrl = (src) => {
        if (!src) return null;
        try {
            if (String(src).startsWith('data:')) return src;
            if (/^https?:\/\//.test(src)) return src;
            const API = getApiBase();
            const m = src.match(/\/photoview\/([^/]+)\/images\/(.+)$/);
            if (m) {
                const pid = m[1];
                const fname = m[2].split('/').pop();
                return `${API}/photoview/${pid}/images/${encodeURIComponent(fname)}`;
            }
            return `${getApiBase()}/photoview/${selectedProject}/images/${encodeURIComponent(src.split('/').pop())}`;
        } catch { return src; }
    };
    const isConverterOnline = async (pid, converterId) => {
        if (!pid || !converterId) return false;
        const key = String(converterId);
        const cache = converterCacheRef.current || {};
        const now = Date.now();
        const rec = cache[key];
        if (rec && (now - rec.ts) < 2000) return !!rec.online;
        try {
            const API = getApiBase();
            const r = await fetch(`${API}/photoview/${pid}/converter_ping/${encodeURIComponent(converterId)}`);
            const j = await r.json();
            cache[key] = { ts: now, online: !!j.online };
            converterCacheRef.current = cache;
            return !!j.online;
        } catch {
            cache[key] = { ts: now, online: false };
            converterCacheRef.current = cache;
            return false;
        }
    };

    const fetchDeviceData = async (devIds) => {
        if (!selectedProject || devIds.length === 0) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/readings/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(devIds.map(String))
            });
            const json = await res.json();
            const dataMap = json.data || {};
            setDeviceData(dataMap);
        } catch {}
    };

    const [billingConfig, setBillingConfig] = useState(null);
    useEffect(() => {
        if (selectedProject) {
            const API = getApiBase();
            fetch(`${API}/billing/config?project_id=${selectedProject}`)
                .then(r => r.json())
                .then(d => setBillingConfig(d))
                .catch(e => console.error("Billing config error", e));
        }
    }, [selectedProject]);

    useEffect(() => {
        fetchPages();
    }, [selectedProject]);

    useEffect(() => {
        const onResize = () => setDeviceData(d => ({ ...d }));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    useEffect(() => {
        let timer;
        if (activePage) {
            const load = async () => {
                setIsLoading(true);
                await fetchStyle(activePage.id);
                const config = await fetchDrawings(activePage.id);
                if (config) {
                    const objects = (config.objects || config.drawings?.objects || []);
                    const devIds = Array.from(new Set(objects
                        .filter(obj => obj.isDevice || obj.customType === 'device_value' || obj.customType === 'data_value')
                        .map(obj => obj.deviceId || obj.device_id)
                        .filter(Boolean)
                    ));
                    await fetchDeviceData(devIds);

                    if (devIds.length > 0) {
                        timer = setInterval(() => fetchDeviceData(devIds), 2000);
                    }
                }
                setIsLoading(false);
            };
            load();
        }
        return () => clearInterval(timer);
    }, [activePage]);

    // Drawing Logic
    useEffect(() => {
        const draw = async () => {
            const canvas = canvasRef.current;
            const img = imgRef.current;
            if (!canvas || !img || !activePage) return;

            const config = await fetchDrawings(activePage.id);
            if (!config) return;

            const ctx = canvas.getContext('2d');
            const contRect = containerRef.current.getBoundingClientRect();
            const imgRect = img && activePage.image ? img.getBoundingClientRect() : { left: contRect.left, top: contRect.top, width: contRect.width, height: contRect.height };
            const naturalW = Math.max(1, (activePage.image ? (img.naturalWidth || 800) : (styleCanvas?.width || 1920)));
            const naturalH = Math.max(1, (activePage.image ? (img.naturalHeight || 600) : (styleCanvas?.height || 1080)));
            const contW = Math.max(1, contRect.width);
            const contH = Math.max(1, contRect.height);
            const scaleX = Math.max(1e-6, (activePage.image ? (imgRect.width / naturalW) : (contW / naturalW)));
            const scaleY = Math.max(1e-6, (activePage.image ? (imgRect.height / naturalH) : (contH / naturalH)));
            const offsetX = Math.floor((activePage.image ? (imgRect.left - contRect.left) : 0));
            const offsetY = Math.floor((activePage.image ? (imgRect.top - contRect.top) : 0));
            canvas.width = Math.ceil(contW);
            canvas.height = Math.ceil(contH);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(offsetX, offsetY);

            const objects = (config.objects || config.drawings?.objects || []);
            const imagesNeeded = [];
            for (const obj of objects) {
                if (obj.type === 'image') {
                    const raw = obj.src || obj.imageUrl || obj.url;
                    const u = normalizeImageUrl(raw);
                    if (u) imagesNeeded.push(u);
                } else if (obj.customType === 'status_indicator') {
                    const devId = obj.deviceId || obj.device_id;
                    let online = !!deviceData[devId] && Object.keys(deviceData[devId] || {}).length > 0;
                    if (!online && obj.statusMode === 'converter' && obj.converterId) {
                        online = await isConverterOnline(selectedProject, obj.converterId);
                    }
                    const desired = normalizeImageUrl(online ? (obj.onImageUrl || obj.onImageURL) : (obj.offImageUrl || obj.offImageURL));
                    if (desired) imagesNeeded.push(desired);
                }
            }
            const uniqImages = Array.from(new Set(imagesNeeded));
            const loadedMap = {};
            for (const u of uniqImages) {
                loadedMap[u] = await loadImageCached(u);
            }

            for (const obj of objects) {
                ctx.save();
                ctx.translate((obj.left || 0) * scaleX, (obj.top || 0) * scaleY);
                ctx.rotate((obj.angle || 0) * Math.PI / 180);
                ctx.scale((obj.scaleX || 1) * scaleX, (obj.scaleY || 1) * scaleY);

                if (obj.isDevice || obj.customType === 'device_value' || obj.customType === 'data_value') {
                    const devId = obj.deviceId || obj.device_id;
                    const param = obj.deviceParam || obj.device_param || obj.param;

                    let val = deviceData[devId]?.[param];
                    if (val === undefined || val === null) val = 0;

                    // Billing Calculation
                    if (param === 'billing_cost' && billingConfig) {
                        // Fallback keys for energy
                        const energy = parseFloat(deviceData[devId]?.['energy'] || deviceData[devId]?.['ActiveEnergy'] || deviceData[devId]?.['active_energy'] || 0);
                        const price = billingConfig.price_per_unit || 5;
                        val = energy * price;
                    }

                    const dec = obj.decimals ?? 2;
                    const num = parseFloat(val);
                    const display = isNaN(num) ? String(val) : num.toFixed(dec);
                    const text = (obj.textFormat || '{val}').replace('{val}', display);

                    ctx.font = `${obj.fontWeight || ''} ${obj.fontSize || 20}px ${obj.fontFamily || 'Orbitron'}`;
                    // Align like Fabric (originX/originY)
                    const originX = (obj.originX || 'left').toLowerCase();
                    const originY = (obj.originY || 'top').toLowerCase();
                    ctx.textAlign = originX === 'center' ? 'center' : originX === 'right' ? 'right' : 'left';
                    ctx.textBaseline = originY === 'center' ? 'middle' : originY === 'bottom' ? 'bottom' : 'top';
                    ctx.fillStyle = obj.fill || '#FFD700';
                    ctx.fillText(text, 0, 0);
                } else if (obj.customType === 'status_indicator') {
                    const devId = obj.deviceId || obj.device_id;
                    let online = !!deviceData[devId] && Object.keys(deviceData[devId] || {}).length > 0;
                    if (!online && obj.statusMode === 'converter' && obj.converterId) {
                        online = await isConverterOnline(selectedProject, obj.converterId);
                    }
                    const desiredUrl = normalizeImageUrl(online ? (obj.onImageUrl || obj.onImageURL) : (obj.offImageUrl || obj.offImageURL));
                    const w = obj.width || 20;
                    const h = obj.height || 20;
                    const image = desiredUrl ? loadedMap[desiredUrl] : null;
                    if (image) {
                        ctx.drawImage(image, 0, 0, w, h);
                    } else {
                        ctx.beginPath();
                        ctx.arc(0, 0, obj.radius || 10, 0, Math.PI * 2);
                        ctx.fillStyle = online ? '#10b981' : '#ef4444';
                        ctx.fill();
                        ctx.lineWidth = obj.strokeWidth || 2;
                        ctx.strokeStyle = obj.stroke || '#1f2937';
                        ctx.stroke();
                    }
                } else if (obj.type === 'rect') {
                    ctx.strokeStyle = obj.stroke || '#FFD700';
                    ctx.lineWidth = obj.strokeWidth || 1;
                    ctx.strokeRect(0, 0, obj.width, obj.height);
                } else if (obj.type === 'i-text' || obj.type === 'text') {
                    const txt = obj.text || '';
                    ctx.font = `${obj.fontWeight || ''} ${obj.fontSize || 20}px ${obj.fontFamily || 'Orbitron'}`;
                    const originX = (obj.originX || 'left').toLowerCase();
                    const originY = (obj.originY || 'top').toLowerCase();
                    ctx.textAlign = originX === 'center' ? 'center' : originX === 'right' ? 'right' : 'left';
                    ctx.textBaseline = originY === 'center' ? 'middle' : originY === 'bottom' ? 'bottom' : 'top';
                    ctx.fillStyle = obj.fill || '#e2e8f0';
                    ctx.fillText(txt, 0, 0);
                } else if (obj.type === 'image') {
                    const rawUrl = obj.src || obj.imageUrl || obj.url;
                    const url = normalizeImageUrl(rawUrl);
                    const w = obj.width || obj._element?.naturalWidth || 24;
                    const h = obj.height || obj._element?.naturalHeight || 24;
                    const image = url ? loadedMap[url] : null;
                    if (image) ctx.drawImage(image, 0, 0, w, h);
                }
                ctx.restore();
            }
            ctx.restore();
        };

        if (activePage) draw();
    }, [activePage, deviceData, styleCanvas]);

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-white">PhotoView SCADA</h2>
                    <p className="text-sm text-slate-400 font-rajdhani uppercase tracking-widest opacity-60">Visual interface & spatial telemetry</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => containerRef.current?.requestFullscreen()}
                        className="p-2 bg-slate-900/50 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 kpi-card overflow-hidden">
                {/* Page Tabs */}
                <div className="flex items-center gap-1 p-2 bg-slate-900/50 border-b border-white/5 overflow-x-auto custom-scrollbar">
                    {pages.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setActivePage(p)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activePage?.id === p.id ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>

                {/* Viewport */}
                <div className="flex-1 relative bg-black flex items-center justify-center p-4 overflow-hidden min-h-[480px]" ref={containerRef} style={{ backgroundColor: activePage?.image ? undefined : (styleCanvas?.backgroundColor || '#050505') }}>
                    {activePage ? (
                        <div className="relative inline-block w-full h-full max-w-full max-h-full">
                            {activePage && activePage.image && (
                                <img
                                    ref={imgRef}
                                    src={String(activePage.image).startsWith('data:') ? activePage.image : `${getApiBase()}/photoview/${selectedProject}/images/${encodeURIComponent(String(activePage.image).split('/').pop())}`}
                                    className="w-full h-full object-contain opacity-50 transition-opacity duration-1000"
                                    alt="Background"
                                    onLoad={() => setDeviceData({ ...deviceData })}
                                />
                            )}
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full pointer-events-none"
                            />

                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/50">Syncing Spatial Data...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-slate-600 space-y-4">
                            <MapIcon size={60} className="opacity-10" />
                            <p className="text-xs uppercase tracking-widest font-rajdhani">No active viewport selected</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <Layers className="text-cyan-500 w-5 h-5" />
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Layers</div>
                        <div className="text-sm font-bold text-white">Canvas Engine v2.0</div>
                    </div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <RefreshCw className="text-amber-500 w-5 h-5" />
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update Rate</div>
                        <div className={`text-sm font-bold text-white`}>5s Polling</div>
                    </div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <Info className="text-purple-500 w-5 h-5" />
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Telemetry</div>
                        <div className="text-sm font-bold text-white">Live Synced</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhotoViewModule;
