import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getApiBase } from 'services/api';

const ControlContext = createContext();

export const useControl = () => useContext(ControlContext);

export const ControlProvider = ({ children }) => {
    // Shared State for Universal Control
    const [controlDevices, setControlDevices] = useState([]);
    const [deviceStatuses, setDeviceStatuses] = useState({});
    const [deviceOutputs, setDeviceOutputs] = useState({});
    
    // Polling Control
    const [activePolling, setActivePolling] = useState(false);
    const pollingRef = useRef(null);

    // Initial Fetch of Devices (One-time or on-demand)
    const fetchControlDevices = async () => {
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/control/devices`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setControlDevices(data.devices || []);
            }
        } catch (err) {
            console.error("[ControlContext] Failed to fetch devices", err);
        }
    };

    // Fetch Status for a specific device
    const fetchDeviceStatus = async (deviceId) => {
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/control/devices/${deviceId}/status`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const statusMap = {};
                (data.statuses || []).forEach(s => {
                    statusMap[s.key] = { status: s.status, value: s.value };
                });
                
                setDeviceStatuses(prev => ({
                    ...prev,
                    [deviceId]: statusMap
                }));
            }
        } catch (err) {
            console.error(`[ControlContext] Failed to fetch status for ${deviceId}`, err);
        }
    };

    // Fetch Outputs for a specific device (Config)
    const fetchDeviceOutputs = async (deviceId) => {
        if (deviceOutputs[deviceId]) return; // Cache hit
        try {
            const API = getApiBase();
            const res = await fetch(`${API}/control/devices/${deviceId}/outputs`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDeviceOutputs(prev => ({
                    ...prev,
                    [deviceId]: data.outputs || []
                }));
            }
        } catch (err) {
            console.error(`[ControlContext] Failed to fetch outputs for ${deviceId}`, err);
        }
    };

    // Global Polling Mechanism
    // If activePolling is true (Universal Control page is open), poll frequently (e.g. 2s)
    // If activePolling is false, poll slowly (e.g. 10s) or pause (depending on requirement)
    // The user asked for "Always Loaded", so we will poll continuously but slower when background.
    useEffect(() => {
        const poll = async () => {
            if (controlDevices.length === 0) return;
            
            // Poll status for all known devices (or at least the ones that have been viewed)
            // To avoid massive request storm, we can poll only "active" or "cached" devices
            const devicesToPoll = Object.keys(deviceStatuses);
            if (devicesToPoll.length === 0 && controlDevices.length > 0) {
                 // Initial case: maybe poll the first one or all? 
                 // Let's poll all controllable devices found
                 controlDevices.forEach(d => devicesToPoll.push(d.device_id));
            }

            // Batch or sequential poll?
            // Current backend is per-device.
            // We should be careful. 
            // Better strategy: Only poll the "Selected" device fast. Poll others slow.
            // But here we are in global context.
            // Let's keep it simple: The CONTEXT holds the data. The COMPONENT triggers the fast poll.
            // The CONTEXT provides methods to update state.
        };
        
        // Actually, let's let the component drive the "Fast Poll" via `fetchDeviceStatus`.
        // The Context just holds the state so it doesn't disappear on unmount.
        
        fetchControlDevices();
    }, []);

    const value = {
        controlDevices,
        setControlDevices,
        deviceStatuses,
        setDeviceStatuses,
        deviceOutputs,
        fetchControlDevices,
        fetchDeviceStatus,
        fetchDeviceOutputs
    };

    return (
        <ControlContext.Provider value={value}>
            {children}
        </ControlContext.Provider>
    );
};
