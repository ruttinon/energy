import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase, api } from 'services/api';
import { 
    CreditCard, 
    History, 
    CheckCircle2, 
    AlertCircle, 
    QrCode, 
    ChevronRight,
    Download,
    Receipt,
    Upload,
    Bell,
    X,
    Loader2,
    Shield,
    Zap,
    TrendingUp
} from 'lucide-react';

const MobileBilling = () => {
    const context = useApp();
    const dialog = useDialog();
    
    // Safety checks
    const { selectedProject, devices = [], readingsByDevice = {}, billingSummary = {}, t: tFn } = context || {};
    const { showAlert } = dialog || {};
    
    // Fallback translation function
    const t = tFn || ((k) => k);

    const [activeTab, setActiveTab] = useState('pay'); // pay, history
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tariffRate, setTariffRate] = useState(5.0); // Default matches admin default

    // Payment Flow
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [slip, setSlip] = useState(null);
    const [previewSlip, setPreviewSlip] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState(null);

    // Real-time Usage Calculation (Pulling from Real Data)
    const usageStats = useMemo(() => {
        const summaryKwh = billingSummary?.month_units != null ? Number(billingSummary.month_units) : null;
        const summaryCost = billingSummary?.month_money != null ? Number(billingSummary.month_money) : null;

        if (summaryKwh != null || summaryCost != null) {
            const kwh = Number.isFinite(summaryKwh) ? summaryKwh : 0;
            const cost = Number.isFinite(summaryCost) ? summaryCost : (kwh * tariffRate);
            return { kwh, cost, tariff: tariffRate };
        }

        let totalKwh = 0;
        if (Array.isArray(devices)) {
            devices.forEach(d => {
                const latest = readingsByDevice[String(d.id)] || {};
                // Priority: ActiveEnergy_kWh -> TotalEnergy_kWh -> ActiveEnergy_Import
                const val = Number(latest.ActiveEnergy_kWh) || Number(latest.TotalEnergy_kWh) || Number(latest.ActiveEnergy_Import) || 0;
                totalKwh += val;
            });
        }

        const estimatedCost = totalKwh * tariffRate;
        return { kwh: totalKwh, cost: estimatedCost, tariff: tariffRate };
    }, [devices, readingsByDevice, billingSummary, tariffRate]);

    useEffect(() => {
        fetchData();
        // Poll for updates (real backend sync)
        const interval = setInterval(fetchPayments, 10000);
        return () => clearInterval(interval);
    }, [selectedProject]);

    const fetchPayments = async () => {
        if (!selectedProject) return;
        try {
             const res = await api.billing.getPayments(selectedProject);
             if (res && (Array.isArray(res) || Array.isArray(res.data))) {
                 setPayments(Array.isArray(res) ? res : res.data);
             }
        } catch (e) {
            console.error("Fetch payments failed", e);
        }
    };

    const fetchData = async () => {
        if (!selectedProject) return;
        setLoading(true);
        try {
            const API = getApiBase();
            
            // Fetch Tariff Config
            try {
                const config = await api.billing.getConfig(selectedProject);
                if (config && config.price_per_unit) {
                    setTariffRate(Number(config.price_per_unit));
                }
            } catch (e) {
                console.warn("Using default tariff", e);
            }

            // Fetch Invoices
            try {
                const invRes = await fetch(`${API}/billing/invoices?project_id=${selectedProject}`);
                if (invRes.ok) {
                    const data = await invRes.json();
                    setInvoices(Array.isArray(data) ? data : (data.data || []));
                }
            } catch (e) { console.error("Fetch invoices failed", e); }

            // Fetch Payment History
            await fetchPayments();

        } catch (err) {
            console.error("Failed to fetch billing data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectInvoice = (inv) => {
        setSelectedInvoice(inv);
        setSlip(null);
        setPreviewSlip(null);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSlip(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewSlip(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitPayment = async () => {
        if (!selectedInvoice || !slip) return;
        setIsSubmitting(true);

        try {
            // Create Payment Object
            const payload = {
                invoice_number: selectedInvoice.invoice_number,
                invoice_id: selectedInvoice.id,
                amount: selectedInvoice.amount,
                slip: previewSlip, // Base64 string
                project_id: selectedProject
            };

            const res = await api.billing.submitPayment(payload);
            if (!res) throw new Error("Payment submission failed");
            
            // Notify Admin
            try {
                await api.notifications.create({
                    project_id: selectedProject,
                    title: 'New Payment Submitted',
                    message: `Payment slip uploaded for Invoice ${selectedInvoice.invoice_number}`,
                    type: 'info'
                });
            } catch (e) { console.warn("Failed to send notification", e); }

            // Show Notification
            showNotification('success', 'Payment submitted! Sent to admin for verification.');
            
            // Refresh data
            fetchPayments();
            
            // Reset
            setSelectedInvoice(null);
            setSlip(null);
            setPreviewSlip(null);
            setActiveTab('history');

        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to submit payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const showNotification = (type, msg) => {
        setNotification({ type, message: msg });
        setTimeout(() => setNotification(null), 5000);
    };

    // --- UI Components ---
    const GlassCard = ({ children, className = "", onClick }) => (
        <div 
            onClick={onClick}
            className={`relative bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] p-5 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(234,179,8,0.15)] transition-all duration-500 group ${className}`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-yellow-50/20 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-yellow-400/10 to-amber-300/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10">{children}</div>
        </div>
    );

    const StatusBadge = ({ status }) => {
        const config = {
            paid: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50', icon: CheckCircle2, label: t('verified') },
            pending: { color: 'bg-amber-500/10 text-amber-600 border-amber-200/50', icon: Loader2, label: t('reviewing') },
            unpaid: { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: AlertCircle, label: t('due_short') },
            rejected: { color: 'bg-red-500/10 text-red-600 border-red-200/50', icon: X, label: t('rejected') }
        };
        const curr = config[status?.toLowerCase()] || config.unpaid;
        const Icon = curr.icon;

        return (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${curr.color} backdrop-blur-sm`}>
                <Icon size={10} className={status === 'pending' ? 'animate-spin' : ''} />
                <span className="text-[9px] font-bold tracking-wider uppercase">{curr.label}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full gap-6 p-4 pb-32 relative overflow-visible font-rajdhani">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-yellow-200/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl shadow-xl backdrop-blur-xl border flex items-center gap-3 animate-in slide-in-from-top-4 ${
                    notification.type === 'success' 
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' 
                    : 'bg-red-50/90 border-red-200 text-red-700'
                }`}>
                    {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <span className="font-bold text-sm">{notification.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {t('billing_center')}
                    </h1>
                    <p className="text-slate-500 text-xs font-medium tracking-wide flex items-center gap-1">
                         <Shield size={10} className="text-yellow-500" /> {t('secure_payment_gateway')}
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md border border-white/60 flex items-center justify-center shadow-sm text-yellow-600">
                     <CreditCard size={20} />
                </div>
            </div>

            {/* Current Usage Card */}
            <GlassCard className="!bg-slate-900 !border-slate-800 text-white shadow-xl shadow-slate-900/20 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md">
                            <Zap size={16} className="text-yellow-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-300 uppercase tracking-widest">{t('current_cycle')}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm animate-pulse">
                        {t('live_tracking')}
                    </span>
                </div>

                <div className="flex items-end gap-1 mb-2 relative z-10">
                    <span className="text-4xl font-bold font-rajdhani text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                        ฿{usageStats.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <p className="text-slate-400 text-xs mb-6 relative z-10">
                    {t('estimated_cost_based_on')} {usageStats.kwh.toFixed(1)} kWh
                </p>

                <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                        <div className="text-xs text-slate-400 mb-1">{t('tariff_rate')}</div>
                        <div className="text-lg font-bold text-white">฿{usageStats.tariff} <span className="text-xs font-normal text-slate-500">/kWh</span></div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                        <div className="text-xs text-slate-400 mb-1">{t('projected')}</div>
                        <div className="text-lg font-bold text-yellow-400">฿{(usageStats.cost * 1.2).toFixed(0)}</div>
                    </div>
                </div>
            </GlassCard>

            {/* Tabs */}
            <div className="flex p-1 rounded-xl bg-slate-100/50 backdrop-blur-sm border border-slate-200/50 relative">
                <button
                    onClick={() => setActiveTab('pay')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                        activeTab === 'pay' 
                        ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <QrCode size={16} />
                    {t('pay_now')}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                        activeTab === 'history' 
                        ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <History size={16} />
                    {t('history')}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-[300px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                        <Loader2 size={32} className="animate-spin text-yellow-500" />
                        <span className="text-xs font-medium tracking-widest uppercase">{t('loading_billing_data')}</span>
                    </div>
                ) : activeTab === 'pay' ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('outstanding_invoices')}</h3>
                        
                        {invoices.filter(i => i.status === 'unpaid').length === 0 ? (
                            <div className="text-center py-10 px-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/50">
                                <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                                <p className="text-slate-500 font-medium">{t('all_caught_up')}</p>
                                <p className="text-slate-400 text-xs mt-1">{t('no_pending_invoices')}</p>
                            </div>
                        ) : (
                            invoices.filter(i => i.status === 'unpaid').map(inv => (
                                <GlassCard key={inv.id} className={selectedInvoice?.id === inv.id ? 'border-yellow-400/50 ring-2 ring-yellow-400/20' : ''}>
                                    <div 
                                        onClick={() => handleSelectInvoice(inv)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">{inv.invoice_number}</div>
                                                <div className="text-xl font-bold text-slate-800">฿{Number(inv.amount).toLocaleString()}</div>
                                                <div className="text-xs text-slate-500 mt-1">{t('due')}: {new Date(inv.due_date).toLocaleDateString()}</div>
                                            </div>
                                            <StatusBadge status={inv.status} />
                                        </div>
                                    </div>
                                    
                                    {selectedInvoice?.id === inv.id && (
                                        <div className="mt-4 pt-4 border-t border-slate-100/50 animate-in slide-in-from-top-2">
                                            {!previewSlip ? (
                                                <div className="space-y-4">
                                                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-inner flex flex-col items-center gap-3">
                                                        <QRCodeCanvas 
                                                            value={`00020101011129370016A00000067701011101130066${'0812345678'}5303764540${Number(inv.amount).toFixed(2).replace('.','')}5802TH6304`}
                                                            size={160}
                                                            level={"M"}
                                                            imageSettings={{
                                                                src: "https://upload.wikimedia.org/wikipedia/commons/c/c5/PromptPay-logo.png",
                                                                height: 24,
                                                                width: 24,
                                                                excavate: true,
                                                            }}
                                                        />
                                                        <p className="text-[10px] text-slate-400 text-center max-w-[200px]">{t('scan_to_pay_promptpay')}</p>
                                                    </div>
                                                    
                                                    <div className="relative">
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={handleFileChange}
                                                            className="hidden" 
                                                            id={`slip-upload-${inv.id}`}
                                                        />
                                                        <label 
                                                            htmlFor={`slip-upload-${inv.id}`}
                                                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200"
                                                        >
                                                            <Upload size={16} />
                                                            {t('upload_payment_slip')}
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                                        <img src={previewSlip} alt="Slip Preview" className="w-full h-48 object-cover" />
                                                        <button 
                                                            onClick={() => { setSlip(null); setPreviewSlip(null); }}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                    <button 
                                                        onClick={handleSubmitPayment}
                                                        disabled={isSubmitting}
                                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                        {t('confirm_payment')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {selectedInvoice?.id !== inv.id && (
                                        <button 
                                            onClick={() => handleSelectInvoice(inv)}
                                            className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold shadow-md hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {t('select_to_pay')} <ChevronRight size={16} />
                                        </button>
                                    )}
                                </GlassCard>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('payment_history')}</h3>
                        {payments.length === 0 ? (
                             <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                                <History size={40} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">{t('no_payment_history')}</p>
                            </div>
                        ) : (
                            payments.map((pay, idx) => (
                                <GlassCard key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            pay.status === 'verified' || pay.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                        }`}>
                                            {pay.status === 'verified' || pay.status === 'paid' ? <CheckCircle2 size={18} /> : <Loader2 size={18} className={pay.status === 'pending' ? 'animate-spin' : ''} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">฿{Number(pay.amount).toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{new Date(pay.created_at || pay.payment_date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <StatusBadge status={pay.status === 'verified' ? 'paid' : pay.status} />
                                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{pay.invoice_number}</div>
                                    </div>
                                </GlassCard>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileBilling;