import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';

const SummaryModule = () => {
    const { selectedDevice, readingsByDevice, devices, setSelectedDevice, deviceStatus } = useApp();
    const vectorCanvasRef = useRef(null);
    const powerCanvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const prevDataRef = useRef({
        vArr: [0, 0, 0],
        iArr: [0, 0, 0],
        P: 0,
        Q: 0
    });

    const [data, setData] = useState(null);

    useEffect(() => {
        if (!selectedDevice || !readingsByDevice[selectedDevice]) return;

        const latest = readingsByDevice[selectedDevice];
        const vArr = [latest.Voltage_L1 || 0, latest.Voltage_L2 || 0, latest.Voltage_L3 || 0];
        const iArr = [latest.Current_L1 || 0, latest.Current_L2 || 0, latest.Current_L3 || 0];
        const P = latest.ActivePower_Total || (latest.ActivePower_L1 || 0) + (latest.ActivePower_L2 || 0) + (latest.ActivePower_L3 || 0);
        const Q = latest.ReactivePower_Total || (latest.ReactivePower_L1 || 0) + (latest.ReactivePower_L2 || 0) + (latest.ReactivePower_L3 || 0);

        setData({
            ...latest,
            vArr,
            iArr,
            P,
            Q,
            VLL: ((latest.Voltage_L1L2 || 0) + (latest.Voltage_L2L3 || 0) + (latest.Voltage_L3L1 || 0)) / 3 || vArr.reduce((a, b) => a + b, 0),
            VLN: vArr.reduce((a, b) => a + b, 0) / 3,
            Iavg: iArr.reduce((a, b) => a + b, 0) / 3,
        });

        prevDataRef.current = { vArr, iArr, P, Q };
    }, [selectedDevice, readingsByDevice]);

    // DRAWING LOGIC (PORTED FROM summary_view.js)
    useEffect(() => {
        const animate = () => {
            const vCanvas = vectorCanvasRef.current;
            const pCanvas = powerCanvasRef.current;

            if (vCanvas && pCanvas) {
                drawVectorDual(vCanvas, prevDataRef.current.vArr, prevDataRef.current.iArr);
                drawPowerCircle(pCanvas, prevDataRef.current.P, prevDataRef.current.Q);
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    const fmt = (n, d = 2) => {
        const v = Number(n);
        return Number.isFinite(v) ? v.toFixed(d) : '--';
    };

    const drawVectorDual = (canvas, vArr, iArr) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const DPR = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0) return;

        const target = Math.floor(rect.width * DPR);
        if (canvas.width !== target || canvas.height !== target) {
            canvas.width = target;
            canvas.height = target;
        }

        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
        const time = Date.now() * 0.0004;
        const globalSpin = Date.now() * 0.00008;

        ctx.clearRect(0, 0, w, h);

        // Background Rings
        for (let r = 1; r >= 0.25; r -= 0.25) {
            const innerGrad = ctx.createRadialGradient(cx - 5 * DPR, cy - 5 * DPR, R * r * 0.3, cx, cy, R * r);
            innerGrad.addColorStop(0, `rgba(234, 179, 8, ${0.05 * r})`); // Yellow-500
            innerGrad.addColorStop(0.7, `rgba(241, 245, 249, ${0.3 * r})`); // Slate-100
            innerGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = innerGrad;
            ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = `rgba(234, 179, 8, ${0.4 * r})`; // Yellow-500
            ctx.lineWidth = 1.5 * DPR;
            ctx.setLineDash([12 * DPR, 12 * DPR]);
            ctx.lineDashOffset = Math.sin(time * (1.1 + r)) * 60;
            ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);

        const phases = [0, 240, 120];
        // Voltage Setup
        const vMax = Math.max(...vArr.map(Number), 1);
        const vCols = ['#0ea5e9', '#8b5cf6', '#10b981']; // Sky-500, Violet-500, Emerald-500
        const vLabels = ['V1', 'V2', 'V3'];

        // Current Setup
        const iMax = Math.max(...iArr.map(Number), 1);
        const iCols = ['#ca8a04', '#ea580c', '#dc2626']; // Yellow-600, Orange-600, Red-600
        const iLabels = ['I1', 'I2', 'I3'];

        // Draw Voltage Vectors (Background/Longer)
        for (let i = 0; i < 3; i++) {
            const ang = (phases[i] * Math.PI) / 180 + globalSpin;
            const len = R * (Math.abs(Number(vArr[i]) || 0) / vMax);
            const x = cx + len * Math.cos(ang), y = cy + len * Math.sin(ang);

            ctx.shadowBlur = Math.min(12, 20 * DPR); ctx.shadowColor = vCols[i];
            ctx.strokeStyle = vCols[i]; ctx.lineWidth = 4 * DPR;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
            ctx.shadowBlur = 0;

            // Label V
            ctx.fillStyle = '#1e293b'; // Slate-800
            ctx.shadowBlur = 0; 
            ctx.font = `bold ${12 * DPR}px Orbitron`;
            ctx.fillText(`${vLabels[i]} ${fmt(vArr[i], 1)}V`, x + 10 * DPR, y + 5 * DPR);
            ctx.shadowBlur = 0;
        }

        // Draw Current Vectors (Foreground)
        for (let i = 0; i < 3; i++) {
            // Assuming Unity PF for visualization if no phase angle data
            // To make it look realistic, we might offset I slightly if needed, but here we align phase
            const ang = (phases[i] * Math.PI) / 180 + globalSpin;

            // Scale I independent of V (max I = 80% radius)
            const len = (R * 0.85) * (Math.abs(Number(iArr[i]) || 0) / iMax);

            // Offset X/Y slightly to not overlap exactly if Unity PF
            // Or just draw them. Since they are different colors/lengths, it's fine.
            const x = cx + len * Math.cos(ang), y = cy + len * Math.sin(ang);

            ctx.strokeStyle = iCols[i];
            ctx.lineWidth = 3 * DPR;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();

            // Label I
            if (len > 10) { // Only label if vector has length
                ctx.fillStyle = iCols[i];
                ctx.shadowBlur = 0;
                ctx.font = `bold ${10 * DPR}px Orbitron`;
                // Place label slightly offset from V
                ctx.fillText(`${iLabels[i]} ${fmt(iArr[i], 2)}A`, x + 10 * DPR, y + 20 * DPR);
                ctx.shadowBlur = 0;
            }
        }
    };

    const drawPowerCircle = (canvas, P, Q) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const DPR = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0) return;

        const target = Math.floor(rect.width * DPR);
        if (canvas.width !== target || canvas.height !== target) {
            canvas.width = target;
            canvas.height = target;
        }

        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
        const spin = Date.now() * 0.00015;

        ctx.clearRect(0, 0, w, h);

        for (let r = 1; r >= 0.25; r -= 0.25) {
            ctx.strokeStyle = `rgba(234, 179, 8, ${0.3 * r})`; // Yellow-500
            ctx.lineWidth = 1.5 * DPR;
            ctx.setLineDash([12 * DPR, 12 * DPR]);
            ctx.lineDashOffset = spin * r * 120;
            ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);

        const S = Math.sqrt(P * P + Q * Q) || 1;
        const maxS = Math.max(Math.abs(S), 100);
        const len = R * (Math.abs(S) / maxS);
        const angle = Math.atan2(Q, P);
        const angle360 = (angle + Math.PI * 2) % (Math.PI * 2);
        const x = cx + len * Math.cos(angle), y = cy - len * Math.sin(angle);

        ctx.shadowBlur = Math.min(14, 25 * DPR); ctx.shadowColor = '#0284c7'; // Sky-600
        ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 5 * DPR;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#059669'; // Emerald-600
        ctx.lineWidth = 3 * DPR;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.95, 0, angle360); ctx.stroke();

        ctx.fillStyle = '#0891b2'; // Cyan-600
        ctx.font = `bold ${12 * DPR}px Orbitron`;
        ctx.fillText(`${fmt(S, 0)} VA`, x + 10, y - 10);
    };

    if (!selectedDevice || !data) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">เลือกอุปกรณ์เพื่อดูแบบรายตัว</div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Meter</span>
                    <select
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-yellow-500 outline-none"
                        value={selectedDevice || ''}
                        onChange={(e) => setSelectedDevice(e.target.value || '')}
                    >
                        <option value="">กรุณาเลือกอุปกรณ์</option>
                        {devices.map(d => (
                            <option key={d.id} value={String(d.id)}>
                                {d.name || d.id}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        );
    }

    return (
        <div className="module-3d space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <div className="text-[10px] uppercase tracking-[3px] text-yellow-600 opacity-80">Realtime Summary</div>
                    <h2 className="text-2xl font-bold font-orbitron text-slate-800 mt-1">
                        {data.device_name || `Device #${selectedDevice}`}
                    </h2>
                    <div className="text-sm text-slate-500 font-rajdhani">
                        System ID: {selectedDevice} | Status: <span className={(deviceStatus[selectedDevice] === 'online') ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{(deviceStatus[selectedDevice] === 'online') ? 'ONLINE' : 'OFFLINE'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-mono text-slate-500 mb-1">{new Date().toLocaleTimeString()}</div>
                    <div className="px-3 py-1 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-[10px] font-bold tracking-widest uppercase">
                        Live Link Active
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Voltage', value: `${fmt(data.VLL, 0)}V`, hint: 'VLL Avg', color: 'text-blue-600' },
                    { label: 'Load', value: `${fmt(data.Iavg, 1)}A`, hint: 'Current Avg', color: 'text-amber-600' },
                    { label: 'Power Factor', value: fmt(Math.abs(data.P / (Math.sqrt(data.P ** 2 + data.Q ** 2) || 1)), 2), hint: 'P / S', color: 'text-purple-600' },
                    { label: 'Frequency', value: `${fmt(data.Frequency || 50, 2)}Hz`, hint: 'System Freq', color: 'text-emerald-600' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{kpi.label}</div>
                        <div className={`text-2xl font-bold font-orbitron ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase">{kpi.hint}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col items-center">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-4 self-start">Phase Vector Diagram</div>
                    <canvas ref={vectorCanvasRef} className="w-full max-w-[320px] aspect-square" />
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col items-center">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-4 self-start">Power Distribution Circle</div>
                    <canvas ref={powerCanvasRef} className="w-full max-w-[320px] aspect-square" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-100 pb-2">Secondary Parameters</div>
                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">THD Voltage</div>
                            <div className="text-lg font-orbitron text-slate-800">{fmt(((data.THD_Voltage_L1 || 0) + (data.THD_Voltage_L2 || 0) + (data.THD_Voltage_L3 || 0)) / 3, 2)}%</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">THD Current</div>
                            <div className="text-lg font-orbitron text-slate-800">{fmt(((data.THD_Current_L1 || 0) + (data.THD_Current_L2 || 0) + (data.THD_Current_L3 || 0)) / 3, 2)}%</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Unbalance U</div>
                            <div className="text-lg font-orbitron text-slate-800">0.42%</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Unbalance I</div>
                            <div className="text-lg font-orbitron text-slate-800">1.15%</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-100 pb-2">Power Metrics</div>
                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Active Power (P)</div>
                            <div className="text-lg font-orbitron text-blue-600">{fmt(data.P, 0)} W</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Reactive Power (Q)</div>
                            <div className="text-lg font-orbitron text-amber-600">{fmt(data.Q, 0)} var</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Apparent Power (S)</div>
                            <div className="text-lg font-orbitron text-slate-800">{fmt(Math.sqrt(data.P ** 2 + data.Q ** 2), 0)} VA</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Frequency</div>
                            <div className="text-lg font-orbitron text-emerald-600">{fmt(data.Frequency || 50, 2)} Hz</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SummaryModule;
