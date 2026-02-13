import React, { useEffect, useState } from 'react';
import { useEditor } from './PhotoEditorContext';
import { useApp } from '../../../../context/AppContext';
import { Palette, Database, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import StylePanel from './panels/StylePanel';
import DataPanel from './panels/DataPanel';
import DateTimePanel from './panels/DateTimePanel';
import { safeColor } from './utils/colors';

const PropertiesPanel = () => {
    const {
        selectedObject,
        fabricCanvas,
        deviceList,
        fetchDeviceList,
        fetchDeviceParams,
        deviceParamsCache,
        fetchDeviceOutputs,
        currentPage
    } = useEditor();
    const { selectedProject } = useApp();

    const [activeTab, setActiveTab] = useState('style');
    const [props, setProps] = useState({});
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [loadingParams, setLoadingParams] = useState(false);
    const [loadingOutputs, setLoadingOutputs] = useState(false);
    const [deviceSearch, setDeviceSearch] = useState('');
    const [availableFonts, setAvailableFonts] = useState(['Inter','Roboto','Orbitron','Rajdhani']);

    // Sync state with selection
    useEffect(() => {
        if (!selectedObject) {
            setProps({});
            return;
        }

        const updateProps = () => {
             setProps({
                // Core
                type: selectedObject.type,
                left: Math.round(selectedObject.left),
                top: Math.round(selectedObject.top),
                width: Math.round(selectedObject.width * selectedObject.scaleX),
                height: Math.round(selectedObject.height * selectedObject.scaleY),
                opacity: selectedObject.opacity ?? 1,
    
                // Style
                fill: selectedObject.fill || '#ffffff',
                stroke: selectedObject.stroke || '',
                strokeWidth: selectedObject.strokeWidth || 0,
                fontFamily: selectedObject.fontFamily || 'Inter',
                fontSize: selectedObject.fontSize || 20,
                text: selectedObject.text || '',
                textAlign: selectedObject.textAlign || 'left',
                fontWeight: selectedObject.fontWeight || 'normal',
                fontStyle: selectedObject.fontStyle || 'normal',
    
                // Data
                converterId: selectedObject.converterId || '',
                deviceId: selectedObject.deviceId || '',
                param: selectedObject.param || '', // Register
                unit: selectedObject.unit || '',
                billingPeriod: selectedObject.billingPeriod || 'day',
                dateFormat: selectedObject.dateFormat || 'YYYY-MM-DD HH:mm:ss',
    
                // Advanced
                customType: selectedObject.customType || ''
            });
        };

        updateProps();

        // Listen for modifications to update props in real-time
        if (fabricCanvas.current) {
            const handleModified = () => updateProps();
            fabricCanvas.current.on('object:modified', handleModified);
            fabricCanvas.current.on('object:scaling', handleModified);
            fabricCanvas.current.on('object:moving', handleModified);
            
            return () => {
                if (fabricCanvas.current) {
                    fabricCanvas.current.off('object:modified', handleModified);
                    fabricCanvas.current.off('object:scaling', handleModified);
                    fabricCanvas.current.off('object:moving', handleModified);
                }
            };
        }
    }, [selectedObject, fabricCanvas]);
    useEffect(() => {
        const candidates = ['Inter','Orbitron','Rajdhani','Roboto','Kanit','Prompt','Sarabun','Tahoma','Arial','Helvetica','Segoe UI','Noto Sans Thai','Times New Roman','Courier New','Monospace'];
        try {
            if (document.fonts && document.fonts.check) {
                const found = candidates.filter(f => document.fonts.check(`12px "${f}"`) || document.fonts.check(`12px ${f}`));
                if (found.length) setAvailableFonts(found);
            }
        } catch {}
    }, []);
    useEffect(() => {
        (async () => {
            try {
                const { listStatusImages } = await import('./utils/picAssets');
                const imgs = await listStatusImages();
                window.__statusImagesOn = imgs.on;
                window.__statusImagesOff = imgs.off;
            } catch {}
        })();
    }, []);

    // Helper to update property
    const updateProp = (key, value) => {
        if (!selectedObject || !fabricCanvas.current) return;

        // Handle special updates
        if (key === 'width') selectedObject.scaleToWidth(value);
        else if (key === 'height') selectedObject.scaleToHeight(value);
        else selectedObject.set(key, value);

        selectedObject.setCoords();
        fabricCanvas.current.requestRenderAll();

        // Update local state
        setProps(prev => ({ ...prev, [key]: value }));
    };

    if (!selectedObject) {
        return (
            <div className="flex flex-col h-full bg-white border-l border-slate-200 text-slate-600 font-sans text-xs">
                <div className="h-8 border-b border-slate-200 flex items-center px-2 bg-slate-50 justify-between">
                    <span className="font-bold uppercase text-yellow-600">Inspector</span>
                    <span className="font-mono text-[10px] text-slate-400 uppercase">none</span>
                </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center select-none bg-slate-50/50">
                <div className="w-16 h-16 rounded-full border border-dashed border-yellow-500/20 flex items-center justify-center mb-4">
                    <Palette size={24} className="text-yellow-500/60" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-800">No Selection</h3>
                <p className="text-[10px] text-slate-500 leading-relaxed opacity-70">
                    คลิกเลือกวัตถุบนแคนวาส (ตัวเลข/รูปทรง/ปุ่ม) เพื่อแก้ไขคุณสมบัติด้านขวา
                </p>
            </div>
        </div>
        );
    }

    // Determine if it's a data-capable object
    const isDataObject = ['data_value', 'status_indicator', 'switch_button', 'billing_value', 'datetime'].includes(selectedObject.customType);
    // Determine if it's a text-capable object
    const isTextObject = ['i-text', 'text', 'textbox'].includes(selectedObject.type);

    return (
        <div className="flex flex-col h-full bg-white border-l border-slate-200 text-slate-800 font-sans text-xs">
            {/* Header */}
            <div className="h-8 border-b border-slate-200 flex items-center px-2 bg-slate-50 justify-between">
                <span className="font-bold uppercase text-yellow-600">Inspector</span>
                <span className="font-mono text-[10px] text-slate-500 uppercase">{selectedObject.customType || props.type}</span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-4">

                {selectedObject?.customType !== 'status_indicator' && (
                    <StylePanel
                        props={{...props, availableFonts, hideText: selectedObject?.customType === 'datetime', hideAngle: selectedObject?.customType === 'datetime'}}
                        updateProp={updateProp}
                        isTextObject={isTextObject}
                        projectId={selectedProject}
                        pageId={typeof (currentPage?.id) !== 'undefined' ? currentPage.id : ''}
                    />
                )}

                {isDataObject && (
                    selectedObject.customType === 'datetime' ? (
                        <div className="bg-slate-50 border border-slate-200 p-2 rounded shadow-sm">
                            <DateTimePanel props={props} updateProp={updateProp} />
                        </div>
                    ) : (
                        <DataPanel
                            props={props}
                            updateProp={updateProp}
                            selectedObject={selectedObject}
                            selectedProject={selectedProject}
                            deviceList={deviceList}
                            fetchDeviceList={fetchDeviceList}
                            fetchDeviceParams={fetchDeviceParams}
                            deviceParamsCache={deviceParamsCache}
                            fetchDeviceOutputs={fetchDeviceOutputs}
                            fabricCanvas={fabricCanvas}
                        />
                    )
                )}
            </div>
        </div>
    );
};
export default PropertiesPanel;
