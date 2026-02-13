import React from 'react';
import RibbonBar from './RibbonBar';
import CanvasArea from './CanvasArea';
import PropertiesPanel from './PropertiesPanel';
import StatusBar from './StatusBar';
import InspectorPopup from './InspectorPopup';

const PhotoEditorLayout = () => {
    return (
        <div className="flex flex-col h-full w-full bg-slate-50 text-slate-800 font-sans">
            <div>
                <RibbonBar />
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-auto scrollbar-hide relative">
                
                {/* Canvas Area (Center) */}
                <div className="flex-1 relative bg-slate-100/50 flex flex-col min-h-[50vh]">
                    <CanvasArea />
                </div>

                {/* Inspector (Right) */}
                <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col z-10 shadow-sm">
                    <PropertiesPanel />
                </div>
                <InspectorPopup />
            </div>
            <StatusBar />
        </div>
    );
};

export default PhotoEditorLayout;
