import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../../context/AppContext';
import { getApiBase } from 'services/api';
import { Maximize2, Map as MapIcon, Layers, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

const MobilePhotoView = () => {
    const { selectedProject } = useApp();
    const [pages, setPages] = useState([]);
    const [activePage, setActivePage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [deviceData, setDeviceData] = useState({});
    const [scale, setScale] = useState(1);
    
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const imgCacheRef = useRef({});

    // --- Data Fetching Logic (Simplified from Desktop) ---
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
        } catch (err) { console.error(err); }
    };

    const fetchDrawings = async (pageId) => {
        if (!selectedProject || !pageId) return null;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/drawings/${pageId}`);
            if (res.ok) return await res.json();
        } catch (err) { console.error(err); }
        return null;
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
            setDeviceData(json.data || {});
        } catch {}
    };

    useEffect(() => {
        fetchPages();
    }, [selectedProject]);

    useEffect(() => {
        let timer;
        if (activePage) {
            const load = async () => {
                setIsLoading(true);
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
                        timer = setInterval(() => fetchDeviceData(devIds), 5000); // Slower polling for mobile
                    }
                }
                setIsLoading(false);
            };
            load();
        }
        return () => clearInterval(timer);
    }, [activePage]);

    // --- Rendering Logic (Canvas) ---
    useEffect(() => {
        const draw = async () => {
            const canvas = canvasRef.current;
            const img = imgRef.current;
            if (!canvas || !activePage) return;

            const config = await fetchDrawings(activePage.id);
            if (!config) return;

            const ctx = canvas.getContext('2d');
            
            // Fit to container width, maintain aspect ratio
            const container = containerRef.current;
            const contW = container.clientWidth;
            const naturalW = activePage.image && img ? (img.naturalWidth || 800) : 1920;
            const naturalH = activePage.image && img ? (img.naturalHeight || 600) : 1080;
            
            const fitScale = contW / naturalW;
            const finalScale = fitScale * scale;

            canvas.width = naturalW * finalScale;
            canvas.height = naturalH * finalScale;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(finalScale, finalScale);

            // Draw objects
            const objects = (config.objects || config.drawings?.objects || []);
            for (const obj of objects) {
                ctx.save();
                ctx.translate((obj.left || 0), (obj.top || 0));
                ctx.rotate((obj.angle || 0) * Math.PI / 180);
                ctx.scale((obj.scaleX || 1), (obj.scaleY || 1));

                if (obj.isDevice || obj.customType === 'device_value') {
                    const devId = obj.deviceId || obj.device_id;
                    const param = obj.deviceParam || obj.device_param || obj.param;
                    let val = deviceData[devId]?.[param] ?? 0;
                    const text = (obj.textFormat || '{val}').replace('{val}', parseFloat(val).toFixed(obj.decimals ?? 2));
                    
                    ctx.font = `${obj.fontWeight || ''} ${obj.fontSize || 20}px ${obj.fontFamily || 'Orbitron'}`;
                    ctx.fillStyle = obj.fill || '#ca8a04'; // yellow-600
                    ctx.fillText(text, 0, 0);
                } else if (obj.customType === 'status_indicator') {
                     // Simplified status for mobile
                     const devId = obj.deviceId || obj.device_id;
                     const online = !!deviceData[devId];
                     ctx.beginPath();
                     ctx.arc(0, 0, obj.radius || 10, 0, Math.PI * 2);
                     ctx.fillStyle = online ? '#10b981' : '#ef4444';
                     ctx.fill();
                } else if (obj.type === 'i-text' || obj.type === 'text') {
                    ctx.font = `${obj.fontWeight || ''} ${obj.fontSize || 20}px ${obj.fontFamily || 'Orbitron'}`;
                    ctx.fillStyle = obj.fill || '#334155'; // slate-700
                    ctx.fillText(obj.text || '', 0, 0);
                }
                ctx.restore();
            }
            ctx.restore();
        };

        if (activePage && deviceData) draw();
    }, [activePage, deviceData, scale]);


    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-800 pb-24">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600 border border-yellow-200">
                        <MapIcon size={20} />
                    </div>
                    <div>
                        <h2 className="font-orbitron font-bold text-lg leading-none bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 bg-clip-text text-transparent">SCADA VIEW</h2>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Live Telemetry</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={() => setScale(s => Math.min(s * 1.2, 3))} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:border-slate-300 shadow-sm"><ZoomIn size={18} /></button>
                     <button onClick={() => setScale(s => Math.max(s / 1.2, 0.5))} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:border-slate-300 shadow-sm"><ZoomOut size={18} /></button>
                </div>
            </div>

            {/* Page Selector */}
            <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar bg-slate-100 border-b border-slate-200">
                {pages.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePage(p)}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                            activePage?.id === p.id 
                                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md' 
                                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {p.name}
                    </button>
                ))}
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 overflow-auto relative bg-slate-50" ref={containerRef}>
                {activePage ? (
                    <div className="relative min-h-full flex items-center justify-center p-4">
                        {/* Background Image Layer */}
                        {activePage && activePage.image && (
                            <img
                                ref={imgRef}
                                src={String(activePage.image).startsWith('data:') ? activePage.image : `${getApiBase()}/photoview/${selectedProject}/images/${encodeURIComponent(String(activePage.image).split('/').pop())}`}
                                className="absolute top-0 left-0 w-full h-auto opacity-50 pointer-events-none mix-blend-multiply"
                                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                                alt="map"
                            />
                        )}
                        
                        {/* Canvas Layer */}
                        <canvas 
                            ref={canvasRef}
                            className="relative z-10"
                        />
                        
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-30">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                                    <span className="text-[10px] font-bold text-yellow-600 tracking-widest animate-pulse">SYNCING...</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                        <Layers size={48} className="opacity-20" />
                        <p className="text-xs uppercase tracking-widest">Select a View</p>
                    </div>
                )}
            </div>
            
            {/* Footer Stats */}
            <div className="p-2 bg-white/80 backdrop-blur-md border-t border-slate-200 text-[10px] text-slate-500 flex justify-between font-mono">
                <span>Updated: {new Date().toLocaleTimeString()}</span>
                <span className="flex items-center gap-1 text-emerald-600"><RefreshCw size={10} className="animate-spin-slow" /> LIVE</span>
            </div>
        </div>
    );
};

export default MobilePhotoView;
