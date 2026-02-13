import React, { useEffect, useRef } from 'react';
import { useEditor } from './PhotoEditorContext';

const CanvasArea = () => {
    const { setCanvas, setSelectedObject, setZoom, setActiveTool, activeTool, gridVisible } = useEditor();
    const { lastReadings, fetchDeviceOutputs } = useEditor();
    const containerRef = useRef(null);
    const canvasElRef = useRef(null);
    const wrapperRef = useRef(null);
    const fabricRef = useRef(null); // Keep track of local instance
    const panHandlersRef = useRef({ down: null, move: null, up: null, attached: false });
    const toolRef = useRef('select');

    // Initialize Fabric
    useEffect(() => {
        if (!window.fabric || !canvasElRef.current) return;

        try {
            console.log("Initializing Fabric...");
            const canvas = new window.fabric.Canvas(canvasElRef.current, {
            backgroundColor: '#ffffff',
            selection: true,
            preserveObjectStacking: true,
                controlsAboveOverlay: true,
                centeredScaling: true, // Better UX
                uniScaleTransform: true,
                width: 1920, // Default Large Canvas
                height: 1080
            });

            if (!canvas) {
                console.error("Failed to create canvas");
                return;
            }

            fabricRef.current = canvas;
        setCanvas(canvas);
        const syncWrapperSize = () => {
            try {
                const w = canvas.getWidth();
                const h = canvas.getHeight();
                if (wrapperRef.current) {
                    wrapperRef.current.style.width = `${w}px`;
                    wrapperRef.current.style.height = `${h}px`;
                }
            } catch {}
        };
        syncWrapperSize();
        canvas.on('after:render', syncWrapperSize);

        // Event Bindings
        
        canvas.on('mouse:down', async (e) => {
            try { console.log('mouse:down', { tool: toolRef.current, hasTarget: !!e.target }); } catch {}
            const p = canvas.getPointer(e.e);
            const vpt = canvas.viewportTransform || [1,0,0,1,0,0];
            const pointer = {
                x: (p.x - vpt[4]) / vpt[0],
                y: (p.y - vpt[5]) / vpt[3]
            };
            if (Number.isNaN(pointer.x) || Number.isNaN(pointer.y)) {
                const rect = canvas.upperCanvasEl.getBoundingClientRect();
                const x = e.e.clientX - rect.left;
                const y = e.e.clientY - rect.top;
                pointer.x = (x - vpt[4]) / vpt[0];
                pointer.y = (y - vpt[5]) / vpt[3];
            }
            // Add-mode: place new objects where clicked
            const tool = toolRef.current;
            if (tool === 'add_text') {
                const obj = new window.fabric.IText('New Text', {
                    left: pointer.x, top: pointer.y,
                    fill: '#ffffff',
                    fontFamily: 'Inter',
                    selectable: true, evented: true
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_rect') {
                const obj = new window.fabric.Rect({
                    left: pointer.x, top: pointer.y, width: 120, height: 60,
                    fill: '#fbbf24', opacity: 0.5, selectable: true, evented: true
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_date') {
                const obj = new window.fabric.IText('YYYY-MM-DD HH:mm:ss', {
                    left: pointer.x, top: pointer.y,
                    fontSize: 20, fill: '#0ea5e9',
                    fontFamily: 'Orbitron', customType: 'datetime',
                    dateFormat: 'YYYY-MM-DD HH:mm:ss'
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_label') {
                const obj = new window.fabric.IText('Label', {
                    left: pointer.x, top: pointer.y,
                    fontSize: 16, fill: '#e2e8f0', fontFamily: 'Kanit'
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_value') {
                const obj = new window.fabric.IText('0.00', {
                    left: pointer.x, top: pointer.y,
                    fontSize: 32, fill: '#0ea5e9', fontFamily: 'Orbitron',
                    customType: 'data_value'
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_status') {
                const obj = new window.fabric.Circle({
                    left: pointer.x, top: pointer.y,
                    radius: 10, fill: '#64748b'
                });
                obj.set('customType', 'status_indicator');
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_switch') {
                const rect = new window.fabric.Rect({
                    left: pointer.x, top: pointer.y,
                    width: 60, height: 30, rx: 6, ry: 6,
                    fill: '#334155', stroke: '#94a3b8', strokeWidth: 2
                });
                const label = new window.fabric.IText('OFF', {
                    left: pointer.x + 8, top: pointer.y + 6,
                    fontSize: 16, fill: '#e2e8f0', fontFamily: 'Kanit'
                });
                const group = new window.fabric.Group([rect, label], { left: pointer.x, top: pointer.y });
                group.set('customType', 'switch_button');
                group.switchState = 'OFF';
                canvas.add(group);
                canvas.setActiveObject(group);
                setSelectedObject(group);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_billing') {
                const obj = new window.fabric.IText('฿0.00', {
                    left: pointer.x, top: pointer.y,
                    fontSize: 24, fill: '#ec4899', fontFamily: 'Kanit',
                    customType: 'billing_value'
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            } else if (tool === 'add_circle') {
                const obj = new window.fabric.Circle({
                    left: pointer.x, top: pointer.y,
                    radius: 50, fill: 'transparent', stroke: '#64748b', strokeWidth: 2
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                setSelectedObject(obj);
                canvas.requestRenderAll();
                setActiveTool('select');
                return;
            }
            const t = e.target;
            if (!t) return;
            const type = t.customType || (t._objects && t._objects[0] && t._objects[0].customType);
            if (type === 'switch_button') {
                const group = t._objects ? t : null;
                const isImage = t.type === 'image';
                const rect = group ? group._objects[0] : (isImage ? null : t);
                const label = group ? group._objects[1] : null;
                const deviceId = t.deviceId || (rect && rect.deviceId);
                const controlTarget = t.controlTarget || (rect && rect.controlTarget);
                if (!deviceId || !controlTarget) return;
                try {
                    const API = (await import('../../../../../../services/api')).getApiBase();
                    const next = (t.switchState || 'OFF').toUpperCase() === 'ON' ? 'OFF' : 'ON';
                    await fetch(`${API}/control/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ device_id: String(deviceId), control_target: controlTarget, action: next })
                    });
                    t.switchState = next;
                    if (isImage) {
                        const url = next === 'ON' ? (t.onImageUrl || '') : (t.offImageUrl || '');
                        if (url) await new Promise((resolve) => t.setSrc(url, resolve));
                    } else {
                        if (label) label.set('text', next);
                        if (rect) rect.set('stroke', next === 'ON' ? '#10b981' : '#ef4444');
                    }
                    canvas.requestRenderAll();
                } catch {}
            }
        });

        // Update Zoom State on Scroll (Ctrl+Wheel)
        canvas.on('mouse:wheel', function (opt) {
            if (opt.e.ctrlKey) {
                opt.e.preventDefault();
                let delta = opt.e.deltaY;
                let zoom = canvas.getZoom();
                zoom *= 0.999 ** delta;
                if (zoom > 20) zoom = 20;
                if (zoom < 0.1) zoom = 0.1;
                canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
                opt.e.stopPropagation();
                setZoom(zoom);
            }
        });

        // No ResizeObserver here to allow natural scroll if canvas is large
        // But we might want to update canvas size if user changes page size setting (future)

        } catch (err) {
            console.error("Canvas initialization error:", err);
        }

        return () => {
            try {
                if (fabricRef.current && typeof fabricRef.current.dispose === 'function') {
                    fabricRef.current.dispose();
                }
            } catch (err) {
                console.warn("Error disposing canvas:", err);
            }
            setCanvas(null);
            fabricRef.current = null;
        };
    }, []);

    // Keep toolRef synced with current activeTool to avoid stale closure
    useEffect(() => {
        toolRef.current = activeTool;
    }, [activeTool]);

    // Tool Updates & Cursor
    const canvas = fabricRef.current;

    useEffect(() => {
        if (!canvas) return;

        canvas.isDrawingMode = false; // Reset unless drawing tool
        canvas.selection = true;
        canvas.defaultCursor = 'default';

        if (activeTool === 'pan') {
            canvas.defaultCursor = 'grab';
            canvas.selection = false;
            if (!panHandlersRef.current.down) {
                panHandlersRef.current.down = function (opt) {
                    const evt = opt.e;
                    this.isDragging = true;
                    this.selection = false;
                    this.lastPosX = evt.clientX;
                    this.lastPosY = evt.clientY;
                };
                panHandlersRef.current.move = function (opt) {
                    if (this.isDragging) {
                        const e = opt.e;
                        const vpt = this.viewportTransform;
                        vpt[4] += e.clientX - this.lastPosX;
                        vpt[5] += e.clientY - this.lastPosY;
                        this.requestRenderAll();
                        this.lastPosX = e.clientX;
                        this.lastPosY = e.clientY;
                    }
                };
                panHandlersRef.current.up = function () {
                    this.setViewportTransform(this.viewportTransform);
                    this.isDragging = false;
                    this.selection = false;
                };
            }

            if (!panHandlersRef.current.attached) {
                canvas.on('mouse:down', panHandlersRef.current.down);
                canvas.on('mouse:move', panHandlersRef.current.move);
                canvas.on('mouse:up', panHandlersRef.current.up);
                panHandlersRef.current.attached = true;
            }
        } else {
            if (panHandlersRef.current.attached) {
                canvas.off('mouse:down', panHandlersRef.current.down);
                canvas.off('mouse:move', panHandlersRef.current.move);
                canvas.off('mouse:up', panHandlersRef.current.up);
                panHandlersRef.current.attached = false;
            }
            canvas.selection = true;
        }

        canvas.requestRenderAll();
    }, [activeTool, canvas]);

    // Grid Visibility
    useEffect(() => {
        // ... (Grid logic same)
    }, [gridVisible]);

    return (
        <div className="flex-1 w-full h-full relative overflow-auto bg-slate-50 scrollbar-hide pb-32 lg:pb-0" ref={containerRef}>
            {/* The Canvas Container with Shadow */}
            <div className="relative bg-white shadow-lg" ref={wrapperRef}>
                <canvas ref={canvasElRef} />
            </div>

            {/* Grid Overlay */}
            {gridVisible && (
                <div className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, #333 1px, transparent 1px),
                            linear-gradient(to bottom, #333 1px, transparent 1px)
                        `,
                        backgroundSize: '50px 50px',
                        opacity: 0.1,
                        width: '100%', height: '100%' // Cover scroll area
                    }}
                />
            )}
        </div>
    );
};

export default CanvasArea;
