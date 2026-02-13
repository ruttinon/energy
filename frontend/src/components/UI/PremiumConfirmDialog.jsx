import React from 'react';
import { X } from 'lucide-react';

const PremiumConfirmDialog = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, type = 'confirm', inputValue, onInputChange, inputPlaceholder }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                         <span className="w-1 h-6 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full mr-1"></span>
                        {title}
                    </h3>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 bg-white/50">
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">
                        {message}
                    </p>
                    {type === 'prompt' && (
                        <div className="mt-4">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => onInputChange(e.target.value)}
                                placeholder={inputPlaceholder}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3 border-t border-slate-100">
                    {cancelText && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => onConfirm(inputValue)}
                        className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transform hover:-translate-y-0.5 transition-all"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PremiumConfirmDialog;
