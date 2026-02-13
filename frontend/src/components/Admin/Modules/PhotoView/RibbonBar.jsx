import React, { useState, useEffect } from 'react';
import { useEditor } from './PhotoEditorContext';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import {
    Save, Plus, Type, Cpu, Activity, Zap, Square, Circle, Image as ImageIcon,
    AlignLeft, AlignCenter, AlignRight, Group, Ungroup,
    Lock, Unlock, ZoomIn, ZoomOut, Grid3X3, Scissors, Copy, ClipboardList, Undo2, Redo2,
    MousePointer2, Banknote, CalendarClock, Settings, ChevronDown, RefreshCw, Edit3, Trash2
} from 'lucide-react';

const RibbonGroup = ({ title, children }) => (
    <div className="flex flex-col gap-1.5 px-3 py-2 border-r border-slate-200">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
        <div className="flex items-center gap-1.5">{children}</div>
    </div>
);

const ToolBtn = ({ icon: Icon, onClick, title, active, variant = 'default' }) => {
    const baseClass = "w-9 h-9 rounded-md flex items-center justify-center transition-all duration-150 group relative";
    const variantClass = active 
        ? 'bg-yellow-50 border border-yellow-500 text-yellow-600 shadow-sm' 
        : variant === 'danger'
        ? 'bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-500'
        : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-yellow-300 text-slate-600 hover:text-yellow-700 shadow-sm';
    
    return (
        <button onClick={onClick} className={`${baseClass} ${variantClass}`} title={title}>
            <Icon size={16} strokeWidth={2} />
        </button>
    );
};

const ActionBtn = ({ icon: Icon, label, onClick, variant = 'default' }) => {
    const variantClass = variant === 'primary'
        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white shadow-sm'
        : variant === 'success'
        ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm'
        : variant === 'danger'
        ? 'bg-red-500 hover:bg-red-400 text-white shadow-sm'
        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm';
    
    return (
        <button 
            onClick={onClick} 
            className={`px-3 h-8 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${variantClass}`}
        >
            <Icon size={14} />
            <span>{label}</span>
        </button>
    );
};

const RibbonBar = () => {
    const { fabricCanvas, pages, setPages, currentPage, setCurrentPage, save, activeTool, setActiveTool, zoom, setZoom, gridVisible, setGridVisible, undo, redo, copy, cut, paste, inspectorPopupVisible, setInspectorPopupVisible, loadPage } = useEditor();
    const { selectedProject } = useApp();
    const { showConfirm, showAlert, showPrompt } = useDialog();

    const [newOpen, setNewOpen] = useState(false);
    const [mode, setMode] = useState('image');
    const [pageName, setPageName] = useState('');
    const [blankW, setBlankW] = useState(1920);
    const [blankH, setBlankH] = useState(1080);
    const [blankBg, setBlankBg] = useState('#ffffff');
    const [pendingFile, setPendingFile] = useState(null);
    const [uploadList, setUploadList] = useState([]);
    const [bgColor, setBgColor] = useState('#000000');
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBg, setEditBg] = useState('#000000');
    const [editSelectedImage, setEditSelectedImage] = useState(null);
    const [editW, setEditW] = useState(1920);
    const [editH, setEditH] = useState(1080);

    const handleNew = () => { setNewOpen(true); setMode('image'); setPageName(''); setPendingFile(null); };
    
    const handleUploadNewPage = async (file) => {
        if (!selectedProject) return;
        const name = String(pageName || '').trim();
        if (!name) { showAlert("แจ้งเตือน", 'กรุณากรอกชื่อหน้า'); return; }
        if (!file) { showAlert("แจ้งเตือน", 'กรุณาเลือกรูปภาพ'); return; }
        try {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('file', file);
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/create_page`, { method: 'POST', body: fd });
            if (res.ok) {
                const j = await res.json();
                await refreshPages();
                if (j?.next?.page_id) {
                    const p = (pages || []).find(x => x.id === j.next.page_id);
                    if (p) setCurrentPage(p);
                } else if (pages?.length) {
                    setCurrentPage(pages[pages.length - 1]);
                }
                setNewOpen(false);
                setPendingFile(null);
                setPageName('');
            }
        } catch {}
    };

    const handleCreateBlank = async () => {
        if (!selectedProject) return;
        const name = String(pageName || '').trim();
        if (!name) { showAlert("แจ้งเตือน", 'กรุณากรอกชื่อหน้า'); return; }
        try {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('width', String(blankW));
            fd.append('height', String(blankH));
            fd.append('bg', String(blankBg));
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/create_page`, { method: 'POST', body: fd });
            if (res.ok) {
                const j = await res.json();
                await refreshPages();
                if (j?.next?.page_id) {
                    const p = (pages || []).find(x => x.id === j.next.page_id);
                    if (p) setCurrentPage(p);
                } else if (pages?.length) {
                    setCurrentPage(pages[pages.length - 1]);
                }
            }
        } finally {
            setNewOpen(false);
            setPageName('');
            setBlankW(1920);
            setBlankH(1080);
            setBlankBg('#000000');
            setPendingFile(null);
        }
    };

    const refreshPages = async () => {
        if (!selectedProject) return;
        try {
            const API = getApiBase();
            const r = await fetch(`${API}/photoview/${selectedProject}/pages`);
            const data = await r.json();
            setPages(data.pages || []);
        } catch {}
    };

    const renamePage = async () => {
        if (!selectedProject || !currentPage) return;
        const name = await showPrompt('Rename page', 'Enter new name:', currentPage.name || '');
        if (!name) return;
        try {
            const API = getApiBase();
            await fetch(`${API}/photoview/${selectedProject}/rename_page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: currentPage.id, new_name: name }) });
            await refreshPages();
            const p = (pages || []).find(x => x.id === currentPage.id);
            if (p) setCurrentPage(p);
        } catch {}
    };

    const deletePage = async () => {
        if (!selectedProject || !currentPage) return;
        const confirmed = await showConfirm('ลบหน้า', 'คุณต้องการลบหน้านี้ใช่หรือไม่?');
        if (!confirmed) return;
        try {
            const API = getApiBase();
            await fetch(`${API}/photoview/${selectedProject}/delete_page/${currentPage.id}`, { method: 'POST' });
            await refreshPages();
            setCurrentPage(null);
        } catch {}
    };

    const updateImageFileRibbon = async (file) => {
        if (!selectedProject || !currentPage || !file) return;
        try {
            const API = getApiBase();
            const fd = new FormData();
            fd.append('page_id', currentPage.id);
            fd.append('file', file);
            const res = await fetch(`${API}/photoview/${selectedProject}/update_image`, { method: 'POST', body: fd });
            if (res.ok) showAlert("สำเร็จ", 'อัปเดตพื้นหลังเรียบร้อย');
        } catch {}
    };

    const loadUploads = async () => {
        if (!selectedProject) return;
        try {
            const API = getApiBase();
            const r = await fetch(`${API}/photoview/${selectedProject}/uploads_list`);
            const data = await r.json();
            setUploadList((data?.icons || []).map(String));
        } catch {}
    };

    const setImageFromUploads = async (filename) => {
        if (!selectedProject || !currentPage || !filename) return;
        try {
            const API = getApiBase();
            const fd = new FormData();
            fd.append('page_id', currentPage.id);
            fd.append('filename', filename);
            const res = await fetch(`${API}/photoview/${selectedProject}/set_image`, { method: 'POST', body: fd });
            if (res.ok) {
                const r = await fetch(`${API}/photoview/${selectedProject}/pages`);
                const data = await r.json();
                const list = data.pages || [];
                setPages(list);
                const updated = list.find(x => String(x.id) === String(currentPage.id));
                if (updated) {
                    setCurrentPage(updated);
                    loadPage(updated, selectedProject);
                } else {
                    loadPage(currentPage, selectedProject);
                }
                showAlert('Success', 'Background Updated');
            }
        } catch {}
    };

    const saveBg = async () => {
        if (!selectedProject || !currentPage) return;
        try {
            const API = getApiBase();
            const payload = { canvas: { backgroundColor: bgColor } };
            await fetch(`${API}/photoview/${selectedProject}/save_style/${currentPage.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            showAlert('Success', 'Style Saved');
        } catch {}
    };

    useEffect(() => { loadUploads(); }, [selectedProject]);
    useEffect(() => {
        const run = async () => {
            if (!editOpen || !selectedProject || !currentPage) return;
            try {
                const API = getApiBase();
                const sres = await fetch(`${API}/photoview/${selectedProject}/get_style/${currentPage.id}`);
                const sjson = await sres.json();
                const c = sjson?.style?.canvas || {};
                setEditBg(c.backgroundColor || '#000000');
                setEditW(parseInt(c.width || 1920));
                setEditH(parseInt(c.height || 1080));
            } catch {}
        };
        run();
    }, [editOpen, selectedProject, currentPage]);

    const renameCurrent = async (newName) => {
        if (!selectedProject || !currentPage) return;
        const name = String(newName || '').trim();
        if (!name) return;
        try {
            const API = getApiBase();
            await fetch(`${API}/photoview/${selectedProject}/rename_page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: currentPage.id, new_name: name }) });
            await refreshPages();
            const p = (pages || []).find(x => x.id === currentPage.id);
            if (p) setCurrentPage(p);
        } catch {}
    };

    const saveBgColor = async (color) => {
        if (!selectedProject || !currentPage) return;
        try {
            const API = getApiBase();
            const payload = { canvas: { backgroundColor: color } };
            await fetch(`${API}/photoview/${selectedProject}/save_style/${currentPage.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            showAlert('Success', 'Style Saved');
        } catch {}
    };

    const handleAddTextLabel = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('Label', { left: center.left, top: center.top, fontSize: 16, fontFamily: 'Kanit', fill: '#e2e8f0' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };

    const handleAddTextValue = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('0.00', { left: center.left, top: center.top + 24, fontSize: 32, fontFamily: 'Orbitron', fill: '#0ea5e9', customType: 'data_value' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };

    const handleAddStatus = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const circle = new window.fabric.Circle({ left: center.left, top: center.top, radius: 10, fill: '#64748b' });
        circle.set('customType', 'status_indicator'); c.add(circle); c.setActiveObject(circle);
    };

    const handleAddSwitch = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const rect = new window.fabric.Rect({ left: center.left, top: center.top, width: 60, height: 30, rx: 6, ry: 6, fill: '#334155', stroke: '#94a3b8', strokeWidth: 2 });
        rect.set('customType', 'switch_button'); c.add(rect); c.setActiveObject(rect);
    };

    const handleAddRect = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const r = new window.fabric.Rect({ left: center.left, top: center.top, width: 100, height: 80, fill: 'transparent', stroke: '#64748b', strokeWidth: 2 });
        c.add(r); c.setActiveObject(r);
    };

    const handleAddCircle = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const circle = new window.fabric.Circle({ left: center.left, top: center.top, radius: 50, fill: 'transparent', stroke: '#64748b', strokeWidth: 2 });
        c.add(circle); c.setActiveObject(circle);
    };

    const handleAddBilling = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('฿0.00', { left: center.left, top: center.top + 50, fontSize: 24, fontFamily: 'Kanit', fill: '#ec4899', customType: 'billing_value' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };

    const handleAddDate = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('DD/MM/YYYY HH:mm', { left: center.left, top: center.top + 80, fontSize: 18, fontFamily: 'Kanit', fill: '#6366f1', customType: 'datetime' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };

    const handleAddImageClick = () => {
        const el = document.getElementById('ribbon-add-image-input');
        if (el) el.click();
    };

    const handleAddImageFile = async (file) => {
        const c = fabricCanvas.current; if (!c || !file || !selectedProject) return;
        try {
            const API = getApiBase();
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${API}/photoview/${selectedProject}/upload_icon`, { method: 'POST', body: fd });
            const j = await res.json();
            const filename = j.filename || file.name;
            const url = `${API}/photoview/${selectedProject}/images/${encodeURIComponent(filename)}`;
            const center = c.getCenter();
            window.fabric.Image.fromURL(url, (img) => {
                if (!img) return;
                img.set({ left: center.left, top: center.top, selectable: true });
                img.set('customType', 'image_asset');
                c.add(img); c.setActiveObject(img); c.requestRenderAll();
            });
        } catch {}
    };

    const alignCanvas = (mode) => {
        const c = fabricCanvas.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj) return;
        const center = c.getCenter();
        if (mode === 'left') obj.set('left', 20);
        if (mode === 'center') obj.set('left', center.left - (obj.width * obj.scaleX) / 2);
        if (mode === 'right') obj.set('left', c.getWidth() - (obj.width * obj.scaleX) - 20);
        c.requestRenderAll();
    };

    const groupSelection = () => {
        const c = fabricCanvas.current; if (!c) return;
        const sel = c.getActiveObjects(); if (sel.length <= 1) return;
        const group = new window.fabric.Group(sel);
        sel.forEach(o => c.remove(o));
        c.add(group); c.setActiveObject(group); c.requestRenderAll();
    };

    const ungroup = () => {
        const c = fabricCanvas.current; if (!c) return;
        const obj = c.getActiveObject(); if (!obj || obj.type !== 'group') return;
        const items = obj._objects;
        obj._restoreObjectsState();
        c.remove(obj);
        items.forEach(o => c.add(o));
        c.requestRenderAll();
    };

    const lockSel = () => { const c = fabricCanvas.current; if (!c) return; const o = c.getActiveObject(); if (!o) return; o.set('lockMovementX', true); o.set('lockMovementY', true); o.set('selectable', false); c.requestRenderAll(); };
    const unlockSel = () => { const c = fabricCanvas.current; if (!c) return; const o = c.getActiveObject(); if (!o) return; o.set('lockMovementX', false); o.set('lockMovementY', false); o.set('selectable', true); c.requestRenderAll(); };

    return (
        <div className="bg-white border-b border-slate-200 shadow-sm">
            {/* Top Bar - File & Save */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-slate-100">
                <ActionBtn icon={Plus} label="New Page" onClick={handleNew} variant="primary" />
                <ActionBtn icon={Save} label="Save" onClick={save} variant="success" />
                
                <div className="h-6 w-px bg-slate-200 mx-1" />
                
                {/* Page Selector */}
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <select
                        className="pv-select h-8 bg-slate-50 text-slate-700 border border-slate-200 rounded-md px-3 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
                        value={currentPage ? String(currentPage.id) : ''}
                        onChange={(e) => { const p = pages.find(x => String(x.id) === e.target.value); if (p) setCurrentPage(p); }}
                    >
                        <option value="">Select Page</option>
                        {pages.map(p => (<option key={p.id} value={String(p.id)}>{p.name}</option>))}
                    </select>
                    <button onClick={refreshPages} className="w-8 h-8 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors" title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={()=>{ setEditName(currentPage?.name || ''); setEditSelectedImage(currentPage?.image || null); setEditOpen(true); }} className="px-3 h-8 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-1.5 transition-colors">
                        <Edit3 size={13} />
                        Edit
                    </button>
                    <button onClick={deletePage} className="px-3 h-8 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 text-xs flex items-center gap-1.5 transition-colors">
                        <Trash2 size={13} />
                        Delete
                    </button>
                </div>

                <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                    <div className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        {selectedProject || 'No Project'}
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        {currentPage ? currentPage.name : 'No Page'}
                    </div>
                </div>
            </div>

            {/* Bottom Bar - Tools */}
            <div className="h-16 px-2 flex items-center gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                
                <RibbonGroup title="Selection">
                    <ToolBtn icon={MousePointer2} title="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
                </RibbonGroup>

                <RibbonGroup title="Text & Data">
                    <ToolBtn icon={Type} title="Label" active={activeTool === 'add_label'} onClick={() => setActiveTool('add_label')} />
                    <ToolBtn icon={Cpu} title="Value" active={activeTool === 'add_value'} onClick={() => setActiveTool('add_value')} />
                    <ToolBtn icon={Banknote} title="Billing" active={activeTool === 'add_billing'} onClick={() => setActiveTool('add_billing')} />
                    <ToolBtn icon={CalendarClock} title="Date" active={activeTool === 'add_date'} onClick={() => setActiveTool('add_date')} />
                </RibbonGroup>

                <RibbonGroup title="Controls">
                    <ToolBtn icon={Activity} title="Status" active={activeTool === 'add_status'} onClick={() => setActiveTool('add_status')} />
                    <ToolBtn icon={Zap} title="Switch" active={activeTool === 'add_switch'} onClick={() => setActiveTool('add_switch')} />
                </RibbonGroup>

                <RibbonGroup title="Shapes">
                    <ToolBtn icon={Square} title="Rectangle" active={activeTool === 'add_rect'} onClick={() => setActiveTool('add_rect')} />
                    <ToolBtn icon={Circle} title="Circle" active={activeTool === 'add_circle'} onClick={() => setActiveTool('add_circle')} />
                    <ToolBtn icon={ImageIcon} title="Image" active={activeTool === 'add_image'} onClick={() => { setActiveTool('add_image'); handleAddImageClick(); }} />
                    <input id="ribbon-add-image-input" type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddImageFile(f); e.target.value=''; }} />
                </RibbonGroup>

                <RibbonGroup title="Align">
                    <ToolBtn icon={AlignLeft} title="Left" onClick={() => alignCanvas('left')} />
                    <ToolBtn icon={AlignCenter} title="Center" onClick={() => alignCanvas('center')} />
                    <ToolBtn icon={AlignRight} title="Right" onClick={() => alignCanvas('right')} />
                </RibbonGroup>

                <RibbonGroup title="Group">
                    <ToolBtn icon={Group} title="Group" onClick={groupSelection} />
                    <ToolBtn icon={Ungroup} title="Ungroup" onClick={ungroup} />
                </RibbonGroup>

                <RibbonGroup title="Lock">
                    <ToolBtn icon={Lock} title="Lock" onClick={lockSel} />
                    <ToolBtn icon={Unlock} title="Unlock" onClick={unlockSel} />
                </RibbonGroup>

                <RibbonGroup title="Edit">
                    <ToolBtn icon={Undo2} title="Undo" onClick={undo} />
                    <ToolBtn icon={Redo2} title="Redo" onClick={redo} />
                    <ToolBtn icon={Copy} title="Copy" onClick={copy} />
                    <ToolBtn icon={Scissors} title="Cut" onClick={cut} />
                    <ToolBtn icon={ClipboardList} title="Paste" onClick={paste} />
                </RibbonGroup>

                <RibbonGroup title="View">
                    <ToolBtn icon={ZoomIn} title="Zoom In" onClick={() => setZoom(z => Math.min(3, z + 0.1))} />
                    <ToolBtn icon={ZoomOut} title="Zoom Out" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} />
                    <div className="px-2 h-8 bg-slate-800/50 border border-slate-700/50 rounded-md flex items-center justify-center text-xs text-slate-300 min-w-[50px]">
                        {Math.round(zoom * 100)}%
                    </div>
                </RibbonGroup>

                <RibbonGroup title="Options">
                    <ToolBtn icon={Grid3X3} title="Grid" active={gridVisible} onClick={() => setGridVisible(!gridVisible)} />
                    <ToolBtn icon={Settings} title="Properties" active={inspectorPopupVisible} onClick={() => setInspectorPopupVisible(!inspectorPopupVisible)} />
                </RibbonGroup>

                {/* Background & Uploads moved to Edit modal */}
            </div>

            {/* Create Page Modal */}
            {newOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                    <div className="w-[480px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                        <div className="h-12 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Plus size={16} className="text-yellow-500" />
                                <span className="text-sm font-semibold text-slate-800">Create New Page</span>
                            </div>
                            <button onClick={() => setNewOpen(false)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center">
                                ✕
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            <div className="flex gap-2">
                                <button 
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${mode==='image'?'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20':'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                                    onClick={()=>setMode('image')}
                                >
                                    From Image
                                </button>
                                <button 
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${mode==='blank'?'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20':'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                                    onClick={()=>setMode('blank')}
                                >
                                    Blank Canvas
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Page Name</label>
                                <input 
                                    value={pageName} 
                                    onChange={(e)=>setPageName(e.target.value)} 
                                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all" 
                                    placeholder="Enter page name..."
                                />
                            </div>

                            {mode === 'image' ? (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Background Image</label>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-500 file:text-white hover:file:bg-yellow-600 file:cursor-pointer cursor-pointer" 
                                        onChange={(e)=>setPendingFile(e.target.files?.[0]||null)} 
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Width</label>
                                        <input 
                                            type="number" 
                                            value={blankW} 
                                            onChange={(e)=>setBlankW(parseInt(e.target.value)||1920)} 
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Height</label>
                                        <input 
                                            type="number" 
                                            value={blankH} 
                                            onChange={(e)=>setBlankH(parseInt(e.target.value)||1080)} 
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Color</label>
                                        <input 
                                            type="color" 
                                            value={blankBg} 
                                            onChange={(e)=>setBlankBg(e.target.value)} 
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button 
                                    onClick={()=>{ setNewOpen(false); setPendingFile(null); }} 
                                    className="px-4 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={()=>{ 
                                        if(mode==='image'){ 
                                            if(pendingFile) handleUploadNewPage(pendingFile); 
                                            else alert('กรุณาเลือกรูปภาพ'); 
                                        } else if(mode==='blank'){ 
                                            handleCreateBlank(); 
                                        } 
                                    }} 
                                    className="px-6 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 rounded-lg text-sm text-white font-semibold transition-colors shadow-lg shadow-yellow-500/20"
                                >
                                    Create Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Edit Page Modal */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                    <div className="w-[520px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                        <div className="h-12 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Edit3 size={16} className="text-yellow-600" />
                                <span className="text-sm font-semibold text-slate-800">Edit Page</span>
                            </div>
                            <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center">
                                ✕
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Rename</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        value={editName} 
                                        onChange={(e)=>setEditName(e.target.value)} 
                                        className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all" 
                                        placeholder="Page name..."
                                    />
                                    <button onClick={()=>renameCurrent(editName)} className="px-4 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-sm font-medium transition-colors">Save</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Background</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={editBg} onChange={(e)=>setEditBg(e.target.value)} className="w-10 h-10 rounded-lg bg-white border border-slate-200 cursor-pointer" />
                                    <button 
                                        onClick={()=>saveBgColor(editBg)} 
                                        disabled={!!currentPage?.image}
                                        className={`px-4 h-10 rounded-lg text-sm font-medium transition-colors ${currentPage?.image ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20'}`}
                                    >
                                        Save Color
                                    </button>
                                    <button onClick={()=>document.getElementById('edit-bg-image-input').click()} className="px-4 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-sm font-medium transition-colors">Upload</button>
                                    <input id="edit-bg-image-input" type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) updateImageFileRibbon(f); e.target.value=''; }} />
                                    {currentPage?.image && (
                                        <button 
                                            onClick={async ()=>{
                                                if (!selectedProject || !currentPage) return;
                                                try {
                                                    const API = getApiBase();
                                                    const fd = new FormData();
                                                    fd.append('page_id', currentPage.id);
                                                    const res = await fetch(`${API}/photoview/${selectedProject}/clear_image`, { method: 'POST', body: fd });
                                                    if (res.ok) {
                                                        await refreshPages();
                                                        const p = (pages || []).find(x => String(x.id) === String(currentPage.id));
                                                        if (p) { setCurrentPage(p); loadPage(p, selectedProject); }
                                                    }
                                                } catch {}
                                            }} 
                                            className="px-4 h-10 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium transition-colors shadow-md shadow-rose-500/20"
                                        >
                                            Remove Image
                                        </button>
                                    )}
                                </div>
                                {currentPage?.image && (
                                    <div className="text-[11px] text-amber-600 mt-1">มีรูปพื้นหลังอยู่ จะแก้สี/ขนาดได้เมื่อเอารูปออก</div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Canvas Size</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <input 
                                            type="number" 
                                            value={editW} 
                                            onChange={(e)=>setEditW(parseInt(e.target.value)||1920)} 
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all" 
                                            placeholder="Width"
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="number" 
                                            value={editH} 
                                            onChange={(e)=>setEditH(parseInt(e.target.value)||1080)} 
                                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all" 
                                            placeholder="Height"
                                        />
                                    </div>

                                    <div className="flex items-center">
                                        <button 
                                            onClick={async ()=>{ 
                                                if (!selectedProject || !currentPage) return;
                                                try {
                                                    const API = getApiBase();
                                                    const payload = { canvas: { width: editW, height: editH, backgroundColor: editBg } };
                                                    const res = await fetch(`${API}/photoview/${selectedProject}/save_style/${currentPage.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                                                    if (res.ok) { 
                                                        alert('Style Saved'); 
                                                        loadPage(currentPage, selectedProject); 
                                                    }
                                                } catch {}
                                            }} 
                                            disabled={!!currentPage?.image}
                                            className={`px-4 h-10 rounded-lg text-white text-sm font-medium transition-colors w-full ${currentPage?.image ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                                        >
                                            Save Size
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {uploadList.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Uploads</label>
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-auto">
                                        {uploadList.map(f => {
                                            const url = `${getApiBase()}/photoview/${selectedProject}/images/${encodeURIComponent(f)}`;
                                            const cur = String(currentPage?.image || '').split('/').pop();
                                            const isCurrent = cur === f;
                                            const isSelected = editSelectedImage === f;
                                            const baseCls = "rounded-lg overflow-hidden border transition-all";
                                            const stateCls = isCurrent 
                                                ? "border-amber-500 ring-2 ring-amber-400" 
                                                : isSelected 
                                                ? "border-blue-500 ring-2 ring-blue-400" 
                                                : "border-slate-700 hover:border-blue-500";
                                            return (
                                                <button key={f} onClick={()=>setEditSelectedImage(f)} className={`${baseCls} ${stateCls}`}>
                                                    <img src={url} alt={f} className="w-full h-16 object-cover" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <button 
                                            className="px-4 h-9 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                            disabled={!editSelectedImage || editSelectedImage === String(currentPage?.image || '').split('/').pop()}
                                            onClick={()=>{ if (editSelectedImage) setImageFromUploads(editSelectedImage); }}
                                        >
                                            Save Image
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end">
                                <button onClick={()=>setEditOpen(false)} className="px-4 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RibbonBar;
