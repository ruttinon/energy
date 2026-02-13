import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { getApiBase } from '../../../../../../services/api';

const PhotoEditorContext = createContext();

export const PhotoEditorProvider = ({ children }) => {
    // Fabric Instance
    const canvasRef = useRef(null);      // <canvas> DOM element
    const fabricCanvas = useRef(null);   // fabric.Canvas instance
    const [isReady, setIsReady] = useState(false);

    // Editor State
    const [activeTool, setActiveTool] = useState('select'); // select, hand, text, shape...
    const [selectedObject, setSelectedObject] = useState(null);
    const [zoom, setZoomState] = useState(1);
    const [gridVisible, setGridVisible] = useState(true);
    const [inspectorPopupVisible, setInspectorPopupVisible] = useState(false);

    // Pages State
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(null);

    // Clipboard & History
    const clipboard = useRef(null);
    const history = useRef([]);
    const historyStep = useRef(-1);
    const isHistoryLocked = useRef(false);

    // Save History Snapshot
    const saveHistory = () => {
        if (isHistoryLocked.current || !fabricCanvas.current) return;
        const json = JSON.stringify(fabricCanvas.current.toJSON(['id', 'customType', 'deviceId', 'converterId', 'param', 'controlTarget', 'unit', 'decimals', 'billingPeriod', 'dateFormat', 'switchState']));
        
        // Remove redo steps if we branch out
        if (historyStep.current < history.current.length - 1) {
            history.current = history.current.slice(0, historyStep.current + 1);
        }
        history.current.push(json);
        historyStep.current = history.current.length - 1;
        
        // Limit history size
        if (history.current.length > 50) {
            history.current.shift();
            historyStep.current--;
        }
    };

    const setZoom = (val) => {
        const c = fabricCanvas.current;
        if (!c) return;
        
        // Ensure val is function or number
        let newZoom = typeof val === 'function' ? val(c.getZoom()) : val;
        
        // Constraints
        if (newZoom > 20) newZoom = 20;
        if (newZoom < 0.1) newZoom = 0.1;
        
        c.setZoom(newZoom);
        setZoomState(newZoom);
        c.requestRenderAll();
    };

    // Helpers
    const setCanvas = (c) => {
        fabricCanvas.current = c;
        setIsReady(!!c);
        if (c) {
            // Initial History
            saveHistory();
            c.on('object:modified', saveHistory);
            c.on('object:added', (e) => { if(!isHistoryLocked.current) saveHistory(); });
            c.on('object:removed', (e) => { if(!isHistoryLocked.current) saveHistory(); });
            c.on('selection:created', (e) => setSelectedObject((e && e.selected && e.selected[0]) || e?.target || null));
            c.on('selection:updated', (e) => setSelectedObject((e && e.selected && e.selected[0]) || e?.target || null));
            c.on('selection:cleared', () => setSelectedObject(null));
        }
    };

    // --- DATA ACTIONS ---

    const refreshPages = useCallback(async (pid) => {
        if (!pid) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${pid}/pages`);
            const data = await res.json();
            setPages(data.pages || []);
        } catch (e) { console.error("Failed to load pages", e); }
    }, []);

    const loadPage = useCallback(async (page, pid) => {
        const canvas = fabricCanvas.current;
        if (!canvas || !page || !pid) return;

        console.log("Loading Page:", page.name);
        canvas.clear();
        // Reset transform
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.setBackgroundColor('#050505', canvas.renderAll.bind(canvas));

        try {
            // 1. Load Drawings
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${pid}/drawings/${page.id}`);
            let json = await res.json();
            if (json && json.drawings && json.drawings.objects) {
                json = json.drawings;
            }

            let styleCanvas = null;
            try {
                const sres = await fetch(`${API}/photoview/${pid}/get_style/${page.id}`);
                const sjson = await sres.json();
                styleCanvas = sjson.style?.canvas || null;
            } catch {}

            const fnLoadBg = () => {
                if (page && page.image) {
                    const isData = String(page.image || '').startsWith('data:');
                    const filename = String(page.image || '').includes('://') ? String(page.image).split('/').pop() : page.image;
                    const imgUrl = isData ? String(page.image) : `${API}/photoview/${pid}/images/${encodeURIComponent(filename)}`;
                    window.fabric.Image.fromURL(imgUrl, (img) => {
                        if (img) {
                            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                                originX: 'left', originY: 'top'
                            });
                            const w = img.width || img._element?.naturalWidth || canvas.getWidth();
                            const h = img.height || img._element?.naturalHeight || canvas.getHeight();
                            canvas.setDimensions({ width: w, height: h });
                            canvas.requestRenderAll();
                        } else {
                            const w = styleCanvas?.width || styleCanvas?.canvas?.width || 1920;
                            const h = styleCanvas?.height || styleCanvas?.canvas?.height || 1080;
                            const bgCol = styleCanvas?.backgroundColor || styleCanvas?.canvas?.backgroundColor || '#050505';
                            canvas.setDimensions({ width: w, height: h });
                            canvas.setBackgroundColor(bgCol, canvas.renderAll.bind(canvas));
                        }
                    });
                } else {
                    const w = styleCanvas?.width || styleCanvas?.canvas?.width || 1920;
                    const h = styleCanvas?.height || styleCanvas?.canvas?.height || 1080;
                    const bgCol = styleCanvas?.backgroundColor || styleCanvas?.canvas?.backgroundColor || '#050505';
                    canvas.setDimensions({ width: w, height: h });
                    canvas.setBackgroundColor(bgCol, canvas.renderAll.bind(canvas));
                }
            };

            if (json && json.objects && json.objects.length > 0) {
                // Sanitize JSON to fix "alphabetical" error from old Fabric versions
                const sanitize = (obj) => {
                    if (obj.textBaseline === 'alphabetical') obj.textBaseline = 'alphabetic';
                    if (obj.objects && Array.isArray(obj.objects)) obj.objects.forEach(sanitize);
                };
                json.objects.forEach(sanitize);

                canvas.loadFromJSON(json, () => {
                    fnLoadBg();
                    console.log("Canvas Loaded JSON");
                });
            } else {
                fnLoadBg();
            }
        } catch (e) { console.error("Load Error", e); }
    }, []);

    const save = async () => {
        if (!currentPage || !isReady) return;
        // Assume pid is available via hook or we need to pass it.
        // But save() is called from UI which might not know PID.
        // We need PID in context state?
        // Or we use the shim trick again? 
        // Better: store pid in state when refreshing pages.
    };

    // We need selectedProject in the Provider scope to use it in save()
    // But Provider is top level.
    // Solution: We'll pass save(pid) from the UI or use the Ref to store PID.
    const projectRef = useRef(null);

    // Keyboard Events
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['Delete', 'Backspace'].includes(e.key)) {
                // Ignore if typing in input
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

                const canvas = fabricCanvas.current;
                if (!canvas) return;

                const active = canvas.getActiveObjects();
                if (active.length) {
                    canvas.discardActiveObject();
                    active.forEach(obj => canvas.remove(obj));
                    canvas.requestRenderAll();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const value = {
        canvasRef, fabricCanvas, isReady, setCanvas,
        activeTool, setActiveTool,
        selectedObject, setSelectedObject,
        zoom, setZoom,
        gridVisible, setGridVisible,
        pages, setPages,
        currentPage, setCurrentPage,
        inspectorPopupVisible, setInspectorPopupVisible,

        refreshPages,
        loadPage,
        projectRef, // Expose ref to set PID

        // Save wrapped with ref
        save: async () => {
            const pid = projectRef.current;
            const canvas = fabricCanvas.current;
            if (!currentPage || !pid || !canvas) return;
            try {
                // Include custom fields
                const json = canvas.toJSON(['converterId', 'deviceId', 'param', 'id', 'customType', 'selectable', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'controlTarget', 'unit', 'decimals', 'billingPeriod', 'dateFormat']);
                const API = getApiBase();
                await fetch(`${API}/photoview/${pid}/drawings/${currentPage.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json)
                });
                alert("Saved!");
            } catch (e) { alert("Save failed"); }
        },

        undo: () => {
            const c = fabricCanvas.current;
            if (!c || historyStep.current <= 0) return;
            isHistoryLocked.current = true;
            historyStep.current -= 1;
            c.loadFromJSON(history.current[historyStep.current], () => {
                c.renderAll();
                isHistoryLocked.current = false;
            });
        },
        redo: () => { 
            const c = fabricCanvas.current;
            if (!c || historyStep.current >= history.current.length - 1) return;
            isHistoryLocked.current = true;
            historyStep.current += 1;
            c.loadFromJSON(history.current[historyStep.current], () => {
                c.renderAll();
                isHistoryLocked.current = false;
            });
        },
        copy: () => {
            const c = fabricCanvas.current;
            const active = c?.getActiveObject();
            if (active) {
                active.clone((cloned) => {
                    clipboard.current = cloned;
                }, ['converterId', 'deviceId', 'param', 'customType', 'controlTarget', 'unit', 'decimals', 'billingPeriod', 'dateFormat']);
            }
        },
        cut: () => {
            const c = fabricCanvas.current;
            const active = c?.getActiveObject();
            if (active) {
                active.clone((cloned) => {
                    clipboard.current = cloned;
                    c.remove(active);
                    c.requestRenderAll();
                }, ['converterId', 'deviceId', 'param', 'customType', 'controlTarget', 'unit', 'decimals', 'billingPeriod', 'dateFormat']);
            }
        },
        paste: () => {
            const c = fabricCanvas.current;
            if (!c || !clipboard.current) return;
            clipboard.current.clone((cloned) => {
                c.discardActiveObject();
                cloned.set({
                    left: cloned.left + 10,
                    top: cloned.top + 10,
                    evented: true,
                });
                if (cloned.type === 'activeSelection') {
                    // active selection needs special handling
                    cloned.canvas = c;
                    cloned.forEachObject((obj) => {
                        c.add(obj);
                    });
                    cloned.setCoords();
                } else {
                    c.add(cloned);
                }
                clipboard.current.top += 10;
                clipboard.current.left += 10;
                c.setActiveObject(cloned);
                c.requestRenderAll();
            }, ['converterId', 'deviceId', 'param', 'customType', 'controlTarget', 'unit', 'decimals', 'billingPeriod', 'dateFormat']);
        }
    };

    // --- REAL DATA FETCHING ---
    const [deviceList, setDeviceList] = useState([]);
    const [billingConfig, setBillingConfig] = useState(null);
    const [deviceParamsCache, setDeviceParamsCache] = useState({});
    const [lastReadings, setLastReadings] = useState({});
    const { billingSummary } = useApp();

    // Fetch Device List
    const { devices: appDevices } = useApp();

    useEffect(() => {
        if (Array.isArray(appDevices) && appDevices.length) {
            const mapped = appDevices.map(d => ({
                id: String(d.id),
                name: d.name,
                converter: d.converter
            }));
            setDeviceList(mapped);
        }
    }, [appDevices]);

    const fetchDeviceList = useCallback(async (pid) => {
        try {
            if (!pid) {
                setDeviceList([]);
                return;
            }
            
            const API = getApiBase();
            try {
                const res = await fetch(`${API}/public/projects/${encodeURIComponent(pid)}/devices`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                let data;
                try {
                    data = await res.json();
                } catch {
                    throw new Error('Invalid JSON from public devices');
                }
                const devList = (data.devices || []).map(d => ({
                    id: String(d.id),
                    name: d.name,
                    converter: d.converter
                }));
                setDeviceList(devList);
            } catch (fetchError) {
                console.debug("Public device list not available, using app context devices", fetchError?.message);
                // Fall back to app context devices if public endpoint fails
                setDeviceList([]);
            }
        } catch (e) {
            console.debug("Failed to load device list", e?.message);
            setDeviceList([]);
        }
    }, []);

    // Fetch Billing Config
    const fetchBillingConfig = useCallback(async (pid) => {
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/billing/config?project_id=${pid}`);
            const data = await res.json();
            setBillingConfig(data);
        } catch (e) {
            console.error("Failed to load billing config", e);
        }
    }, []);

    // Fetch Device Params (Lazy Load)
    const fetchDeviceParams = useCallback(async (pid, devId) => {
        if (deviceParamsCache[devId]) return deviceParamsCache[devId];
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${pid}/device_params/${devId}`);
            const data = await res.json();
            const params = data.params || [];

            setDeviceParamsCache(prev => ({ ...prev, [devId]: params }));
            return params;
        } catch (e) {
            console.error("Failed to load device params", e);
            return [];
        }
    }, [deviceParamsCache]);

    const fetchDeviceOutputs = useCallback(async (devId) => {
        try {
            if (!devId) return [];
            
            const API = getApiBase();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            try {
                const res = await fetch(`${API}/control/devices/${devId}/outputs`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);
                
                if (!res.ok) {
                    console.debug(`Device outputs not available (HTTP ${res.status})`);
                    return [];
                }
                
                const data = await res.json();
                return data.outputs || [];
            } catch (error) {
                clearTimeout(timeout);
                if (error.name === 'AbortError') {
                    console.debug(`Device outputs request timeout for device ${devId}`);
                } else {
                    console.debug(`Failed to load device outputs for device ${devId}:`, error?.message);
                }
                return [];
            }
        } catch (e) {
            console.debug("Device outputs error:", e?.message);
            return [];
        }
    }, []);

    // Live Data Loop
    useEffect(() => {
        if (!isReady || !projectRef.current) return;

        const INTERVAL_MS = 2000;
        const interval = setInterval(async () => {
            const canvas = fabricCanvas.current;
            const pid = projectRef.current;
            if (!canvas || !pid) return;

            const objects = canvas.getObjects();
            const boundObjects = objects.filter(o => o.deviceId && o.param && (o.type === 'i-text' || o.type === 'text'));
            const statusObjects = objects.filter(o => o.customType === 'status_indicator');
            const billingObjects = objects.filter(o => o.customType === 'billing_value' && (o.type === 'i-text' || o.type === 'text'));
            const dateObjects = objects.filter(o => o.customType === 'datetime' && (o.type === 'i-text' || o.type === 'text'));

            if (boundObjects.length === 0 && statusObjects.length === 0 && billingObjects.length === 0 && dateObjects.length === 0) return;

            // Collect unique devices to fetch
            const devIds = new Set();
            boundObjects.forEach(o => { if (o.deviceId) devIds.add(o.deviceId); });
            statusObjects.forEach(o => {
                if (o.statusMode === 'device' && o.deviceId) devIds.add(o.deviceId);
                else if (o.statusMode === 'converter' && o.converterId) {
                    // include all devices under the converter to check online
                    (deviceList || []).filter(d => d.converter === o.converterId).forEach(d => devIds.add(String(d.id)));
                }
            });
            const devIdsArr = Array.from(devIds);
            const API = getApiBase();
            let needsRender = false;

            // Fetch data for each device (could be optimized to batch if API supported it)
            // Using Promise.all to fetch in parallel
            try {
                // Batch Fetch Upgrade
                const API = getApiBase();
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                try {
                    const res = await fetch(`${API}/photoview/${pid}/readings/batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(devIdsArr),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    
                    if (!res.ok) {
                        console.debug(`Batch readings not available (HTTP ${res.status})`);
                        setLastReadings({});
                        return;
                    }
                    
                    const json = await res.json();
                    const dataMap = json.data || {};
                    setLastReadings(dataMap);
                } catch (error) {
                    clearTimeout(timeout);
                    if (error.name === 'AbortError') {
                        console.debug("Batch readings request timeout");
                    } else {
                        console.debug("Failed to fetch batch readings:", error?.message);
                    }
                    setLastReadings({});
                    return;
                }

                boundObjects.forEach(obj => {
                    const devData = dataMap[obj.deviceId];
                    let val = devData ? devData[obj.param] : null;

                    // calculated fields
                    if (obj.param === 'billing_cost' && devData && billingConfig) {
                        const energy = parseFloat(devData['energy'] || 0); // Assuming 'energy' is the key for kWh
                        // Or try variations like 'ActiveEnergy', 'ImportEnergy'
                        const kwh = energy || parseFloat(devData['ActiveEnergy'] || 0) || 0;
                        const price = billingConfig.price_per_unit || 5;
                        val = kwh * price;
                    }

                    const nowTs = Date.now();
                    const rMs = parseInt(obj.refreshMs || INTERVAL_MS);
                    const lastTs = parseInt(obj.lastUpdateTs || 0);
                    const allowUpdate = (nowTs - lastTs) >= rMs;

                    if (val !== undefined && val !== null && allowUpdate) {
                        // Format
                        let displayVal = val;
                        if (typeof val === 'number') {
                            displayVal = val.toFixed(2);
                        }

                        if (obj.text !== displayVal) {
                            obj.set('text', String(displayVal));
                            obj.set('lastUpdateTs', nowTs);
                            needsRender = true;
                        }

                        // Conditional Logic (Basic)
                        const numVal = parseFloat(val);
                        if (!isNaN(numVal)) {
                            // Example: If voltage > 240 red? (This should be moved to user-defined logic later)
                            // For now keeping simple: if user didn't override color manually...
                            // Actually, let's NOT override color automatically unless we have the Logic system fully hooked up
                            // to avoid annoying the user.
                        }
                    }
                });

                for (const obj of statusObjects) {
                    let online = false;
                    if (obj.statusMode === 'device' && obj.deviceId) {
                        const devData = dataMap[obj.deviceId];
                        online = !!(devData && Object.keys(devData).length > 0);
                    } else if (obj.statusMode === 'converter' && obj.converterId) {
                        try {
                            const r = await fetch(`${API}/photoview/${pid}/converter_ping/${encodeURIComponent(obj.converterId)}`);
                            const j = await r.json();
                            online = !!j.online;
                        } catch { online = false; }
                    }
                    const desiredUrl = online ? obj.onImageUrl : obj.offImageUrl;
                    if (desiredUrl) {
                        if (obj.type === 'image') {
                            try {
                                await new Promise((resolve) => obj.setSrc(desiredUrl, resolve));
                                needsRender = true;
                            } catch {}
                        } else {
                            await new Promise((resolve) => {
                                window.fabric.Image.fromURL(desiredUrl, (img) => {
                                    if (!img) return resolve();
                                    img.set({
                                        left: obj.left, top: obj.top,
                                        width: obj.width || 20, height: obj.height || 20,
                                        selectable: true
                                    });
                                    img.set('customType', 'status_indicator');
                                    img.statusMode = obj.statusMode;
                                    img.converterId = obj.converterId;
                                    img.deviceId = obj.deviceId;
                                    img.onImageUrl = obj.onImageUrl;
                                    img.offImageUrl = obj.offImageUrl;
                                    canvas.remove(obj);
                                    canvas.add(img);
                                    needsRender = true;
                                    resolve();
                                });
                            });
                        }
                    }
                }

                billingObjects.forEach(obj => {
                    const period = (obj.billingPeriod || 'day').toLowerCase();
                    const scope = (obj.billingScope || 'device');
                    let val = 0;
                    if (scope === 'converter' && obj.converterId) {
                        if (period === 'day') val = (billingSummary?.today_money || 0);
                        else val = (billingSummary?.month_money || 0);
                    } else {
                        const devData = dataMap[obj.deviceId] || {};
                        const price = billingConfig?.price_per_unit || 5;
                        const kwh = parseFloat(devData['energy'] || devData['ActiveEnergy'] || 0) || 0;
                        if (period === 'day') val = kwh * price;
                        else val = kwh * price; // placeholder; monthly aggregation requires history, using same for now
                    }
                    const dec = parseInt(obj.decimals || 2);
                    let displayVal = typeof val === 'number' ? Number(val).toFixed(isNaN(dec) ? 2 : dec) : String(val);
                    const fmt = obj.textFormat || '{val}';
                    const txt = fmt.replace('{val}', displayVal);
                    if (obj.text !== txt) {
                        obj.set('text', txt);
                        needsRender = true;
                    }
                });

                const formatDate = (d, fmt) => {
                    const pad = (n) => n.toString().padStart(2, '0');
                    const YYYY = d.getFullYear().toString();
                    const MM = pad(d.getMonth() + 1);
                    const DD = pad(d.getDate());
                    const HH = pad(d.getHours());
                    const mm = pad(d.getMinutes());
                    const ss = pad(d.getSeconds());
                    return (fmt || 'YYYY-MM-DD HH:mm:ss')
                        .replace('YYYY', YYYY)
                        .replace('MM', MM)
                        .replace('DD', DD)
                        .replace('HH', HH)
                        .replace('mm', mm)
                        .replace('ss', ss);
                };
                dateObjects.forEach(obj => {
                    const now = new Date();
                    const txt = formatDate(now, obj.dateFormat || 'YYYY-MM-DD HH:mm:ss');
                    if (obj.text !== txt) {
                        obj.set('text', txt);
                        needsRender = true;
                    }
                });

                if (needsRender) canvas.requestRenderAll();

            } catch (e) {
                console.error("Data refresh loop error", e);
            }

        }, INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isReady, billingConfig, billingSummary]);

    // Expose new data methods
    const extendedValue = {
        ...value,
        deviceList,
        fetchDeviceList,
        fetchDeviceParams,
        fetchDeviceOutputs,
        fetchBillingConfig,
        billingConfig,
        deviceParamsCache,
        lastReadings
    };

    return (
        <PhotoEditorContext.Provider value={extendedValue}>
            <ContextLoader shim={extendedValue} />
            {children}
        </PhotoEditorContext.Provider>
    );
};

const ContextLoader = ({ shim }) => {
    const { selectedProject } = useApp();
    const { refreshPages, loadPage, currentPage, projectRef } = shim;
    const { pages, setCurrentPage } = shim;

    // Sync PID to ref
    useEffect(() => {
        projectRef.current = selectedProject;
    }, [selectedProject]);

    // Initial Load
    useEffect(() => {
        if (selectedProject) {
            refreshPages(selectedProject);
            shim.fetchDeviceList(selectedProject);
            shim.fetchBillingConfig(selectedProject);
        }
    }, [selectedProject, refreshPages]);

    // Page Load
    useEffect(() => {
        if (selectedProject && currentPage) loadPage(currentPage, selectedProject);
    }, [currentPage, selectedProject, loadPage]);

    useEffect(() => {
        if (!currentPage && pages && pages.length > 0) {
            setCurrentPage(pages[0]);
        }
    }, [pages, currentPage, setCurrentPage]);

    return null;
};

export const useEditor = () => {
    const context = useContext(PhotoEditorContext);
    if (!context) throw new Error("useEditor must be used within PhotoEditorProvider");
    return context;
};
