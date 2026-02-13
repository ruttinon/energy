import React, { useMemo } from 'react';
import { Server, Activity } from 'lucide-react';
import EnergyAura from './EnergyAura';
import CircuitCapsule from './CircuitCapsule';

const ConverterPanel = ({ converterName, devices }) => {
    const summary = useMemo(() => {
        return devices.reduce((acc, d) => {
            // Calculate Capacity for this device
            let cap = 100;
            if (d.meta_ct) {
                const match = String(d.meta_ct).match(/(\d+)/);
                if (match) {
                    const amp = parseInt(match[1], 10);
                    cap = (3 * 230 * amp) / 1000;
                }
            }
            return {
                power: acc.power + (d.power_active || 0),
                energy: acc.energy + (d.energy_total || 0),
                current: acc.current + (d.current_avg || 0),
                online: acc.online + (d.status !== 'offline' ? 1 : 0),
                capacity: acc.capacity + cap
            };
        }, { power: 0, energy: 0, current: 0, online: 0, capacity: 0 });
    }, [devices]);

    const totalLoad = summary.capacity || 100;
    const loadPercent = Math.min((summary.power / totalLoad) * 100, 100);
    const isOnline = summary.online > 0;

    return (
        <div className="relative flex flex-col rounded-3xl bg-white border border-slate-200 overflow-hidden min-h-[400px] shadow-sm transition-all duration-500 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-100 hover:-translate-y-1">
            <div className="relative p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                <EnergyAura loadPercentage={loadPercent} color={loadPercent > 80 ? 'red' : 'emerald'} />

                <div className="flex justify-between items-start mt-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono uppercase tracking-[0.25em]">
                            <Server size={12} />
                            <span>Control Unit</span>
                        </div>
                        <h2 className="text-3xl font-bold font-rajdhani text-slate-800 tracking-wide">
                            {converterName}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[11px] text-slate-500">
                                {summary.online} / {devices.length} Devices Online
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Total Power</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold font-orbitron text-slate-800">{summary.power.toFixed(1)}</span>
                                <span className="text-sm text-yellow-600 font-bold uppercase">kW</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end opacity-80">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Energy Counter</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-mono text-slate-700">{Number(summary.energy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-emerald-600 font-bold uppercase">kWh</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 p-4 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {devices.map(device => (
                        <CircuitCapsule key={device.id} device={device} />
                    ))}

                    {devices.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <Activity size={48} className="mb-4" />
                            <p className="text-sm uppercase tracking-widest">No Devices Connected</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-1 w-full bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
        </div>
    );
};

export default ConverterPanel;
