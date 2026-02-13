import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase, api } from 'services/api';
import {
    CreditCard,
    Table,
    FileSpreadsheet,
    Percent,
    Save,
    RefreshCw,
    Info,
    ChevronRight,
    Calculator,
    GanttChart,
    Settings
} from 'lucide-react';

import PendingTransactions from './PendingTransactions';

const BillingSettings = () => {
    const { selectedProject } = useApp();
    const { showConfirm, showAlert } = useDialog();
    const [tariff, setTariff] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!selectedProject) return;
        setLoading(true);
        try {
            // Try fetching existing config
            const data = await api.billing.getConfig(selectedProject);
            if (data && data.price_per_unit) {
                setTariff(data);
            } else {
                // Fallback to defaults if no config found
                setTariff(prev => prev || { price_per_unit: 5.0, currency: 'THB', vat_rate: 7.0, ft_rate: 0.0, billing_day: 25, cutoff_day: 20 });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!selectedProject || !tariff) return;
        try {
            const payload = { ...tariff, project_id: selectedProject };
            const res = await api.billing.saveConfig(payload);
            if (res) showAlert("Success", "Configuration saved successfully!");
            else showAlert("Error", "Failed to save configuration");
        } catch (e) {
            console.error(e);
            showAlert("Error", "Error saving configuration");
        }
    };

    const handleGenerateInvoices = async () => {
        if (!selectedProject) return;
        const confirmed = await showConfirm(
            "Generate Invoices",
            "Generate invoices for current month? This will create draft invoices for all active devices."
        );
        if (!confirmed) return;

        try {
            const API = getApiBase();
            const res = await fetch(`${API}/billing/invoices/generate?project_id=${selectedProject}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                showAlert("Success", `Generated ${data.length || 0} invoices successfully.`);
            } else {
                showAlert("Error", "Failed to generate invoices.");
            }
        } catch (e) {
            console.error(e);
            showAlert("Error", "Error generating invoices");
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedProject]);

    return (
        <div className="flex flex-col gap-6 h-full pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-orbitron text-yellow-600 tracking-tighter italic">Fiscal Engine</h1>
                    <p className="text-[10px] md:text-sm text-slate-500 font-rajdhani uppercase tracking-[0.2em] md:tracking-[0.4em] mt-1 opacity-80">Revenue Modeling & Tariff Configuration Matrix</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={fetchData} className="p-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-800 shadow-sm hover:shadow-md transition-all">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={handleSaveConfig} className="flex-1 md:flex-none justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold font-rajdhani uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-yellow-500/30 flex items-center gap-2">
                        <Save size={16} /> <span className="md:inline">Save Config</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Left: Tariff Matrix */}
                <div className="flex flex-col gap-6">
                    <div className="glass-card flex flex-col p-6 bg-white border border-slate-200 shadow-sm rounded-2xl">
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Percent size={14} /> Global Tariff Matrix</span>

                            {/* Billing Notification */}
                            {tariff?.billing_day && new Date().getDate() === tariff.billing_day && (
                                <div className="px-3 py-1 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-2 animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Bill Due Today</span>
                                </div>
                            )}
                        </h3>

                        <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide pr-2">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Base Energy Rate (THB/kWh)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={tariff?.price_per_unit ?? ''}
                                                onChange={(e) => setTariff(prev => ({ ...prev, price_per_unit: parseFloat(e.target.value) }))}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-lg font-orbitron text-slate-800 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                                            />
                                            <Calculator className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">FT Variable Rate</label>
                                        <input
                                            type="number"
                                            value={tariff?.ft_rate ?? 0.0}
                                            onChange={(e) => setTariff(prev => ({ ...prev, ft_rate: parseFloat(e.target.value) }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-lg font-orbitron text-slate-800 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">VAT Rate (%)</label>
                                        <input
                                            type="number"
                                            value={tariff?.vat_rate ?? 7.0}
                                            onChange={(e) => setTariff(prev => ({ ...prev, vat_rate: parseFloat(e.target.value) }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-lg font-orbitron text-slate-800 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Billing Day</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1" max="31"
                                                    value={tariff?.billing_day ?? 25}
                                                    onChange={(e) => setTariff(prev => ({ ...prev, billing_day: parseInt(e.target.value) }))}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-orbitron text-yellow-600 outline-none focus:border-yellow-500 transition-all"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Day</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Cut-off Day</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1" max="31"
                                                    value={tariff?.cutoff_day ?? 20}
                                                    onChange={(e) => setTariff(prev => ({ ...prev, cutoff_day: parseInt(e.target.value) }))}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-orbitron text-cyan-600 outline-none focus:border-cyan-500 transition-all"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Day</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">TOU (Time Of Use) Logic</label>
                                    <div className={`w-10 h-5 rounded-full bg-emerald-100 p-1 flex justify-end`}>
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex justify-between p-3 border border-slate-200 rounded bg-white">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">On-Peak Rate</span>
                                        <span className="text-xs text-slate-800 font-mono">5.2674</span>
                                    </div>
                                    <div className="flex justify-between p-3 border border-slate-200 rounded bg-white">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Off-Peak Rate</span>
                                        <span className="text-xs text-slate-800 font-mono">2.6295</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Automation & Templates */}
                <div className="flex flex-col gap-8">
                    <div className="glass-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-4">Operations</h3>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={handleGenerateInvoices}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-bold font-orbitron uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg"
                            >
                                <CreditCard size={20} className="text-cyan-400" />
                                Generate Monthly Invoices
                            </button>
                            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                <div className="text-xs font-bold text-yellow-700 uppercase tracking-wider">EndOfMonth (EOM) Sync</div>
                                <div className="text-[9px] text-slate-500 uppercase font-mono mt-1">NEXT RUN: 2026-01-31 00:00:01</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-gradient-to-br from-yellow-50 to-white rounded-2xl border border-yellow-100 p-6 relative overflow-hidden">
                        <CreditCard size={120} className="absolute -right-8 -bottom-8 opacity-[0.05] text-yellow-600" />
                        <h4 className="text-[10px] font-bold text-yellow-600 uppercase tracking-[0.2em] mb-2">Security Note</h4>
                        <p className="text-[11px] text-slate-500 font-rajdhani uppercase leading-relaxed max-w-[80%]">
                            Transactional records are immutable once synchronized with the fiscal core. Adjustments must be processed via credit notes.
                        </p>
                    </div>

                    <div className="glass-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h3 className="text-xs font-bold font-orbitron text-yellow-600 uppercase tracking-widest mb-4">Pending Transactions (Manual Confirm)</h3>
                        <PendingTransactions projectId={selectedProject} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingSettings;
