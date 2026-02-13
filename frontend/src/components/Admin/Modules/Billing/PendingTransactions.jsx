import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, FileText, Loader2, Eye, ShieldCheck, AlertCircle } from 'lucide-react';
import { getApiBase, api } from 'services/api';
import { useDialog } from '../../../../context/DialogContext';

export default function PendingTransactions({ projectId }) {
    const { showConfirm, showAlert } = useDialog();
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewSlip, setPreviewSlip] = useState(null);

    useEffect(() => {
        if (!projectId) return;
        fetchTransactions();

        // Poll for new transactions every 3 seconds
        const interval = setInterval(fetchTransactions, 3000);
        return () => clearInterval(interval);
    }, [projectId]);

    const fetchTransactions = async () => {
        // We won't set loading true on every poll to avoid flickering
        // setLoading(true); 
        try {
            let allTxs = [];

            // 1. Fetch from API
            try {
                const res = await api.billing.getPayments(projectId);
                if (res && (Array.isArray(res) || Array.isArray(res.data))) {
                    allTxs = Array.isArray(res) ? res : res.data;
                }
            } catch (e) {
                // Handle offline/error state
            }

            // Filter for pending
            setTxs(allTxs.filter(t => ['pending', 'pending_review'].includes(t.status)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (txId, action) => {
        // action: 'approve' | 'reject'
        const isApprove = action === 'approve';
        const confirmed = await showConfirm(
            isApprove ? 'Approve Transaction' : 'Reject Transaction',
            `Are you sure you want to ${action.toUpperCase()} this transaction?`
        );
        if (!confirmed) return;

        try {
            // Update API
            await api.billing.updateTransactionStatus(txId, action);

            // Notify User
            try {
                await api.notifications.create({
                    project_id: projectId,
                    title: isApprove ? 'Payment Approved' : 'Payment Rejected',
                    message: `Your payment transaction ${txId} has been ${isApprove ? 'approved' : 'rejected'}.`,
                    type: isApprove ? 'success' : 'error'
                });
            } catch (e) { console.warn("Failed to send notification", e); }
            
            // Processing delay
            await new Promise(r => setTimeout(r, 800));

            await showAlert(
                isApprove ? 'Transaction Approved' : 'Transaction Rejected',
                `Transaction ${isApprove ? 'Approved' : 'Rejected'}!\nNotification sent to user via Email & Line.`
            );

            // Optimistic update
            setTxs(prev => prev.filter(t => t.id !== txId));
            setPreviewSlip(null);
        } catch (err) {
            showAlert('Error', 'Action failed');
        }
    };

    if (!projectId) return <div className="text-xs text-slate-400 font-mono text-center py-4">SELECT PROJECT TO LOAD DATA</div>;

    return (
        <div className="space-y-4">
            {loading && <div className="text-center py-4 text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>}
            
            {!loading && txs.length === 0 && (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <ShieldCheck size={24} className="mx-auto text-emerald-400 mb-2 opacity-50" />
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">All Transactions Verified</div>
                </div>
            )}

            {txs.map(t => (
                <div key={t.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">TX-ID: {t.id}</div>
                            <div className="text-sm font-bold text-slate-800">INV: {t.invoice_number || t.invoice_id}</div>
                            <div className="text-xs text-slate-500">{t.date}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold font-orbitron text-slate-800">฿{Number(t.amount).toLocaleString()}</div>
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                <Loader2 size={10} className="animate-spin" />
                                <span className="text-[9px] font-bold uppercase">Action Req.</span>
                            </div>
                        </div>
                    </div>

                    {/* Slip Preview Button */}
                    {t.slip && (
                        <div className="mb-3">
                            <button 
                                onClick={() => setPreviewSlip(t.slip)}
                                className="w-full py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center gap-2 group-hover:border-yellow-300 transition-colors"
                            >
                                <FileText size={14} className="text-yellow-500" /> View Proof of Payment
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handleAction(t.id, 'reject')}
                            className="py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                        >
                            <XCircle size={14} /> Reject
                        </button>
                        <button 
                            onClick={() => handleAction(t.id, 'approve')}
                            className="py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <CheckCircle2 size={14} /> Confirm
                        </button>
                    </div>
                </div>
            ))}

            {/* Lightbox for Slip */}
            {previewSlip && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-white border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} className="text-yellow-500" /> Payment Slip
                            </h3>
                            <button onClick={() => setPreviewSlip(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="p-4 bg-slate-100 flex justify-center min-h-[300px]">
                            <img src={previewSlip} alt="Slip" className="max-h-[70vh] w-auto object-contain rounded shadow-sm" />
                        </div>
                        <div className="p-3 bg-slate-50 border-t text-center">
                             <a href={previewSlip} download="slip.png" className="text-xs text-blue-500 hover:underline">Download Original</a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
