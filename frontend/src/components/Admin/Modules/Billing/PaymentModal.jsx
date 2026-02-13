import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, X, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';

const PaymentModal = ({ invoice, onClose, onSuccess }) => {
    const { selectedProject } = useApp();
    const [method, setMethod] = useState(null); // 'card' | 'promptpay'
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('select'); // select, processing, qr_display, success, error
    const [qrUrl, setQrUrl] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [chargeId, setChargeId] = useState(null);
    const [pollHandle, setPollHandle] = useState(null);

    // Load Omise.js
    useEffect(() => {
        if (!window.Omise) {
            const script = document.createElement('script');
            script.src = 'https://cdn.omise.co/omise.js';
            script.onload = () => {
                window.Omise.setPublicKey('pkey_test_66alsi13fe219qkxfun');
            };
            document.head.appendChild(script);
        } else {
            window.Omise.setPublicKey('pkey_test_66alsi13fe219qkxfun');
        }
    }, []);

    const handlePromptPay = async () => {
        setLoading(true);
        setStep('processing');
        try {
            const res = await fetch('/api/billing/pay/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: selectedProject,
                    invoice_id: invoice.id,
                    amount: invoice.amount,
                    type: 'promptpay'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Payment Init Failed');

            setQrUrl(data.qr_uri);
            setChargeId(data.omise_id || null);
            setStep('qr_display');

            // Poll for completion (Simple version)
            // Ideally use WebSocket or Server-Sent Events
            try {
                const h = setInterval(async () => {
                    try {
                        const r = await fetch(`/api/billing/invoices?project_id=${encodeURIComponent(selectedProject)}`);
                        if (r.ok) {
                            const arr = await r.json();
                            const me = Array.isArray(arr) ? arr.find(x => Number(x.id) === Number(invoice.id)) : null;
                            if (me && String(me.status).toLowerCase() === 'paid') {
                                clearInterval(h);
                                setPollHandle(null);
                                setStep('success');
                                setTimeout(() => {
                                    onSuccess();
                                    onClose();
                                }, 1500);
                            }
                        }
                    } catch {}
                }, 3000);
                setPollHandle(h);
            } catch {}
        } catch (e) {
            setErrorMsg(e.message);
            setStep('error');
        } finally {
            setLoading(false);
        }
    };

    const handleCardPay = () => {
        // Omise Card.js flow
        setMethod('card');
        window.OmiseCard.configure({
            publicKey: 'pkey_test_66alsi13fe219qkxfun',
            currency: 'thb',
            frameLabel: 'EnergyLink Payment',
            submitLabel: 'PAY ' + invoice.amount.toFixed(2),
            onFormClosed: () => {
                // User closed popup
            }
        });

        window.OmiseCard.open({
            amount: Math.round(invoice.amount * 100),
            onCreateTokenSuccess: async (token) => {
                setLoading(true);
                setStep('processing');
                try {
                    const res = await fetch('/api/billing/pay/charge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_id: selectedProject,
                            invoice_id: invoice.id,
                            amount: invoice.amount,
                            type: 'credit_card',
                            token: token
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.detail || 'Card Payment Failed');

                    if (data.status === 'successful') {
                        setStep('success');
                        setTimeout(() => {
                            onSuccess();
                            onClose();
                        }, 2000);
                    } else if (data.authorize_uri) {
                        // 3DS Redirect
                        window.location.href = data.authorize_uri;
                    } else {
                        setStep('processing'); // Pending?
                    }

                } catch (e) {
                    setErrorMsg(e.message);
                    setStep('error');
                } finally {
                    setLoading(false);
                }
            },
            onFormClosed: () => {
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-yellow-600">PAYMENT</span>
                        <span className="text-slate-400">INV-{invoice.id}</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'select' && (
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <div className="text-sm text-slate-400 uppercase tracking-widest">Total Amount</div>
                                <div className="text-3xl font-bold text-slate-800 mt-1">
                                    ฿{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>

                            <button onClick={handlePromptPay} disabled={loading} className="w-full group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 hover:border-yellow-500 hover:shadow-md transition-all text-left">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                                        <QrCode size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-700 group-hover:text-yellow-600">PromptPay QR</div>
                                        <div className="text-xs text-slate-400">Scan via any Banking App</div>
                                    </div>
                                </div>
                            </button>

                            <button onClick={handleCardPay} disabled={loading} className="w-full group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 hover:border-yellow-500 hover:shadow-md transition-all text-left">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-50 p-3 rounded-lg text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700">
                                        <CreditCard size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-700 group-hover:text-yellow-600">Credit / Debit Card</div>
                                        <div className="text-xs text-slate-400">Visa, Mastercard, JCB</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-10">
                            <Loader size={48} className="animate-spin text-yellow-500 mx-auto mb-4" />
                            <div className="text-lg font-bold text-slate-800">Processing Payment...</div>
                            <div className="text-sm text-slate-400 mt-2">Please do not close this window</div>
                        </div>
                    )}

                    {step === 'qr_display' && (
                        <div className="text-center space-y-4">
                            <div className="bg-white p-4 rounded-xl inline-block shadow-lg border border-slate-200">
                                <img src={qrUrl} alt="PromptPay QR" className="w-64 h-64 object-contain" />
                            </div>
                            <div className="text-lg font-bold text-slate-800">
                                จำนวนเงินที่ต้องจ่าย: ฿{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-slate-500">
                                ใบแจ้งหนี้: INV-{invoice.id}{chargeId ? ` • Ref: ${chargeId}` : ''}
                            </div>
                            <div className="text-sm text-slate-400">
                                Scan this QR code within <span className="text-yellow-600 font-bold">10:00</span> minutes
                            </div>
                            <div className="text-xs text-slate-500">
                                The system will automatically detect promptpay payment.
                                <br />Refresh payment history if needed.
                            </div>
                            <button onClick={onClose} className="mt-4 px-6 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold border border-slate-200">
                                Close & Wait
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-10 animate-in zoom-in duration-300">
                            <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                            <div className="text-2xl font-bold text-slate-800">Payment Successful!</div>
                            <div className="text-slate-400 mt-2">Redirecting...</div>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="text-center py-6">
                            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                            <div className="text-xl font-bold text-slate-800">Payment Failed</div>
                            <div className="text-red-600 text-sm mt-2 px-4 py-2 bg-red-50 rounded border border-red-200">
                                {errorMsg}
                            </div>
                            <button onClick={() => setStep('select')} className="mt-6 px-6 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 font-bold shadow-lg shadow-slate-200">
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
