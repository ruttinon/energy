import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import {
    CreditCard,
    RefreshCw,
    QrCode,
    Smartphone,
    History,
    Building2,
    CheckCircle2,
    AlertCircle,
    Receipt,
    Clock,
    FileText
} from 'lucide-react';
import PaymentModal from '../../../../components/Admin/Modules/Billing/PaymentModal.jsx';

const BillingModule = () => {
    const { selectedProject } = useApp();
    const [summary, setSummary] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [pendingSlip, setPendingSlip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [qrType, setQrType] = useState('promptpay');
    const [qrPayload, setQrPayload] = useState('');

    const fetchAll = async () => {
        if (!selectedProject) return;
        setIsLoading(true);
        try {
            // Fetch Summary (Usage Stats)
            const sumRes = await fetch(`/api/billing/summary?project_id=${selectedProject}`);
            if (sumRes.ok) setSummary((await sumRes.json()).data);

            // Fetch Invoices (New API)
            const invRes = await fetch(`/api/billing/invoices?project_id=${selectedProject}`);
            if (invRes.ok) setInvoices(await invRes.json() || []);

            // Fetch Payments
            const payRes = await fetch(`/api/billing/payments?project_id=${selectedProject}`);
            if (payRes.ok) setPayments((await payRes.json()).data || []);

        } catch (err) {
            console.error('Failed to fetch billing data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [selectedProject]);

    const fmtCurrency = (v) => {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(v || 0);
    };

    const generatePromptPayPayload = (amount) => {
        // Simplified Logic or Payload Generator for Demo
        return `PROMPTPAY|${amount}|DEMO-${Date.now()}`;
    };

    useEffect(() => {
        if (selectedInvoice) {
            if (qrType === 'promptpay') {
                setQrPayload(generatePromptPayPayload(selectedInvoice.amount));
            } else {
                setQrPayload(JSON.stringify({
                    id: selectedInvoice.id,
                    amount: selectedInvoice.amount,
                    ts: Date.now()
                }));
            }
        }
    }, [selectedInvoice, qrType]);

    const handleRecordPayment = async () => {
        if (!selectedInvoice) return;
        if (!pendingSlip) {
            showAlert?.('Required', 'กรุณาอัปโหลดสลิป', { type: 'warning' });
            return;
        }

        const confirmed = await (showConfirm 
            ? showConfirm('Confirm Payment', `Confirm payment of ${fmtCurrency(selectedInvoice.amount)}?`)
            : Promise.resolve(window.confirm(`Confirm payment of ${fmtCurrency(selectedInvoice.amount)}?`)));
        
        if (!confirmed) return;

        setIsLoading(true);
        try {
            // mock: เพิ่ม payment pending
            setPayments([{
                id: 'pending',
                amount: selectedInvoice.amount,
                date: new Date().toISOString().slice(0,10),
                method: qrType,
                status: 'pending',
                slip: pendingSlip
            }, ...payments]);
            setPendingSlip(null);
            setSelectedInvoice(null);
            setShowPaymentModal(false); // Close modal after success
            
            showAlert?.('Success', 'แจ้งชำระเงินแล้ว รอตรวจสอบ', { type: 'success' });
        } catch (err) {
            console.error(err);
            showAlert?.('Error', 'Transaction error', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const handlePayClick = (inv) => {
        setSelectedInvoice(inv);
        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = () => {
        fetchAll();
        showAlert?.({
            title: 'Success',
            message: 'Payment Completed Successfully!',
            type: 'success'
        });
    };

    // Filter Invoices
    const dueInvoices = useMemo(() => invoices.filter(i => i.status === 'due'), [invoices]);
    const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'paid'), [invoices]);

    return (
        <div className="flex flex-col h-full gap-6 relative">
            {showPaymentModal && selectedInvoice && (
                <div className="absolute inset-0 z-50">
                    <div className="bg-white p-8 rounded-xl shadow-xl max-w-md mx-auto mt-20">
                        <h3 className="text-lg font-bold mb-4">แจ้งชำระเงิน</h3>
                        <div className="mb-2">จำนวนเงิน: <strong>{selectedInvoice.amount} บาท</strong></div>
                        <input type="file" accept="image/*" onChange={e => setPendingSlip(URL.createObjectURL(e.target.files[0]))} required />
                        <button onClick={handleRecordPayment} className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded">แจ้งชำระเงิน</button>
                        <button onClick={() => setShowPaymentModal(false)} className="mt-2 px-4 py-2 bg-slate-300 text-black rounded">ยกเลิก</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron text-white">Billing & Payments</h2>
                    <p className="text-sm text-slate-400 font-rajdhani uppercase tracking-widest opacity-60">My Invoices & Payment History</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchAll}
                        className="px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Refresh</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Unpaid Due', value: fmtCurrency(dueInvoices.reduce((a, b) => a + b.amount, 0)), hint: `${dueInvoices.length} Invoices`, color: 'text-amber-500' },
                    { label: 'Current Usage', value: `${(summary?.month_units ?? 0).toFixed(2)} kWh`, hint: 'This Month', color: 'text-white' },
                    { label: 'Est. Cost', value: fmtCurrency(summary?.month_money || 0), hint: 'Accrued', color: 'text-cyan-400' },
                    { label: 'Total Paid', value: fmtCurrency(paidInvoices.reduce((a, b) => a + b.amount, 0)), hint: 'Lifetime', color: 'text-emerald-500' },
                ].map((kpi, i) => (
                    <div key={i} className="kpi-card p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">{kpi.label}</div>
                        <div className={`text-2xl font-bold font-orbitron ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-600 mt-1 uppercase tracking-tighter">{kpi.hint}</div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">

                {/* Invoice List (Full Width since we removed right panel) */}
                <div className="flex flex-col gap-6 h-full">
                    <div className="kpi-card flex flex-col flex-1">
                        <div className="p-6 border-b border-white/5 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold font-orbitron uppercase text-slate-300">Pending Invoices</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {dueInvoices.length === 0 ? (
                                <div className="p-10 text-center text-slate-600 italic">No pending invoices. You are all paid up!</div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-slate-900 z-10 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                                        <tr>
                                            <th className="p-4 pl-6">Invoice #</th>
                                            <th className="p-4">Billing Month</th>
                                            <th className="p-4">Target</th>
                                            <th className="p-4">Amount</th>
                                            <th className="p-4 pr-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {dueInvoices.map(inv => (
                                            <tr key={inv.id} className="hover:bg-slate-800/20 group">
                                                <td className="p-4 pl-6 font-mono text-slate-400 text-xs">{inv.invoice_number}</td>
                                                <td className="p-4 text-white font-bold">{inv.billing_month}</td>
                                                <td className="p-4 text-slate-300 text-xs">{inv.target_name}</td>
                                                <td className="p-4 text-amber-400 font-bold font-orbitron">{fmtCurrency(inv.amount)}</td>
                                                <td className="p-4 pr-6 text-right">
                                                    <button
                                                        onClick={() => handlePayClick(inv)}
                                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded font-bold text-[10px] uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
                                                    >
                                                        Pay Now
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Paid History */}
                    <div className="kpi-card flex flex-col h-[300px]">
                        <div className="p-6 border-b border-white/5 flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold font-orbitron uppercase text-slate-300">Payment History (Latest 10)</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                            {payments.length === 0 ? (
                                <div className="text-center py-10 text-slate-600 italic text-sm">No payment history found.</div>
                            ) : (
                                payments.slice(0, 10).map((pay, i) => (
                                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${pay.status === 'pending' ? 'bg-yellow-50 border-yellow-500/50' : 'bg-slate-900/50 border-white/5'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${pay.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                {pay.status === 'pending' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white max-w-[200px] truncate">{pay.method}</div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{pay.date}</div>
                                                {pay.status === 'pending' && <div className="text-yellow-600 text-xs font-bold">รอตรวจสอบ</div>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-md font-bold font-orbitron text-emerald-400">{fmtCurrency(pay.amount)}</div>
                                            {pay.slip && <img src={pay.slip} alt="slip" className="w-12 h-12 rounded-lg object-cover mt-1" />}
                                            <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-600">{pay.status === 'pending' ? 'PENDING' : 'PAID'}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BillingModule;
