import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import ConverterPanel from './ConverterPanel';
import { LayoutGrid, Activity, Zap } from 'lucide-react';

const EnterpriseMonitor = () => {
    console.log('[EnterpriseMonitor] Rendered');
    const { devices, readingsByDevice, projectName, deviceStatus } = useApp();
    console.log('[EnterpriseMonitor] devices:', devices, 'type:', Array.isArray(devices), 'length:', devices?.length);
    console.log('[EnterpriseMonitor] readingsByDevice:', readingsByDevice, 'typeof:', typeof readingsByDevice, 'keys:', Object.keys(readingsByDevice || {}));

    // Helper to safely get value from raw readings with multiple potential keys
    const getVal = (obj, keys) => {
        if (!obj) return 0;
        for (const k of keys) {
            // Exact match
            if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
            // Lowercase match
            const lowerK = k.toLowerCase();
            const foundKey = Object.keys(obj).find(ok => ok.toLowerCase() === lowerK);
            if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) return Number(obj[foundKey]);
        }
        return 0;
    };
    if (!devices || devices.length === 0) {
        console.warn('[EnterpriseMonitor] No devices found:', devices);
        return (
            <div className="flex flex-col items-center justify-center py-20 text-red-500 animate-pulse">
                <h3 className="text-xl font-orbitron">NO DEVICES FOUND</h3>
                <p className="text-sm mt-2">Check AppContext, API, หรือ project selection.</p>
                <pre className="text-xs mt-4 bg-slate-100 p-2 rounded max-w-xl overflow-x-auto">{JSON.stringify(devices, null, 2)}</pre>
            </div>
        );
    }
    if (!readingsByDevice || Object.keys(readingsByDevice).length === 0) {
        console.warn('[EnterpriseMonitor] No readingsByDevice found:', readingsByDevice);
        return (
            <div className="flex flex-col items-center justify-center py-20 text-orange-500 animate-pulse">
                <h3 className="text-xl font-orbitron">NO READINGS FOUND</h3>
                <p className="text-sm mt-2">Check AppContext, API, หรือ device data.</p>
                <pre className="text-xs mt-4 bg-slate-100 p-2 rounded max-w-xl overflow-x-auto">{JSON.stringify(readingsByDevice, null, 2)}</pre>
            </div>
        );
    }
    // Debug: show id types
    devices.forEach((d, i) => {
        console.log(`[EnterpriseMonitor] Device[${i}] id:`, d.id, 'type:', typeof d.id);
    });
    Object.keys(readingsByDevice).forEach((k) => {
        console.log(`[EnterpriseMonitor] readingsByDevice key:`, k, 'type:', typeof k);
    });

    const devicesWithReadings = useMemo(() => {
        const now = Date.now();
        const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
        return devices.map(d => {
            // Ensure id is string for mapping
            const idStr = String(d.id);
            const rawReadings = readingsByDevice[idStr] || {};
            let ts = rawReadings.timestamp || rawReadings.ts || 0;
            if (typeof ts === 'string') ts = parseInt(ts, 10);
            if (ts && ts < 1e12) ts = ts * 1000; // convert seconds to ms if needed
            if (!ts || isNaN(ts)) ts = 0;

            const mapped = {
                voltage_a: getVal(rawReadings, ['Voltage_L1', 'Voltage_A', 'voltage_a', 'V_L1', 'U_L1_N']),
                voltage_b: getVal(rawReadings, ['Voltage_L2', 'Voltage_B', 'voltage_b', 'V_L2', 'U_L2_N']),
                voltage_c: getVal(rawReadings, ['Voltage_L3', 'Voltage_C', 'voltage_c', 'V_L3', 'U_L3_N']),
                current_a: getVal(rawReadings, ['Current_L1', 'Current_A', 'current_a', 'I_L1']),
                current_b: getVal(rawReadings, ['Current_L2', 'Current_B', 'current_b', 'I_L2']),
                current_c: getVal(rawReadings, ['Current_L3', 'Current_C', 'current_c', 'I_L3']),
                power_a: getVal(rawReadings, ['ActivePower_L1', 'Power_A', 'power_a', 'P_L1']),
                power_b: getVal(rawReadings, ['ActivePower_L2', 'Power_B', 'power_b', 'P_L2']),
                power_c: getVal(rawReadings, ['ActivePower_L3', 'Power_C', 'power_c', 'P_L3']),
                energy_total: getVal(rawReadings, ['ActiveEnergy_kWh', 'ActiveEnergy_Total', 'energy_total', 'E_Total', 'TotalActiveEnergy', 'kWh']),
                power_active: getVal(rawReadings, ['ActivePower_Total', 'TotalActivePower', 'power_active', 'P_Total', 'TotalPower']),
                current_avg: getVal(rawReadings, ['AverageCurrent', 'Current_Avg', 'current_avg', 'I_Avg']),
            };

            // Robust online detection
            let isOnline = false;
            let onlineReason = '';

            // Check explicit status from backend first
            const backendStatus = deviceStatus && deviceStatus[idStr];
            if (backendStatus === 'online') {
                isOnline = true;
                onlineReason = 'backend_status';
            } else if (backendStatus === 'offline') {
                isOnline = false;
                onlineReason = 'backend_status_offline';
            } else {
                // Fallback to timestamp + values check
                if (ts && (now - ts < STALE_THRESHOLD_MS)) {
                    if (mapped.voltage_a > 0 || mapped.voltage_b > 0 || mapped.voltage_c > 0) {
                        isOnline = true; onlineReason = 'voltage';
                    } else if (mapped.current_a > 0 || mapped.current_b > 0 || mapped.current_c > 0) {
                        isOnline = true; onlineReason = 'current';
                    } else if (mapped.power_a > 0 || mapped.power_b > 0 || mapped.power_c > 0) {
                        isOnline = true; onlineReason = 'power';
                    } else if (mapped.power_active > 0) {
                        isOnline = true; onlineReason = 'power_active';
                    } else if (mapped.energy_total > 0) {
                         // Even if instant power is 0, if energy is present and updated recently, it might be online but idle
                         // But usually we want instant values.
                         // Let's assume if we have recent TS, it's online, unless values are ALL zero which might indicate com error on some devices,
                         // but usually com error means no update at all.
                         // If we receive 0s, it means the device is communicating 0s.
                         isOnline = true; onlineReason = 'recent_data';
                    }
                }
            }
            // Log online detection result
            console.log('[Monitor] Online detection:', {
                id: d.id, idType: typeof d.id, ts, now, age: now - ts, mapped, isOnline, onlineReason, rawReadings
            });

            mapped.status = isOnline ? 'online' : 'offline';
            if (rawReadings.status) mapped.status = rawReadings.status;
            mapped._ts = ts;

            return {
                ...d,
                ...mapped
            };
        });
    }, [devices, readingsByDevice]);

    const globalSummary = useMemo(() => {
        const totals = devicesWithReadings.reduce((acc, d) => {
            acc.power += d.power_active || 0;
            acc.energy += d.energy_total || 0;
            acc.online += d.status !== 'offline' ? 1 : 0;
            return acc;
        }, { power: 0, energy: 0, online: 0 });

        return {
            totalPower: totals.power,
            totalEnergy: totals.energy,
            onlineDevices: totals.online,
            totalDevices: devicesWithReadings.length
        };
    }, [devicesWithReadings]);

    // Get converter list for lookup if needed
    const { converters: converterNames } = useApp();

    const groupedDevices = useMemo(() => {
        const groups = {};
        devicesWithReadings.forEach(d => {
            // Priority: 1. d.converter (string name) 
            //           2. d.parent (index) -> converterNames[index]
            //           3. "Unassigned"

            let key = d.converter;

            if (!key && (d.converter_index !== undefined && d.converter_index !== null)) {
                // Map index to name (ข้อมูลจริงเท่านั้น)
                key = converterNames[d.converter_index] || `Converter ${d.converter_index + 1}`;
            }

            if (!key) key = 'Unassigned';

            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });
        return groups;
    }, [devicesWithReadings, converterNames]);

    const sortedGroups = Object.keys(groupedDevices).sort();

    const isLive = globalSummary.onlineDevices > 0;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-transparent px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">
                        <LayoutGrid size={14} />
                        <span>Command Center</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl lg:text-2xl font-orbitron font-semibold text-slate-800">
                            {projectName || 'Project'}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                            Live System Overview
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${isLive ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                        <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{isLive ? 'Live Stream: Active' : 'Live Stream: Standby'}</span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <Activity size={14} className="text-yellow-600" />
                        <span className="uppercase tracking-widest text-[10px]">Devices</span>
                        <span className="font-mono text-xs text-slate-800 font-bold">
                            {globalSummary.onlineDevices} / {globalSummary.totalDevices}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <Zap size={14} className="text-amber-500" />
                        <span className="uppercase tracking-widest text-[10px]">Total Load</span>
                        <span className="font-orbitron text-xs text-slate-800 font-bold">
                            {globalSummary.totalPower.toFixed(1)} kW
                        </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <span className="uppercase tracking-widest text-[10px]">Energy Today</span>
                        <span className="font-mono text-xs text-emerald-600 font-bold">
                            {Number(globalSummary.totalEnergy || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 pb-12">
                {sortedGroups.map(groupName => (
                    <ConverterPanel
                        key={groupName}
                        converterName={groupName}
                        devices={groupedDevices[groupName]}
                    />
                ))}

                {sortedGroups.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-pulse">
                        <LayoutGrid size={64} className="mb-4 opacity-20" />
                        <h3 className="text-xl font-orbitron text-slate-500">INITIALIZING SYSTEM...</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnterpriseMonitor;
