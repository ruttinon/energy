
import React from 'react';

const GlassButton = ({
    children,
    onClick,
    active,
    className = '',
    disabled = false,
    variant = 'default',
    size = 'md',
    icon: Icon,
    ...rest
}) => {
    const base = 'relative rounded-lg font-rajdhani font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2';
    const sizes = {
        sm: 'px-3 py-1.5 text-[10px]',
        md: 'px-4 py-2 text-xs',
        lg: 'px-5 py-3 text-sm'
    }[size] || 'px-4 py-2 text-xs';
    const variants = {
        default: 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white',
        primary: 'bg-amber-600 text-white border border-amber-500 hover:bg-amber-500 shadow-lg shadow-amber-600/20',
        secondary: 'bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700'
    }[variant] || 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white';
    const activeCls = active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : '';
    const disabledCls = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${sizes} ${variants} ${activeCls} ${disabledCls} ${className}`}
            {...rest}
        >
            {Icon && <Icon size={14} />}
            {children}
        </button>
    );
};

export default GlassButton;
