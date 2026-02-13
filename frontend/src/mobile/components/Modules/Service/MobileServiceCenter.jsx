import React, { useEffect, useState } from 'react';
import api from 'services/api';
import { ClipboardList, Wrench, Calendar, Plus, X, CheckCircle2, Clock, Truck, UserCheck, MessageSquare } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';

const MobileServiceCenter = () => {
    const { selectedProject } = useApp();
    const { showAlert } = useDialog();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRequest, setShowRequest] = useState(false);
    const [newRequest, setNewRequest] = useState({ title: '', note: '', date: '' });

    const loadJobs = async () => {
        setLoading(true);
        // Pass selectedProject to listJobs to filter by project
        const res = await api.service.listJobs(selectedProject);
        const items = (res && res.items) || [];
        setJobs(items);
        setLoading(false);
    };
    useEffect(() => { loadJobs(); }, [selectedProject]);

    const submitRequest = async () => {
        if (!newRequest.title) {
            showAlert('แจ้งเตือน', 'กรุณาระบุหัวข้อบริการ');
            return;
        }
        try {
            const jobRes = await api.service.createJob({
                project_id: selectedProject,
                title: newRequest.title,
                note: newRequest.note + (newRequest.date ? `\n(Requested Date: ${newRequest.date})` : '')
            });
            
            // Notify Admin
            try {
                await api.notifications.create({
                    project_id: selectedProject,
                    title: 'New Service Request',
                    message: `User requested service: ${newRequest.title}`,
                    type: 'info'
                });
            } catch (e) { console.warn("Failed to notify admin", e); }

            await showAlert('สำเร็จ', 'ส่งคำร้องเรียบร้อย');
            setShowRequest(false);
            setNewRequest({ title: '', note: '', date: '' });
            loadJobs();
        } catch (e) {
            showAlert('ผิดพลาด', 'เกิดข้อผิดพลาด');
        }
    };

    const phaseConfig = (p) => {
        switch(p){
            case 'ordered': return { label: 'รับเรื่องแล้ว', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: ClipboardList };
            case 'contacted': return { label: 'ติดต่อกลับแล้ว', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: MessageSquare };
            case 'scheduled': return { label: 'นัดหมายแล้ว', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: Calendar };
            case 'installing': return { label: 'กำลังเข้าดำเนินการ', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', icon: Truck };
            case 'verifying': return { label: 'ตรวจสอบความเรียบร้อย', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: UserCheck };
            case 'completed': return { label: 'เสร็จสิ้น', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: CheckCircle2 };
            default: return { label: p, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: Wrench };
        }
    };

    const renderRequestModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-300 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">แจ้งปัญหา / บริการ</h3>
                        <p className="text-xs text-slate-500">ทีมงานพร้อมดูแลตลอด 24 ชม.</p>
                    </div>
                    <button onClick={() => setShowRequest(false)} className="p-1 rounded-full hover:bg-slate-100 transition-colors"><X className="text-slate-400" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">หัวข้อเรื่อง</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors placeholder:text-slate-400"
                            placeholder="เช่น ไฟดับ, ขอติดตั้งเพิ่ม, ตรวจเช็คระบบ"
                            value={newRequest.title}
                            onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">รายละเอียด</label>
                        <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors placeholder:text-slate-400 resize-none"
                            placeholder="อธิบายปัญหาหรือสิ่งที่ต้องการ..."
                            rows={3}
                            value={newRequest.note}
                            onChange={e => setNewRequest({...newRequest, note: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">วันที่สะดวก (ถ้ามี)</label>
                        <input 
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors"
                            value={newRequest.date}
                            onChange={e => setNewRequest({...newRequest, date: e.target.value})}
                        />
                    </div>
                    <button 
                        onClick={submitRequest}
                        className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl font-bold text-white mt-2 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/40 transition-all active:scale-95"
                    >
                        ส่งคำร้อง
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full p-5 gap-6 pb-24 overflow-y-auto custom-scrollbar bg-slate-50/50">
            {showRequest && renderRequestModal()}
            
            <div className="flex items-center justify-between sticky top-0 z-10 bg-slate-50/95 backdrop-blur py-2">
                <div>
                    <h2 className="text-xl font-bold font-orbitron text-slate-800">Service Center</h2>
                    <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-widest">ติดตามสถานะงานบริการ</p>
                </div>
                <button 
                    onClick={() => setShowRequest(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 text-white font-bold text-xs shadow-lg shadow-yellow-500/20 active:scale-95 transition-all"
                >
                    <Plus size={16} /> แจ้งเรื่องใหม่
                </button>
            </div>

            <div className="space-y-4">
                {loading && <div className="text-center py-10 text-slate-400 animate-pulse">กำลังโหลดข้อมูล...</div>}
                
                {!loading && jobs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <div className="p-4 bg-white rounded-full shadow-sm">
                            <Wrench size={32} className="text-slate-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-600">ยังไม่มีประวัติการบริการ</p>
                            <p className="text-xs mt-1">แจ้งปัญหาหรือขอรับบริการได้เลย</p>
                        </div>
                        <button onClick={() => setShowRequest(true)} className="text-xs text-yellow-600 font-bold underline hover:text-yellow-700">แจ้งเรื่องเลย</button>
                    </div>
                )}

                {jobs.map(j => {
                    const phase = phaseConfig(j.phase);
                    const StatusIcon = phase.icon;
                    
                    return (
                        <div key={j.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-2">
                            {/* Header Status */}
                            <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${phase.bg} ${phase.color}`}>
                                        <StatusIcon size={20} />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${phase.color}`}>{phase.label}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">ID: {j.id.substring(0,8)}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                    {(j.created_at || '').split('T')[0]}
                                </div>
                            </div>

                            {/* Body */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-base font-bold text-slate-800 mb-1">{j.title}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        {j.note || 'ไม่มีรายละเอียดเพิ่มเติม'}
                                    </p>
                                </div>

                                {j.appointment_date && (
                                    <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                        <Calendar size={16} className="text-yellow-600" />
                                        <div>
                                            <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">วันนัดหมาย</div>
                                            <div className="text-sm font-bold text-slate-800">{new Date(j.appointment_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Timeline (Mini) */}
                            <div className="mt-5 pt-3 border-t border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Timeline</div>
                                <div className="flex items-center justify-between relative px-2">
                                    {/* Line */}
                                    <div className="absolute left-0 right-0 top-1.5 h-0.5 bg-slate-100 -z-10" />
                                    
                                    {/* Steps */}
                                    {['ordered', 'contacted', 'scheduled', 'completed'].map((step, idx) => {
                                        const isCompleted = ['ordered', 'contacted', 'scheduled', 'installing', 'verifying', 'completed'].indexOf(j.phase) >= ['ordered', 'contacted', 'scheduled', 'completed'].indexOf(step);
                                        const isCurrent = j.phase === step || (step === 'scheduled' && (j.phase === 'installing' || j.phase === 'verifying'));
                                        
                                        return (
                                            <div key={step} className="flex flex-col items-center gap-1">
                                                <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                                                    isCompleted || isCurrent 
                                                    ? 'bg-yellow-500 border-yellow-500' 
                                                    : 'bg-white border-slate-300'
                                                }`} />
                                                <span className={`text-[9px] font-bold transition-colors ${
                                                    isCompleted || isCurrent ? 'text-slate-600' : 'text-slate-300'
                                                }`}>
                                                    {step === 'ordered' ? 'แจ้ง' : 
                                                     step === 'contacted' ? 'ติดต่อ' : 
                                                     step === 'scheduled' ? 'นัดหมาย' : 'เสร็จสิ้น'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileServiceCenter;
