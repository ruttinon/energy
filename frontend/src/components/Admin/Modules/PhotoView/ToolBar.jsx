import React, { useEffect, useState } from 'react';
import { useEditor } from './PhotoEditorContext';
import { useApp } from '../../../../context/AppContext'; // Import App Context
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import {
    MousePointer2, Hand, Type, Square, Circle,
    Cpu, Image as ImageIcon, Layers, Settings
} from 'lucide-react';

const ToolBar = () => {
    const { activeTool, setActiveTool, fabricCanvas, pages, setPages, currentPage, setCurrentPage } = useEditor();
    const { selectedProject } = useApp();
    const { showConfirm, showAlert } = useDialog();
    const [activeTab, setActiveTab] = useState('tools'); // tools, devices, pages
    const [styleW, setStyleW] = useState(1920);
    const [styleH, setStyleH] = useState(1080);
    const [styleBg, setStyleBg] = useState('#000000');
    const [uploadList, setUploadList] = useState([]);

    const refreshPages = async () => {
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/pages`);
            const data = await res.json();
            setPages(data.pages || []);
        } catch (e) { console.error(e); }
    };

    const handleCreatePage = async (name, file) => {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('file', file);
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/create_page`, { method: 'POST', body: fd });
            if (res.ok) {
                await refreshPages();
                showAlert("Success", "Page Created");
            } else {
                showAlert("Error", "Failed to create page");
            }
        } catch (e) { showAlert("Error", "Error: " + e); }
    };

    const handleUpdateImage = async (file) => {
        if (!currentPage) return;
        const fd = new FormData();
        fd.append('page_id', currentPage.id);
        fd.append('file', file);
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/update_image`, { method: 'POST', body: fd });
            if (res.ok) {
                await showAlert("Success", "Background Updated");
                window.location.reload();
            }
        } catch (e) { showAlert("Error", "Error"); }
    };

    const switchPage = (p) => {
        setCurrentPage(p);
    };

    const nextPlacement = (canvas, w = 120, h = 40) => {
        const margin = 60;
        const objs = canvas.getObjects();
        const idx = objs.length;
        const step = 40;
        const x = margin + (idx % 15) * step;
        const y = margin + Math.floor(idx / 15) * step;
        return { left: x, top: y };
    };

    const addText = () => {
        setActiveTool('add_text');
    };

    const addRect = () => {
        setActiveTool('add_rect');
    };

    const addDate = () => {
        setActiveTool('add_date');
    };

    const loadStyle = async () => {
        if (!currentPage || !selectedProject) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/get_style/${currentPage.id}`);
            const data = await res.json();
            const c = data?.style?.canvas || {};
            setStyleW(parseInt(c.width || 1920));
            setStyleH(parseInt(c.height || 1080));
            setStyleBg(String(c.backgroundColor || '#000000'));
        } catch {}
    };

    const saveStyle = async () => {
        if (!currentPage || !selectedProject) return;
        try {
            const API = getApiBase();
            const payload = { canvas: { width: parseInt(styleW || 1920), height: parseInt(styleH || 1080), backgroundColor: styleBg || '#000000' } };
            const res = await fetch(`${API}/photoview/${selectedProject}/save_style/${currentPage.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) showAlert("Success", "Style Saved");
        } catch { showAlert("Error", "Save failed"); }
    };

    const renamePage = async () => {
        if (!currentPage || !selectedProject) return;
        const name = prompt("New page name:", currentPage.name || '');
        if (!name) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/rename_page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: currentPage.id, new_name: name }) });
            if (res.ok) {
                await refreshPages();
                const p = (pages || []).find(x => x.id === currentPage.id);
                if (p) setCurrentPage(p);
            }
        } catch {}
    };

    const deletePage = async () => {
        if (!currentPage || !selectedProject) return;
        const confirmed = await showConfirm("Delete Page", "Delete this page?");
        if (!confirmed) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/delete_page/${currentPage.id}`, { method: 'POST' });
            if (res.ok) {
                await refreshPages();
                setCurrentPage(null);
            }
        } catch {}
    };

    const loadUploads = async () => {
        if (!selectedProject) return;
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/photoview/${selectedProject}/uploads_list`);
            const data = await res.json();
            setUploadList((data?.icons || []).map(String));
        } catch {}
    };

    const setImageFromUploads = async (filename) => {
        if (!currentPage || !selectedProject || !filename) return;
        try {
            const API = getApiBase();
            const fd = new FormData();
            fd.append('page_id', currentPage.id);
            fd.append('filename', filename);
            const res = await fetch(`${API}/photoview/${selectedProject}/set_image`, { method: 'POST', body: fd });
            if (res.ok) {
                await showAlert("Success", "Background Updated");
                window.location.reload();
            }
        } catch {}
    };

    useEffect(() => {
        loadStyle();
        loadUploads();
    }, [currentPage, selectedProject]);

    return (
        <div className="w-full lg:w-80 bg-black border-t lg:border-t-0 lg:border-r border-white/10 flex flex-col h-full">
            {/* Tab Header */}
            <div className="flex border-b border-white/10">
                <button onClick={() => setActiveTab('tools')} className={`flex-1 p-3 text-xs font-bold uppercase ${activeTab === 'tools' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}>Tools</button>
                <button onClick={() => setActiveTab('pages')} className={`flex-1 p-3 text-xs font-bold uppercase ${activeTab === 'pages' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}>Pages</button>
                <button onClick={() => setActiveTab('devices')} className={`flex-1 p-3 text-xs font-bold uppercase ${activeTab === 'devices' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-white'}`}>Devices</button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
                {activeTab === 'tools' && (
                    <div className="grid grid-cols-3 sm:grid-cols-2 gap-3">
                        <button onClick={() => setActiveTool('select')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${activeTool === 'select' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                            <MousePointer2 size={20} /> <span className="text-[10px] uppercase font-bold">Select</span>
                        </button>
                        <button onClick={() => setActiveTool('pan')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${activeTool === 'pan' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                            <Hand size={20} /> <span className="text-[10px] uppercase font-bold">Pan</span>
                        </button>
                        <button onClick={addText} className="p-4 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:bg-slate-800 flex flex-col items-center gap-2">
                            <Type size={20} /> <span className="text-[10px] uppercase font-bold">Add Text</span>
                        </button>
                        <button onClick={addRect} className="p-4 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:bg-slate-800 flex flex-col items-center gap-2">
                            <Square size={20} /> <span className="text-[10px] uppercase font-bold">Rectangle</span>
                        </button>
                        <button onClick={addDate} className="p-4 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:bg-slate-800 flex flex-col items-center gap-2">
                            <Settings size={20} /> <span className="text-[10px] uppercase font-bold">Add Date</span>
                        </button>
                        {/* More tools... */}
                    </div>
                )}

                {activeTab === 'pages' && (
                    <div className="space-y-4">
                        <button onClick={() => document.getElementById('new-page-upload').click()} className="w-full p-3 bg-yellow-500 text-white text-xs font-bold uppercase rounded hover:bg-yellow-400 flex items-center justify-center gap-2">
                            <Layers size={14} /> New Page
                        </button>
                        <input
                            type="file"
                            id="new-page-upload"
                            hidden
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const name = prompt("Enter Page Name:", file.name.split('.')[0]);
                                if (name) handleCreatePage(name, file);
                            }}
                        />

                        <div className="space-y-2 mt-4">
                            <div className="text-[10px] uppercase text-slate-500 tracking-widest pl-1">All Pages</div>
                            {pages.map(p => (
                                <div key={p.id}
                                    onClick={() => switchPage(p)}
                                    className={`p-3 rounded border cursor-pointer transition-all flex justify-between items-center ${currentPage?.id === p.id ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <span className="text-xs font-bold">{p.name}</span>
                                    {currentPage?.id === p.id && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                </div>
                            ))}
                        </div>

                        {currentPage && (
                            <div className="mt-6 pt-4 border-t border-white/10">
                                <div className="text-[10px] uppercase text-slate-500 tracking-widest mb-2">Current Page Background</div>
                                <button onClick={() => document.getElementById('bg-update-upload').click()} className="w-full p-2 bg-slate-800 text-slate-300 text-xs rounded border border-white/10 hover:bg-slate-700 flex items-center justify-center gap-2">
                                    <ImageIcon size={12} /> Change Image
                                </button>
                                <input
                                    type="file"
                                    id="bg-update-upload"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) handleUpdateImage(file);
                                    }}
                                />
                                {uploadList.length > 0 && (
                                    <div className="mt-2">
                                        <select className="w-full h-8 bg-white text-slate-800 border border-slate-200 rounded px-2 text-xs"
                                            onChange={(e) => { const f = e.target.value; if (f) setImageFromUploads(f); }}>
                                            <option value="">Select from uploads...</option>
                                            {uploadList.map(f => (<option key={f} value={f}>{f}</option>))}
                                        </select>
                                    </div>
                                )}

                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    <div>
                                        <div className="text-[10px] text-slate-500">Width</div>
                                        <input type="number" value={styleW} onChange={(e)=>setStyleW(parseInt(e.target.value)||1920)} className="w-full h-10 sm:h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">Height</div>
                                        <input type="number" value={styleH} onChange={(e)=>setStyleH(parseInt(e.target.value)||1080)} className="w-full h-10 sm:h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">Background</div>
                                        <input type="color" value={styleBg} onChange={(e)=>setStyleBg(e.target.value)} className="w-full h-10 sm:h-8 bg-white border border-slate-200 rounded" />
                                    </div>
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <button onClick={saveStyle} className="flex-1 p-2 bg-yellow-500 text-white text-xs rounded font-bold hover:bg-yellow-400 transition-colors">Save Style</button>
                                    <button onClick={renamePage} className="flex-1 p-2 bg-white text-slate-600 text-xs rounded border border-slate-200 hover:bg-slate-50 transition-colors">Rename</button>
                                    <button onClick={deletePage} className="flex-1 p-2 bg-red-500 text-white text-xs rounded font-bold hover:bg-red-400 transition-colors">Delete</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'devices' && (
                    <div className="text-center text-slate-500 text-xs py-10">
                        <Cpu size={32} className="mx-auto mb-2 opacity-50" />
                        Device List loading...
                        {/* Will implement Device Polling list here */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToolBar;
