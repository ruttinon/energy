import React, { useState, useEffect } from 'react';
import { 
    Calendar, 
    CheckCircle, 
    Clock, 
    Search, 
    Filter, 
    MapPin, 
    User, 
    Briefcase,
    ChevronRight,
    X,
    Save
} from 'lucide-react';
import api from 'services/api';
import { useDialog } from '../../../../context/DialogContext';

const PHASES = [
    { id: "ordered", label: "New Request", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    { id: "contacted", label: "Contacted", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { id: "scheduled", label: "Scheduled", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
    { id: "installing", label: "In Progress", color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200" },
    { id: "verifying", label: "Verifying", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { id: "completed", label: "Completed", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" }
];

const ServiceManager = () => {
    const { showAlert } = useDialog();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterProject, setFilterProject] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [editForm, setEditForm] = useState({ phase: '', appointment_date: '', note: '' });

    const loadJobs = async () => {
        setLoading(true);
        try {
            const res = await api.service.listAllJobs(filterProject);
            setJobs(res?.items || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, [filterProject]);

    const handleEdit = (job) => {
        setSelectedJob(job);
        setEditForm({
            phase: job.phase || 'ordered',
            appointment_date: job.appointment_date || '',
            note: job.note || ''
        });
    };

    const handleSave = async () => {
        if (!selectedJob) return;
        try {
            await api.service.updateJob(selectedJob.id, editForm);
            
            // Notify User
            try {
                const phaseLabel = PHASES.find(p => p.id === editForm.phase)?.label || editForm.phase;
                await api.notifications.create({
                    project_id: selectedJob.project_id, // Ensure selectedJob has project_id
                    title: 'Service Update',
                    message: `Your service request "${selectedJob.title}" is now: ${phaseLabel}`,
                    type: 'info'
                });
            } catch (e) { console.warn("Failed to notify user", e); }

            setSelectedJob(null);
            loadJobs();
            showAlert('Success', 'Job updated successfully');
        } catch (err) {
            showAlert('Error', 'Failed to update job');
        }
    };

    const getPhaseObj = (p) => PHASES.find(x => x.id === p) || PHASES[0];

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header / Filter */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-100 shadow-sm">
                            <Briefcase size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-orbitron text-slate-800 tracking-tight">
                                <span className="bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">Service Requests</span>
                            </h2>
                            <div className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-widest mt-1">Manage Installations & Maintenance</div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-yellow-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Filter by Project ID..." 
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all placeholder:text-slate-400 font-rajdhani"
                        />
                    </div>
                    <button 
                        onClick={loadJobs}
                        className="px-4 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-200 hover:shadow-md transition-all active:scale-95"
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-20 pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {loading ? (
                    <div className="text-center text-slate-400 py-12 font-rajdhani uppercase tracking-widest animate-pulse">Loading service data...</div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <Briefcase size={24} />
                        </div>
                        <div className="text-slate-500 font-medium">No service requests found</div>
                    </div>
                ) : (
                    jobs.map(job => {
                        const phase = getPhaseObj(job.phase);
                        return (
                            <div 
                                key={job.id}
                                onClick={() => handleEdit(job)}
                                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/5 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-bl-[100px] -mr-16 -mt-16 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex justify-between items-start mb-3 gap-4 relative z-10">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-800 text-base mb-1 truncate font-orbitron group-hover:text-yellow-700 transition-colors">{job.title}</div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <User size={12} className="text-slate-400" /> 
                                                <span className="font-medium">{job.username}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100">
                                                <MapPin size={10} /> 
                                                <span className="font-bold text-[10px] tracking-wide">{job.project_id || 'No Project'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${phase.color} ${phase.bg}`}>
                                        {phase.label}
                                    </div>
                                </div>

                                {(job.appointment_date) && (
                                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-sm text-slate-600 group-hover:border-yellow-200/50 transition-colors">
                                        <Calendar size={14} className="text-yellow-500" />
                                        <span className="font-rajdhani font-semibold">{new Date(job.appointment_date).toLocaleDateString()}</span>
                                    </div>
                                )}
                                
                                <div className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed pl-1 border-l-2 border-slate-200 group-hover:border-yellow-400 transition-colors">
                                    {job.note || 'No details provided'}
                                </div>
                                
                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div className="text-[10px] font-mono text-slate-400">
                                        ID: {job.id.substring(0,8)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                        {new Date(job.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Edit Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl shadow-slate-200/50 scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold font-orbitron text-slate-800">Update Job Status</h3>
                                <p className="text-xs text-slate-500 mt-1">Manage service request progression</p>
                            </div>
                            <button 
                                onClick={() => setSelectedJob(null)} 
                                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Current Phase</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {PHASES.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setEditForm({...editForm, phase: p.id})}
                                            className={`px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all duration-200 flex items-center justify-center gap-2 ${
                                                editForm.phase === p.id 
                                                ? `${p.bg} ${p.color} ring-1 ring-offset-1 ring-offset-white ${p.color.replace('text-', 'ring-').replace('600', '200')}` 
                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                                            }`}
                                        >
                                            {editForm.phase === p.id && <CheckCircle size={12} />}
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Appointment Date</label>
                                <div className="relative">
                                    <input 
                                        type="date"
                                        value={editForm.appointment_date}
                                        onChange={(e) => setEditForm({...editForm, appointment_date: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all font-rajdhani"
                                    />
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Admin Note</label>
                                <textarea 
                                    value={editForm.note}
                                    onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none resize-none placeholder:text-slate-400 transition-all"
                                    placeholder="Add internal notes about this request..."
                                />
                            </div>

                            <button 
                                onClick={handleSave}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold font-rajdhani uppercase tracking-widest text-sm hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceManager;
