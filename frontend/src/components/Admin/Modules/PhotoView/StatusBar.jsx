import React from 'react';
import { useEditor } from './PhotoEditorContext';

const StatusBar = () => {
    const { selectedObject, zoom, currentPage } = useEditor();
    const info = selectedObject ? {
        type: selectedObject.type,
        left: Math.round(selectedObject.left || 0),
        top: Math.round(selectedObject.top || 0),
        width: Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1)),
        height: Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1))
    } : null;
    return (
        <div className="h-8 bg-white border-t border-slate-200 px-3 flex items-center justify-between text-[12px] text-slate-600">
            <div className="flex items-center gap-4 font-mono">
                <span>{currentPage ? currentPage.name : 'NO PAGE'}</span>
                {info && (
                    <span>{info.type} • X:{info.left} Y:{info.top} • W:{info.width} H:{info.height}</span>
                )}
            </div>
            <div className="font-mono">{Math.round(zoom * 100)}%</div>
        </div>
    );
};

export default StatusBar;
