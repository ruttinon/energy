import React, { useEffect, useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import api from 'services/api';
import { FilePlus, Phone, User as UserIcon, FolderPlus, Upload, History } from 'lucide-react';

const MobileSupport = () => {
    const { selectedProject, projectName } = useApp();
    const { showAlert } = useDialog();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [history, setHistory] = useState([]);

    const disabled = !selectedProject || !name || !phone || !description || submitting;

    const loadHistory = async () => {
        if (!selectedProject) return;
        const res = await api.support.list(selectedProject);
        setHistory((res && res.data) || []);
    };

    useEffect(() => { loadHistory(); }, [selectedProject]);

    const onFileChange = (e) => {
        const fl = Array.from(e.target.files || []);
        setFiles(fl);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (disabled) return;
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('phone', phone);
            fd.append('project_name', projectName || selectedProject);
            fd.append('description', description);
            for (const f of files) fd.append('files', f);
            const res = await api.support.submit(selectedProject, fd);
            if (res && res.status === 'ok') {
                try {
                    await api.notifications.create({
                        username: 'admin',
                        project_id: selectedProject,
                        title: 'Support Request',
                        message: `${name} (${phone}) • ${description.slice(0, 140)}${description.length > 140 ? '...' : ''}`,
                        type: 'warning'
                    });
                } catch (notifyErr) { /* ignore */ }
                setName(''); setPhone(''); setDescription(''); setFiles([]);
                    await loadHistory();
                    showAlert('Success', 'ส่งคำร้องเรียบร้อยแล้ว');
                } else {
                    showAlert('Error', 'ส่งคำร้องไม่สำเร็จ');
                }
            } catch (err) {
                showAlert('Error', 'เกิดข้อผิดพลาดในการส่งคำร้อง');
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="flex flex-col h-full p-4 gap-5 pb-24">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <FilePlus size={18} className="text-yellow-600" />
                    <span className="text-sm font-bold text-slate-800">แจ้งปัญหา / ส่งคำร้อง</span>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                        <div className="relative">
                            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ชื่อผู้แจ้ง"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-yellow-500/50 transition-colors"
                            />
                        </div>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="tel"
                                placeholder="เบอร์โทรศัพท์"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-yellow-500/50 transition-colors"
                            />
                        </div>
                        <div>
                            <textarea
                                placeholder="อธิบายปัญหาที่เกิดขึ้น"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-yellow-500/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-slate-600 text-sm mb-2">
                                <Upload size={16} />
                                แนบรูปภาพหรือไฟล์
                            </label>
                            <input
                                type="file"
                                multiple
                                onChange={onFileChange}
                                className="w-full text-slate-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                            />
                            {files.length > 0 && (
                                <div className="mt-2 text-[10px] text-slate-500">
                                    แนบ {files.length} ไฟล์
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={disabled}
                        className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            disabled 
                                ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border border-yellow-600 hover:shadow-md'
                        }`}
                    >
                        <FolderPlus size={16} />
                        ส่งคำร้อง
                    </button>
                </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <History size={18} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-800">ประวัติการแจ้ง</span>
                </div>
                <div className="space-y-3">
                    {history.length === 0 && (
                        <div className="text-xs text-slate-500">ยังไม่มีรายการ</div>
                    )}
                    {history.map((t) => (
                        <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="flex justify-between">
                                <div className="text-slate-800 text-sm font-bold">{t.name} • {t.phone}</div>
                                <span className="text-[10px] text-slate-500">{(t.created_at || '').replace('T', ' ').replace('Z', '')}</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">{t.description}</div>
                            {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {t.attachments.map((a, idx) => (
                                        <a
                                            key={idx}
                                            href={api.support.download(selectedProject, t.id, a.filename)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] px-2 py-1 rounded bg-white text-slate-600 border border-slate-200 hover:text-yellow-600 hover:border-yellow-200 transition-colors shadow-sm"
                                        >
                                            {a.filename}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MobileSupport;
