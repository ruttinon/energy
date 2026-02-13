import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

const MobilePowerStudio = () => {
    return (
        <div className="flex flex-col items-center justify-center h-[80vh] p-8 text-center">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 bg-white border border-yellow-200 rounded-2xl flex items-center justify-center shadow-lg">
                    <Database size={48} className="text-yellow-600" />
                </div>
            </div>
            
            <h2 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 bg-clip-text text-transparent mb-2">POWER STUDIO</h2>
            <p className="text-sm text-slate-500 font-rajdhani tracking-wider mb-8">
                Advanced Data Integration & Control Logic
            </p>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-left max-w-xs shadow-sm">
                <AlertTriangle className="text-yellow-600 shrink-0 mt-1" size={20} />
                <div>
                    <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-1">Desktop Required</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        This module requires a larger display for complex configuration and logic mapping. Please access via the desktop workstation.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MobilePowerStudio;
