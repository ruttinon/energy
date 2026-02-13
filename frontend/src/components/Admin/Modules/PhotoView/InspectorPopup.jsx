import React, { useState, useEffect } from 'react';
import { useEditor } from './PhotoEditorContext';
import { useApp } from '../../../../context/AppContext';
import StylePanel from './panels/StylePanel';
import DataPanel from './panels/DataPanel';
import DateTimePanel from './panels/DateTimePanel';

const InspectorPopup = () => {
  const {
    inspectorPopupVisible,
    setInspectorPopupVisible,
    selectedObject,
    fabricCanvas,
    currentPage,
    deviceList,
    fetchDeviceList,
    fetchDeviceParams,
    deviceParamsCache,
    fetchDeviceOutputs
  } = useEditor();
  const { selectedProject } = useApp();

  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ top: 80, left: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      setPos(prev => {
        const next = { top: Math.max(40, prev.top + e.movementY), left: Math.max(0, prev.left + e.movementX) };
        return next;
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  if (!inspectorPopupVisible) return null;

  const props = selectedObject ? {
    type: selectedObject.type,
    left: Math.round(selectedObject.left),
    top: Math.round(selectedObject.top),
    width: Math.round(selectedObject.width * selectedObject.scaleX),
    height: Math.round(selectedObject.height * selectedObject.scaleY),
    opacity: selectedObject.opacity ?? 1,
    fill: selectedObject.fill || '#ffffff',
    stroke: selectedObject.stroke || '',
    strokeWidth: selectedObject.strokeWidth || 0,
    fontFamily: selectedObject.fontFamily || 'Inter',
    fontSize: selectedObject.fontSize || 20,
    text: selectedObject.text || '',
    textAlign: selectedObject.textAlign || 'left',
    fontWeight: selectedObject.fontWeight || 'normal',
    fontStyle: selectedObject.fontStyle || 'normal',
    converterId: selectedObject.converterId || '',
    deviceId: selectedObject.deviceId || '',
    param: selectedObject.param || '',
    unit: selectedObject.unit || '',
    billingPeriod: selectedObject.billingPeriod || 'day',
    dateFormat: selectedObject.dateFormat || 'YYYY-MM-DD HH:mm:ss',
    customType: selectedObject.customType || ''
  } : {};

  const updateProp = (key, value) => {
    if (!selectedObject || !fabricCanvas.current) return;
    if (key === 'width') selectedObject.scaleToWidth(value);
    else if (key === 'height') selectedObject.scaleToHeight(value);
    else selectedObject.set(key, value);
    selectedObject.setCoords();
    fabricCanvas.current.requestRenderAll();
  };

  const isDataObject = selectedObject && ['data_value', 'status_indicator', 'switch_button', 'billing_value', 'datetime'].includes(selectedObject.customType);
  const isTextObject = selectedObject && ['i-text', 'text', 'textbox'].includes(selectedObject.type);

  return (
    <div className="fixed z-50 w-[380px] bg-[#111] border border-white/10 rounded-lg shadow-2xl text-white"
      style={{ top: pos.top, right: undefined, left: Math.max(16, pos.left) }}>
      <div className="h-8 border-b border-white/10 flex items-center px-2 bg-[#1a1a1a] justify-between cursor-move"
        onMouseDown={() => setDragging(true)}>
        <span className="font-bold uppercase text-amber-500 text-[10px]">Properties</span>
        <button onClick={() => setInspectorPopupVisible(false)} className="text-white/70 hover:text-white text-xs">✕</button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden scrollbar-hide p-2 space-y-4">
        {selectedObject ? (
          <>
            {selectedObject?.customType !== 'status_indicator' && (
              <StylePanel
                props={{ ...props, availableFonts: ['Inter', 'Orbitron', 'Rajdhani', 'Roboto', 'Kanit'], hideText: selectedObject?.customType === 'datetime', hideAngle: selectedObject?.customType === 'datetime' }}
                updateProp={updateProp}
                isTextObject={isTextObject}
                projectId={selectedProject}
                pageId={currentPage?.id || ''}
              />
            )}
            {isDataObject && (
              selectedObject.customType === 'datetime' ? (
                <div className="bg-[#1a1a1a] border border-white/10 p-2 rounded shadow-sm">
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
          </>
        ) : (
          <StylePanel
            props={{
              type: 'canvas',
              fill: fabricCanvas?.current?.backgroundColor || '#ffffff',
              opacity: 1,
              stroke: '',
              strokeWidth: 0,
              availableFonts: []
            }}
            updateProp={(key, value) => {
              if (key === 'fill' && fabricCanvas?.current) {
                fabricCanvas.current.setBackgroundColor(value, () => fabricCanvas.current.requestRenderAll());
              }
            }}
            isTextObject={false}
            projectId={selectedProject}
            pageId={currentPage?.id || ''}
          />
        )}
      </div>
    </div>
  );
};

export default InspectorPopup;
