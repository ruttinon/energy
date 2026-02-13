import React, { useEffect, useState } from 'react';
import { safeColor } from '../utils/colors';
import { getApiBase } from '../../../../../../../services/api';
import SelectBox from './SelectBox';

const StylePanel = ({ props, updateProp, isTextObject, projectId, pageId, hideFillSection }) => {
    const [styleName, setStyleName] = useState('Personalized');
    const [presets, setPresets] = useState([]);

    useEffect(() => {
        const load = async () => {
            if (!projectId || !pageId) return;
            try {
                const API = getApiBase();
                const r = await fetch(`${API}/photoview/${projectId}/get_style/${pageId}`);
                const j = await r.json();
                const ps = j.style?.presets || [];
                setPresets(ps);
                if (ps.length && !ps.find(p => p.name === styleName)) setStyleName(ps[0].name);
            } catch {}
        };
        load();
    }, [projectId, pageId]);

    const applyPreset = (name) => {
        const p = presets.find(x => x.name === name);
        if (!p) return;
        if (p.fontFamily) updateProp('fontFamily', p.fontFamily);
        if (p.fontSize) updateProp('fontSize', p.fontSize);
        if (typeof p.bold !== 'undefined') updateProp('fontWeight', p.bold ? 'bold' : 'normal');
        if (typeof p.italic !== 'undefined') updateProp('fontStyle', p.italic ? 'italic' : 'normal');
        if (p.fill) updateProp('fill', p.fill);
        if (typeof p.angle !== 'undefined') updateProp('angle', p.angle);
    };

    const savePreset = async () => {
        if (!projectId || !pageId) return;
        const preset = {
            name: styleName || 'Personalized',
            fontFamily: props.fontFamily,
            fontSize: props.fontSize,
            bold: props.fontWeight === 'bold',
            italic: props.fontStyle === 'italic',
            fill: props.fill,
            angle: props.angle || 0,
            animation: props.animation || 'none'
        };
        const next = (() => {
            const arr = presets.slice();
            const idx = arr.findIndex(x => x.name === preset.name);
            if (idx >= 0) arr[idx] = preset; else arr.push(preset);
            return arr;
        })();
        setPresets(next);
        try {
            const API = getApiBase();
            await fetch(`${API}/photoview/${projectId}/save_style/${pageId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presets: next })
            });
        } catch {}
    };
    return (
        <div className="bg-white border border-slate-200 p-2 rounded shadow-sm">
            <div className="mb-2 font-bold text-slate-800 border-b border-slate-100 pb-1">Styles</div>
            {isTextObject && (
                <div className="space-y-2 mb-2">
                    <div className="flex items-center gap-2">
                        <SelectBox
                          value={styleName || 'Personalized'}
                          options={[{ value: 'Personalized', label: 'Personalized' }, ...presets.map(p => ({ value: p.name, label: p.name }))]}
                          onChange={(val) => { setStyleName(val); applyPreset(val); }}
                          placeholder=""
                        />
                        <button onClick={savePreset} className="px-2 h-6 rounded bg-yellow-500 hover:bg-yellow-400 text-white text-[10px] font-bold shadow-sm transition-colors">+</button>
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Font</label>
                        <SelectBox
                          value={props.fontFamily || 'Inter'}
                          options={(props.availableFonts || ['Inter']).map(f => ({ value: f, label: f }))}
                          onChange={(val) => updateProp('fontFamily', val)}
                          placeholder=""
                        />
                    </div>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-1 cursor-pointer select-none group">
                            <input type="checkbox" className="accent-yellow-500" checked={props.fontWeight === 'bold'} onChange={() => updateProp('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')} />
                            <span className="text-slate-600 group-hover:text-slate-800 transition-colors">Bold</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer select-none group">
                            <input type="checkbox" className="accent-yellow-500" checked={props.fontStyle === 'italic'} onChange={() => updateProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')} />
                            <span className="text-slate-600 group-hover:text-slate-800 transition-colors">Italic</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Size</label>
                        <input type="number" value={props.fontSize} onChange={(e) => updateProp('fontSize', parseInt(e.target.value))} className="w-full border border-slate-200 rounded px-1 h-6 bg-white text-xs text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={safeColor(props.fill)} onChange={(e) => updateProp('fill', e.target.value)} className="w-6 h-6 border border-slate-200 rounded cursor-pointer p-0 bg-transparent" />
                            <input type="text" value={props.fill} onChange={(e) => updateProp('fill', e.target.value)} className="flex-1 border border-slate-200 rounded px-1 h-6 bg-white text-xs uppercase text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                        </div>
                    </div>
                    {!props.hideAngle && (
                        <div>
                            <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Orientation (degrees)</label>
                            <input type="number" value={props.angle || 0} onChange={(e) => updateProp('angle', parseInt(e.target.value) || 0)} className="w-full border border-slate-200 rounded px-1 h-6 bg-white text-xs text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                        </div>
                    )}
                    {!props.hideText && (
                        <div>
                            <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Text</label>
                            <input type="text" value={props.text || ''} onChange={(e) => updateProp('text', e.target.value)} className="w-full border border-slate-200 rounded px-1 h-6 bg-white text-xs text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                        </div>
                    )}
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Animation</label>
                        <SelectBox
                          value={props.animation || 'none'}
                          options={[
                            { value: 'none', label: '< None >' },
                            { value: 'pulse', label: 'Pulse' },
                            { value: 'blink', label: 'Blink' }
                          ]}
                          onChange={(val) => updateProp('animation', val)}
                          placeholder=""
                        />
                    </div>
                </div>
            )}
            {!isTextObject && !hideFillSection && (
                <div className="space-y-2">
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Opacity</label>
                        <input type="range" min="0" max="1" step="0.1" value={props.opacity} onChange={(e) => updateProp('opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-yellow-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Fill Color</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" value={safeColor(props.fill)} onChange={(e) => updateProp('fill', e.target.value)} className="w-6 h-6 border border-slate-200 rounded cursor-pointer p-0 bg-transparent" />
                            <input type="text" value={props.fill} onChange={(e) => updateProp('fill', e.target.value)} className="flex-1 border border-slate-200 rounded px-1 h-6 bg-white text-xs uppercase text-slate-800 outline-none focus:border-yellow-500 transition-colors shadow-sm" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StylePanel;
