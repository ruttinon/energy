import React, { useState } from 'react';

const SelectBox = ({ value, options, onChange, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const current = options.find(o => String(o.value) === String(value));
  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        className="w-full h-6 px-2 text-xs rounded border border-slate-200 bg-white text-slate-800 text-left hover:border-yellow-400 focus:outline-none focus:border-yellow-500 transition-colors shadow-sm"
        onClick={() => setOpen(v => !v)}
      >
        {current ? current.label : (placeholder || '')}
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-auto bg-white border border-slate-200 rounded z-20 shadow-lg">
          {options.map(opt => (
            <div
              key={String(opt.value)}
              className={`px-2 py-1 text-xs cursor-pointer transition-colors ${String(opt.value) === String(value) ? 'bg-yellow-50 text-yellow-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectBox;
