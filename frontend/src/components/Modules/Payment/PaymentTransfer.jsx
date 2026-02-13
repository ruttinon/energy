import React, { useState } from 'react';

const PaymentTransfer = () => {
    const [ref, setRef] = useState('');
    const [status, setStatus] = useState('pending');

    return (
        <div className="space-y-4">
            <div className="text-sm text-slate-300">ข้อมูลบัญชีสำหรับโอน</div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5 text-xs text-slate-300">
                บัญชี: EnergyLink Co.,Ltd. • ธนาคารกรุงเทพ • 123-4-56789-0
            </div>
            <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="หมายเลขอ้างอิงการโอน" value={ref} onChange={e=>setRef(e.target.value)} />
            <div className="flex gap-2">
                <button onClick={() => setStatus('pending')} className="px-3 py-2 text-xs rounded-xl bg-slate-800 text-slate-300 border border-white/10">รีเซ็ต</button>
                <button onClick={() => setStatus('success')} className="px-3 py-2 text-xs rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40">ยืนยันการโอน</button>
            </div>
            <div className={`text-xs ${status==='success'?'text-emerald-400':'text-amber-400'}`}>{status==='success'?'ตรวจสอบสำเร็จ':'รอตรวจสอบ'}</div>
        </div>
    );
};

export default PaymentTransfer;
