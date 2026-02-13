import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Search, Zap, Cpu, Activity, Clock, AlertCircle, CheckCircle } from 'lucide-react';

const OverviewModule = () => {
    const {
        devices,
        readings, // Keep readings for full metadata
        deviceStatus,
        selectedConverter,
        selectedDevice
    } = useApp();

    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('all');

    // The main component now acts as a wrapper, passing necessary props to a memoized content component
    // This structure helps manage the complexity of the useMemo hook and its dependencies.
    return <OverviewModuleContent
        devices={devices}
        readings={readings}
        deviceStatus={deviceStatus}
        selectedConverter={selectedConverter}
        selectedDevice={selectedDevice}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        category={category}
        setCategory={setCategory}
    />;
};

const OverviewModuleContent = ({
    devices, readings, deviceStatus,
    selectedConverter, selectedDevice,
    searchTerm, setSearchTerm, category, setCategory
}) => {

    const groupedData = useMemo(() => {
        const grouped = {};
        const lowerSearch = searchTerm.toLowerCase();

        // Pre-index readings by device ID for faster lookup of rich reading objects
        const readingsByDevId = {};
        readings.forEach(r => {
            const did = String(r.device_id);
            if (!readingsByDevId[did]) readingsByDevId[did] = [];
            readingsByDevId[did].push(r);
        });

        devices.forEach(device => {
            const deviceId = String(device.id);
            const devName = device.name || `Device #${deviceId}`;
            const converter = device.converter || 'Unknown';

            // 1. Context Filters (Sidebar)
            if (selectedDevice && String(selectedDevice) !== deviceId) return;
            // Robust converter matching
            if (selectedConverter && (!device.converter || String(device.converter) !== String(selectedConverter))) return;

            // 2. Get all rich readings for this device
            let myReadings = readingsByDevId[deviceId] || [];

            // Determine device status
            // Priority: explicit status from backend > presence of recent readings > offline
            const explicitStatus = deviceStatus[deviceId];
            const hasRecentReadings = myReadings.some(r => r.value !== null && r.value !== undefined);

            // ✅ FIX: Stricter logic. If backend says 'offline', believe it.
            // Only fallback to 'hasRecentReadings' if status is unknown/undefined.
            let isOnline = false;
            if (explicitStatus === 'online') {
                isOnline = true;
            } else if (explicitStatus === 'offline') {
                isOnline = false;
            } else {
                isOnline = hasRecentReadings;
            }

            const currentDeviceStatus = isOnline ? 'online' : 'offline';

            const hasReadings = hasRecentReadings;

            // 3. Filter readings based on Search & Category
            const deviceNameMatch = devName.toLowerCase().includes(lowerSearch);

            let filteredParams = myReadings.filter(r => {
                const pName = String(r.parameter || '').toLowerCase();
                const pDesc = (r.description || '').toLowerCase();

                // Search Text Check: parameter name or description matches search term
                const paramTextMatch = pName.includes(lowerSearch) || pDesc.includes(lowerSearch);

                // Category Check
                let categoryMatch = true;
                if (category !== 'all') {
                    if (category === 'voltage') categoryMatch = pName.includes('voltage') || pName.startsWith('v');
                    else if (category === 'current') categoryMatch = pName.includes('current') || pName.startsWith('i');
                    else if (category === 'power') categoryMatch = pName.includes('power') || pName.startsWith('p') || pName.startsWith('q') || pName.startsWith('s');
                    else if (category === 'other') categoryMatch = !pName.includes('voltage') && !pName.includes('current') && !pName.includes('power');
                }

                // A parameter is included if it matches both text (if search term exists) and category
                return (lowerSearch === '' || paramTextMatch) && categoryMatch;
            });

            // Determine if the device itself should be shown based on filters
            // A device is filtered out if:
            // 1. There's a search term AND the device name doesn't match AND no parameters match the search/category.
            // This prevents devices from showing up if they don't have relevant data for the search.
            const isFilteredOutBySearch = (lowerSearch !== '' || category !== 'all') &&
                !deviceNameMatch &&
                filteredParams.length === 0;

            if (isFilteredOutBySearch) {
                return; // Skip this device entirely
            }

            // Initialize group if not exists
            if (!grouped[converter]) grouped[converter] = {};

            grouped[converter][devName] = {
                deviceId: deviceId,
                status: currentDeviceStatus,
                parameters: filteredParams,
                hasData: hasReadings // Indicates if the device has any readings at all, regardless of filters
            };
        });

        return grouped;
    }, [devices, readings, deviceStatus, searchTerm, category, selectedDevice, selectedConverter]);

    const converters = Object.keys(groupedData).sort();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800">System Overview</h2>
                    <p className="text-sm text-slate-500 font-rajdhani">Real-time parameter hierarchy & analytics</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-mono text-slate-700">{new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search parameters or devices..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-yellow-500 outline-none placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-yellow-500 outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="all">All Categories</option>
                    <option value="voltage">⚡ Voltage</option>
                    <option value="current">🔌 Current</option>
                    <option value="power">💡 Power</option>
                    <option value="other">📊 Other</option>
                </select>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Live System Data</span>
                </div>
            </div>

            {/* Grouped Content */}
            <div className="space-y-8">
                {converters.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">
                        No devices found matching your criteria.
                    </div>
                ) : (
                    converters.map(conv => (
                        <div key={conv} className="space-y-4">
                            {/* Converter Header */}
                            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-4 border-yellow-500 rounded-r-lg">
                                <Zap className="w-5 h-5 text-yellow-600" />
                                <div>
                                    <h3 className="text-lg font-bold font-orbitron text-slate-800">{conv}</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                        {Object.keys(groupedData[conv]).length} Devices Configured
                                    </p>
                                </div>
                            </div>

                            {/* Devices in this Converter */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 ml-6">
                                {Object.keys(groupedData[conv]).sort().map(devName => {
                                    const devData = groupedData[conv][devName];
                                    const isOnline = devData.status === 'online';

                                    return (
                                        <div key={devName} className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${!isOnline ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                            <div className="px-4 py-2 bg-slate-50 flex items-center justify-between border-b border-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className={`w-4 h-4 ${isOnline ? 'text-yellow-600' : 'text-slate-400'}`} />
                                                    <span className="text-sm font-bold text-slate-700">{devName}</span>
                                                    {isOnline ? (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] border border-emerald-200">
                                                            <CheckCircle className="w-3 h-3" /> Online
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] border border-rose-200">
                                                            <AlertCircle className="w-3 h-3" /> Offline
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                    ID: {devData.deviceId}
                                                </span>
                                            </div>
                                            <div className="p-0">
                                                <div className="table-responsive overflow-x-auto">
                                                    {devData.parameters.length > 0 ? (
                                                        <div className="grid-table w-full text-xs min-w-[300px]">
                                                            <div className="grid-header text-slate-500 border-b border-slate-200 bg-slate-50 grid-cols-[50%_30%_20%]">
                                                                <div className="text-left py-2 px-4 font-medium uppercase tracking-wider whitespace-nowrap">Parameter</div>
                                                                <div className="text-right py-2 px-4 font-medium uppercase tracking-wider whitespace-nowrap">Value</div>
                                                                <div className="text-left py-2 px-4 font-medium uppercase tracking-wider whitespace-nowrap pl-6">Unit</div>
                                                            </div>
                                                            <div className="divide-y divide-slate-100">
                                                                {devData.parameters.map((param, idx) => (
                                                                    <div key={idx} className="grid-row hover:bg-yellow-50/50 transition-colors border-b border-slate-100 last:border-0 grid-cols-[50%_30%_20%]">
                                                                        <div className="py-2 px-4 text-slate-700 font-medium truncate" title={param.parameter}>{param.parameter}</div>
                                                                        <div className="py-2 px-4 text-right font-mono font-bold text-yellow-600 whitespace-nowrap overflow-hidden text-ellipsis">
                                                                            {typeof param.value === 'number' ? param.value.toFixed(2) : param.value}
                                                                        </div>
                                                                        <div className="py-2 px-4 text-slate-400 italic whitespace-nowrap pl-6">{param.unit || '-'}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-6 text-center text-xs text-slate-500 italic">
                                                            {isOnline ? 'No parameters match your search.' : 'Device is offline. No data available.'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default OverviewModule;
