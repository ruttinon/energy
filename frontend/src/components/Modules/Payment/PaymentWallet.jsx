import React, { useState } from 'react';

const providers = ['LinePay','TrueMoney','ApplePay','GooglePay'];

const PaymentWallet = () => {
    const [provider, setProvider] = useState('LinePay');
    const [status, setStatus] = useState('pending');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                {providers.map(p => (
                    <button key={p} onClick={() => setProvider(p)} className={`px-3 py-2 text-xs rounded-xl border ${provider===p?'bg-emerald-500/20 text-emerald-300 border-emerald-500/40':'bg-slate-800 text-slate-300 border-white/10'}`}>{p}</button>
                ))}
            </div>
            <div className="text-sm text-slate-300">ผู้ให้บริการ: {provider}</div>
            <div className={`text-xs ${status==='success'?'text-emerald-400':'text-amber-400'}`}>{status==='success'?'ชำระสำเร็จ':'รอดำเนินการ'}</div>
            <div className="flex gap-2">
                <button onClick={() => setStatus('pending')} className="px-3 py-2 text-xs rounded-xl bg-slate-800 text-slate-300 border border-white/10">รีเซ็ต</button>
                <button onClick={() => setStatus('success')} className="px-3 py-2 text-xs rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ยืนยันชำระ</button>
            </div>
        </div>
    );
};

export default PaymentWallet;
