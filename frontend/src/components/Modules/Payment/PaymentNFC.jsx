import React, { useState } from 'react';

const PaymentNFC = () => {
    const [waiting, setWaiting] = useState(true);
    const [status, setStatus] = useState('pending');

    return (
        <div className="space-y-4">
            <div className="text-sm text-slate-300">นำบัตรหรืออุปกรณ์มาแตะที่เครื่องอ่าน</div>
            <div className="flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <div className={`w-full h-full rounded-full ${waiting?'animate-ping':''} bg-purple-500/20`} />
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => { setWaiting(false); setStatus('success'); }} className="px-3 py-2 text-xs rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">จำลองการแตะ</button>
                <button onClick={() => { setWaiting(true); setStatus('pending'); }} className="px-3 py-2 text-xs rounded-xl bg-slate-800 text-slate-300 border border-white/10">รีเซ็ต</button>
            </div>
            <div className={`text-xs ${status==='success'?'text-emerald-400':'text-amber-400'}`}>{status==='success'?'ชำระสำเร็จ':'รอการแตะ'}</div>
        </div>
    );
};

export default PaymentNFC;
