import React from 'react';
import { useEditor } from './PhotoEditorContext';
import { MousePointer2, Type, Cpu, Activity, Zap, Square, Circle } from 'lucide-react';

const Btn = ({ icon: Icon, onClick, active }) => (
    <button
        onClick={onClick}
        className={`w-12 h-12 mb-2 rounded border transition-all duration-200 ${
            active 
            ? 'bg-yellow-50 border-yellow-500 text-yellow-600 shadow-sm' 
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-yellow-300 text-slate-500 hover:text-yellow-600 shadow-sm'
        } flex items-center justify-center`}
    >
        <Icon size={18} />
    </button>
);

const Toolbox = () => {
    const { fabricCanvas, activeTool, setActiveTool } = useEditor();
    const addTextLabel = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('Label', { left: center.left, top: center.top, fontSize: 16, fontFamily: 'Kanit', fill: '#1f2937' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };
    const addTextValue = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const t = new window.fabric.IText('0.00', { left: center.left, top: center.top + 24, fontSize: 32, fontFamily: 'Orbitron', fill: '#0ea5e9', customType: 'data_value' });
        c.add(t); c.setActiveObject(t); setActiveTool('select');
    };
    const addStatus = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const circle = new window.fabric.Circle({ left: center.left, top: center.top, radius: 10, fill: '#64748b' });
        circle.set('customType', 'status_indicator'); c.add(circle); c.setActiveObject(circle);
    };
    const addSwitch = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const rect = new window.fabric.Rect({ left: center.left, top: center.top, width: 60, height: 30, rx: 6, ry: 6, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 2 });
        rect.set('customType', 'switch_button'); c.add(rect); c.setActiveObject(rect);
    };
    const addRect = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const r = new window.fabric.Rect({ left: center.left, top: center.top, width: 100, height: 80, fill: 'transparent', stroke: '#64748b', strokeWidth: 2 });
        c.add(r); c.setActiveObject(r);
    };
    const addCircle = () => {
        const c = fabricCanvas.current; if (!c) return;
        const center = c.getCenter();
        const circle = new window.fabric.Circle({ left: center.left, top: center.top, radius: 50, fill: 'transparent', stroke: '#64748b', strokeWidth: 2 });
        c.add(circle); c.setActiveObject(circle);
    };
    return (
        <div className="w-16 bg-slate-100 border-r border-slate-300 flex flex-col items-center py-2">
            <Btn icon={MousePointer2} onClick={() => setActiveTool('select')} active={activeTool === 'select'} />
            <Btn icon={Type} onClick={addTextLabel} />
            <Btn icon={Cpu} onClick={addTextValue} />
            <Btn icon={Activity} onClick={addStatus} />
            <Btn icon={Zap} onClick={addSwitch} />
            <Btn icon={Square} onClick={addRect} />
            <Btn icon={Circle} onClick={addCircle} />
        </div>
    );
};

export default Toolbox;
