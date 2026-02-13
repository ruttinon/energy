import React from 'react';
import SelectBox from './SelectBox';

const DateTimePanel = ({ props, updateProp }) => {
    return (
        <div className="space-y-2 text-slate-800">
            <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Date format</label>
                <SelectBox
                    value={props.dateFormat || 'YYYY-MM-DD HH:mm:ss'}
                    onChange={(val) => updateProp('dateFormat', val)}
                    options={[
                        { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                        { value: 'HH:mm:ss', label: 'HH:mm:ss' },
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }
                    ]}
                />
            </div>
            <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Date (Preview)</label>
                <div className="flex gap-1">
                    <input type="date" disabled value={new Date().toISOString().split('T')[0]} className="flex-1 border border-slate-200 rounded px-1 h-6 bg-slate-50 text-xs text-slate-500 shadow-sm" />
                    <input type="time" disabled value={new Date().toTimeString().split(' ')[0]} className="w-24 border border-slate-200 rounded px-1 h-6 bg-slate-50 text-xs text-slate-500 shadow-sm" />
                </div>
            </div>
        </div>
    );
};

export default DateTimePanel;
