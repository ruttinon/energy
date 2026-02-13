import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import {
    ShieldAlert,
    Bell,
    Settings,
    Plus,
    Trash2,
    Mail,
    MessageSquare,
    Clock,
    ChevronDown,
    Info,
    Activity,
    Zap,
    Power,
    Filter,
    Search,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';

const AlertConfiguration = () => {
    const { selectedProject } = useApp();
    const { showConfirm, showAlert } = useDialog();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, CRITICAL, WARNING, INFO

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [newRuleData, setNewRuleData] = useState({
        name: "",
        metric: "Voltage_L1",
        operator: ">",
        threshold: 0,
        severity: "warning",
        message: "",
        enabled: true
    });

    const [availableMetrics, setAvailableMetrics] = useState([]);

    useEffect(() => {
        const fetchParams = async () => {
            try {
                const res = await fetch('/api/alert/parameters');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setAvailableMetrics(data);
                        // Set default if current metric not in list
                        if (data.length > 0 && !data.find(d => d.key === newRuleData.metric)) {
                            setNewRuleData(prev => ({ ...prev, metric: data[0].key }));
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load parameters", e);
            }
        };
        if (isModalOpen) fetchParams();
    }, [isModalOpen]);

    const fetchRules = async () => {
        if (!selectedProject) return;
        try {
            const res = await fetch(`/api/alert/rules?project_id=${selectedProject}`);
            const data = await res.json();
            setRules(Array.isArray(data) ? data : data.rules || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (ruleToEdit = null) => {
        if (ruleToEdit) {
            setEditingRuleId(ruleToEdit.id);
            setNewRuleData({
                name: ruleToEdit.rule_name || ruleToEdit.name || "",
                metric: ruleToEdit.metric || "Voltage_L1",
                operator: ruleToEdit.operator || ">",
                threshold: ruleToEdit.threshold || 0,
                severity: ruleToEdit.severity || "warning",
                message: ruleToEdit.message || "",
                delay: ruleToEdit.delay || 0,
                enabled: ruleToEdit.is_active ?? true
            });
        } else {
            setEditingRuleId(null);
            setNewRuleData({
                name: "New Security Protocol",
                metric: "Voltage_L1",
                operator: ">",
                threshold: 240,
                severity: "warning",
                message: "Threshold violation detected",
                delay: 5,
                enabled: true
            });
        }
        setIsModalOpen(true);
    };

    const submitNewRule = async () => {
        if (!selectedProject) return;

        const payload = {
            rule_name: newRuleData.name,
            metric: newRuleData.metric,
            operator: newRuleData.operator,
            threshold: parseFloat(newRuleData.threshold),
            severity: newRuleData.severity,
            message: newRuleData.message,
            delay: parseInt(newRuleData.delay),
            is_active: true
        };

        try {
            let res;
            if (editingRuleId) {
                res = await fetch(`/api/alert/rules/update/${editingRuleId}?project_id=${selectedProject}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`/api/alert/rules/add?project_id=${selectedProject}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (res.ok) {
                await fetchRules();
                setIsModalOpen(false);
            } else {
                showAlert("Error", "Operation failed");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleRule = async (ruleId, currentStatus) => {
        if (!selectedProject) return;
        try {
            const newStatus = !currentStatus;
            const payload = {
                is_active: newStatus,
                enabled: newStatus
            };

            const res = await fetch(`/api/alert/rules/update/${ruleId}?project_id=${selectedProject}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchRules();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!selectedProject) return;
        const confirmed = await showConfirm("Delete Rule", "Delete this rule?");
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/alert/rules/delete/${ruleId}?project_id=${selectedProject}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchRules();
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchRules();
    }, [selectedProject]);

    const filteredRules = useMemo(() => {
        if (filter === 'ALL') return rules;
        return rules.filter(r => (r.severity || 'info').toUpperCase() === filter);
    }, [rules, filter]);

    const severityColors = {
        CRITICAL: 'bg-red-50 text-red-700 border-red-200',
        WARNING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        INFO: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    };

    return (
        <div className="flex flex-col gap-8 h-full relative p-2">

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                    <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-lg border border-slate-200">
                        {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${filter === f
                                    ? 'bg-yellow-500 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="h-6 w-px bg-slate-200 mx-2" />
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        <Filter size={12} />
                        {filteredRules.length} Rules Found
                    </div>
                </div>

                <button
                    onClick={() => handleOpenModal(null)}
                    className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold font-rajdhani uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 group"
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" /> New Security Protocol
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Rules List */}
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto scrollbar-hide pr-2 pb-20">
                    {filteredRules.length === 0 && !loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60 py-20 border-2 border-dashed border-slate-200 rounded-2xl">
                            <ShieldAlert size={64} className="mb-4" />
                            <p className="font-orbitron text-sm uppercase text-slate-500">No Protocols Found</p>
                            <p className="text-[10px] uppercase font-bold tracking-widest mt-1">Adjust filters or initialize new rules</p>
                        </div>
                    ) : (
                        filteredRules.map(rule => {
                            const isActive = rule.is_active ?? rule.enabled;
                            return (
                                <div key={rule.id} className={`bg-white border border-slate-200 rounded-xl p-0 flex flex-col md:flex-row hover:border-yellow-500/50 transition-all group relative overflow-hidden shadow-sm hover:shadow-md ${!isActive ? 'opacity-60 grayscale-[0.8]' : ''}`}>
                                    {/* Active Indicator Strip */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${isActive ? 'bg-yellow-500' : 'bg-slate-300'}`} />

                                    <div className="flex-1 p-5 pl-7">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-widest border ${severityColors[(rule.severity || 'INFO').toUpperCase()] || severityColors.INFO}`}>
                                                    {rule.severity || 'INFO'}
                                                </span>
                                                <h3 className="text-sm font-bold font-orbitron text-slate-800 uppercase tracking-wider">{rule.rule_name || rule.name || 'UNNAMED RULE'}</h3>
                                            </div>
                                            {isActive && (
                                                <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold uppercase tracking-widest animate-pulse">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    Active
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Target Metric</span>
                                                <span className="text-xs font-mono text-yellow-600 font-bold">{rule.metric || rule.parameter}</span>
                                            </div>
                                            <div className="text-slate-400 font-black text-lg">{rule.operator}</div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Threshold</span>
                                                <span className="text-xs font-mono text-slate-800 font-bold">{rule.threshold || rule.val_threshold}</span>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200 mx-2" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Sustain</span>
                                                <span className="text-xs font-mono text-slate-600 font-bold">{rule.delay || 0}s</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 mt-3 pl-1">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <Mail size={12} className="text-slate-400" />
                                                <span>Notify Admin</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <MessageSquare size={12} className="text-slate-400" />
                                                <span>Log Event</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Column */}
                                    <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-4 flex md:flex-col justify-center items-center gap-3 min-w-[100px]">
                                        <button
                                            onClick={() => handleToggleRule(rule.id, isActive)}
                                            className={`p-2 rounded-lg transition-all ${isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-200 text-slate-500 hover:text-slate-700'}`}
                                            title={isActive ? "Deactivate Rule" : "Activate Rule"}
                                        >
                                            <Power size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(rule)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-200 transition-all"
                                            title="Configure Rule"
                                        >
                                            <Settings size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                                            title="Delete Protocol"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Info Panel / Stats */}
                <div className="hidden lg:flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-yellow-600 -rotate-12 transform scale-150 pointer-events-none">
                            <ShieldAlert size={140} />
                        </div>
                        <h3 className="text-xs font-bold font-orbitron text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info size={14} className="text-yellow-500" /> Protocol Status
                        </h3>
                        <div className="space-y-4 relative z-10">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Rules</div>
                                <div className="text-2xl font-bold text-emerald-600 font-orbitron">
                                    {rules.filter(r => r.is_active ?? r.enabled).length} <span className="text-xs text-slate-400 font-sans font-normal">/ {rules.length}</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Critical Monitors</div>
                                <div className="text-2xl font-bold text-red-500 font-orbitron">
                                    {rules.filter(r => (r.severity || '').toLowerCase() === 'critical').length}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-lg font-bold font-orbitron text-slate-800 uppercase tracking-wider flex items-center gap-3">
                                <Settings size={20} className="text-yellow-500" />
                                {editingRuleId ? 'Configure Protocol' : 'Initialize Protocol'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <Trash2 className="rotate-45" size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Protocol Name</label>
                                <input 
                                    type="text" 
                                    value={newRuleData.name}
                                    onChange={e => setNewRuleData({...newRuleData, name: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
                                    placeholder="e.g., Voltage Spike Detection"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Metric</label>
                                    <div className="relative">
                                        <select 
                                            value={newRuleData.metric}
                                            onChange={e => setNewRuleData({...newRuleData, metric: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none appearance-none transition-all"
                                        >
                                            {availableMetrics.map(m => (
                                                <option key={m.key} value={m.key}>{m.label || m.key}</option>
                                            ))}
                                            {availableMetrics.length === 0 && <option value={newRuleData.metric}>{newRuleData.metric}</option>}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Operator</label>
                                    <div className="relative">
                                        <select 
                                            value={newRuleData.operator}
                                            onChange={e => setNewRuleData({...newRuleData, operator: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none appearance-none transition-all font-mono"
                                        >
                                            <option value=">">&gt; (Greater Than)</option>
                                            <option value="<">&lt; (Less Than)</option>
                                            <option value="=">= (Equal)</option>
                                            <option value=">=">&ge; (Greater/Equal)</option>
                                            <option value="<=">&le; (Less/Equal)</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Threshold</label>
                                    <input 
                                        type="number" 
                                        value={newRuleData.threshold}
                                        onChange={e => setNewRuleData({...newRuleData, threshold: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-mono focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Sustain (Sec)</label>
                                    <input 
                                        type="number" 
                                        value={newRuleData.delay}
                                        onChange={e => setNewRuleData({...newRuleData, delay: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-mono focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Severity Level</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['INFO', 'WARNING', 'CRITICAL'].map(sev => (
                                        <button
                                            key={sev}
                                            onClick={() => setNewRuleData({...newRuleData, severity: sev.toLowerCase()})}
                                            className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                                newRuleData.severity === sev.toLowerCase()
                                                ? sev === 'CRITICAL' ? 'bg-red-500 text-white border-red-500' : sev === 'WARNING' ? 'bg-amber-500 text-white border-amber-500' : 'bg-cyan-500 text-white border-cyan-500'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {sev}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold uppercase text-xs tracking-wider hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={submitNewRule}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold uppercase text-xs tracking-wider hover:shadow-lg hover:shadow-yellow-500/30 transition-all"
                            >
                                {editingRuleId ? 'Update Protocol' : 'Initialize Protocol'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertConfiguration;
