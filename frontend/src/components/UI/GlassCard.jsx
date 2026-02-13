import React from 'react';

const GlassCard = ({ children, className = '', ...props }) => {
    return (
        <div 
            className={`bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-xl shadow-slate-200/20 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default GlassCard;
