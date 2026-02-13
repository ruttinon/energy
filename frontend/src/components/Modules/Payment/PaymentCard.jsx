import React, { useState } from 'react';

const PaymentCard = () => {
    const [type, setType] = useState('visa');
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [pin, setPin] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1);

    const next = () => setStep(s => Math.min(3, s + 1));
    const prev = () => setStep(s => Math.max(1, s - 1));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {['visa','mastercard','amex'].map(t => (
                    <button key={t} onClick={() => setType(t)} className={`px-3 py-2 text-xs rounded-xl border ${type===t?'bg-amber-500/20 text-amber-300 border-amber-500/40':'bg-slate-800 text-slate-300 border-white/10'}`}>{t.toUpperCase()}</button>
                ))}
            </div>
            {step === 1 && (
                <div className="space-y-3">
                    <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="หมายเลขบัตร" value={number} onChange={e=>setNumber(e.target.value)} />
                    <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="ชื่อบนบัตร" value={name} onChange={e=>setName(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                        <input className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="MM/YY" value={expiry} onChange={e=>setExpiry(e.target.value)} />
                        <input className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="CVV" value={cvv} onChange={e=>setCvv(e.target.value)} />
                    </div>
                </div>
            )}
            {step === 2 && (
                <div className="space-y-3">
                    <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="PIN" value={pin} onChange={e=>setPin(e.target.value)} />
                    <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white" placeholder="OTP" value={otp} onChange={e=>setOtp(e.target.value)} />
                </div>
            )}
            {step === 3 && (
                <div className="text-sm text-emerald-400">ชำระเงินด้วยบัตรสำเร็จ</div>
            )}
            <div className="flex items-center justify-between">
                <button onClick={prev} className="px-3 py-2 text-xs rounded-xl bg-slate-800 text-slate-300 border border-white/10">ย้อนกลับ</button>
                <button onClick={next} className="px-3 py-2 text-xs rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">{step<3?'ถัดไป':'เสร็จสิ้น'}</button>
            </div>
        </div>
    );
};

export default PaymentCard;
