import React from 'react';
import { Zap, Activity } from 'lucide-react';

const CircuitCapsule = ({ device }) => {
        console.log('[CircuitCapsule] device:', device);
    // device: { 
    //   id, name, modbus_slave,
    //   meta_serial, meta_panel, meta_ct, 
    //   voltage_a, voltage_b, voltage_c, 
    //   current_a, current_b, current_c, 
    //   power_a, power_b, power_c, 
    //   energy_total, status 
    // }

    const isOnline = device.status !== 'offline';
    const fmt = (val, dec = 2) => val ? Number(val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '0.00';
    const totalPower = (device.power_a || 0) + (device.power_b || 0) + (device.power_c || 0);
    
    // Estimate Capacity from CT
    const capacity = React.useMemo(() => {
        if (device.meta_ct) {
            // Support formats: "100/5", "1600", "100A"
            const match = String(device.meta_ct).match(/(\d+)/);
            if (match) {
                const amp = parseInt(match[1], 10);
                // 3-phase, ~230V per phase => P = 3 * 230 * I / 1000
                return (3 * 230 * amp) / 1000;
            }
        }
        return 100; // Default fallback if no CT info
    }, [device.meta_ct]);

    const loadRatio = Math.max(0, Math.min((totalPower / capacity) * 100, 100));

    return (
        <div className={`
            group relative p-4 rounded-xl border border-slate-200 bg-white
            transition-all duration-400 hover:bg-slate-50 hover:border-yellow-400/60 hover:shadow-lg hover:shadow-yellow-100
            flex flex-col gap-3 w-full cursor-pointer hover:-translate-y-1 hover:scale-[1.01]
        `}>
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                <div className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">#{device.address || device.modbus_slave}</span>
                            <span className={`font-bold font-rajdhani text-lg ${isOnline ? 'text-slate-800' : 'text-slate-400'}`}>
                                {device.name}
                            </span>
                        </div>
                        <div className={`p-1 w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                    </div>

                    <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-1">
                        <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">PNL: {device.meta_panel || device.panel || '-'}</div>
                        <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">CT: {device.meta_ct || device.ct_ratio || '-'}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-right mt-1">
                <div className="text-[9px] text-slate-500 font-bold uppercase text-left">Phase</div>
                <div className="text-[9px] text-blue-500 font-bold uppercase">Volts</div>
                <div className="text-[9px] text-amber-500 font-bold uppercase">Amps</div>
                <div className="text-[9px] text-emerald-500 font-bold uppercase">kW</div>

                <div className="text-[10px] text-slate-500 font-bold text-left">R</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.voltage_a, 1)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.current_a, 2)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.power_a, 2)}</div>

                <div className="text-[10px] text-slate-500 font-bold text-left">S</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.voltage_b, 1)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.current_b, 2)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.power_b, 2)}</div>

                <div className="text-[10px] text-slate-500 font-bold text-left">T</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.voltage_c, 1)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.current_c, 2)}</div>
                <div className="text-[11px] font-mono text-slate-700">{fmt(device.power_c, 2)}</div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 text-[10px] uppercase">Active Energy</span>
                    <div className="font-mono text-emerald-600 font-bold">
                        {fmt(device.energy_total, 2)} <span className="text-[9px] text-slate-400">kWh</span>
                    </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase">
                    <span>Instant Power</span>
                    <span className="font-mono text-emerald-600 font-bold">{fmt(totalPower, 2)} kW</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-700"
                        style={{ width: `${loadRatio}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CircuitCapsule;
