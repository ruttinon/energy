import React from 'react';

const EnergyAura = ({ loadPercentage = 0, color = 'emerald' }) => {
    // Determine opacity/speed based on load
    // Low load = slow, dim
    // High load = fast, bright

    const opacity = Math.max(0.2, Math.min(loadPercentage / 100, 1));
    const speed = Math.max(1, 5 - (loadPercentage / 25)); // 5s to 1s

    const colorClass = color === 'cyan' ? 'bg-cyan-500' :
        color === 'amber' ? 'bg-amber-500' :
            color === 'red' ? 'bg-red-500' : 'bg-emerald-500';

    const shadowColor = color === 'cyan' ? 'rgba(6,182,212,0.5)' :
        color === 'amber' ? 'rgba(245,158,11,0.5)' :
            color === 'red' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)';

    return (
        <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden rounded-t-2xl pointer-events-none">
            {/* Base Glow */}
            <div
                className={`w-full h-full ${colorClass} blur-[2px]`}
                style={{ opacity: opacity * 0.5 }}
            />

            {/* Moving Flow */}
            <div
                className={`absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-50 blur-sm animate-flow`}
                style={{
                    animationDuration: `${speed}s`,
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite'
                }}
            />

            {/* Ambient Aura downwards */}
            <div
                className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-current to-transparent opacity-10"
                style={{ color: shadowColor }}
            />
        </div>
    );
};

export default EnergyAura;
