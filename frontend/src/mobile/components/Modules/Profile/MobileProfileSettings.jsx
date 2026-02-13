import React, { useEffect, useState, useRef } from 'react';
import {
    User, Phone, Mail, Save, Camera, LogOut,
    Bell, Globe, MessageCircle,
    QrCode, X
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';
import { getApiBase } from 'services/api';
import { authFetch } from '../../../../services/authFetch';

// UI Components
const GlassCard = ({ children, className = "" }) => (
    <div className={`bg-white/90 backdrop-blur-xl border border-white/20 shadow-lg shadow-slate-200/50 rounded-2xl p-5 relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 pointer-events-none" />
        <div className="relative z-10">{children}</div>
    </div>
);

const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <Icon size={18} className="text-yellow-600" />
        </div>
        <span className="font-bold text-slate-800">{title}</span>
    </div>
);

const SettingItem = ({ icon: Icon, label, value, type = "text", onChange, options = [] }) => (
    <div className="group relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-yellow-500 transition-colors">
            <Icon size={18} />
        </div>
        {type === 'select' ? (
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all appearance-none"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        ) : (
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={label}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
            />
        )}
    </div>
);

const ToggleItem = ({ icon: Icon, label, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-100 text-slate-500">
                <Icon size={16} />
            </div>
            <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-yellow-500' : 'bg-slate-300'}`}
        >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

const MobileProfileSettings = () => {
    const { t, setLanguage, language, selectedProject } = useApp();
    const { showAlert, showConfirm } = useDialog();
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({
        displayName: '',
        phone: '',
        email: '',
        avatar: null,
        notifications: {
            email: true,
            push: true,
            line: false
        },
        language: 'th',
        projectId: null
    });

    // LINE Integration State
    const [lineInfo, setLineInfo] = useState(null);
    const [showQr, setShowQr] = useState(false);

    const fileInputRef = useRef(null);

    // Load Data
    useEffect(() => {
        loadProfile();
    }, [selectedProject]);

    const loadProfile = async () => {
        // 1. Try LocalStorage first (Fastest)
        const saved = localStorage.getItem('user_profile_settings');
        if (saved) {
            setProfile(JSON.parse(saved));
        } else {
            // Default mock data if nothing saved
            setProfile({
                displayName: 'Admin User',
                phone: '081-234-5678',
                email: 'admin@energylink.co.th',
                avatar: null,
                notifications: { email: true, push: true, line: false },
                language: 'th',
                projectId: null
            });
        }

        // 2. Try API (Background sync)
        try {
            const apiBase = getApiBase();
            const projectId = typeof selectedProject === 'object' ? selectedProject.id : selectedProject;
            const query = projectId ? `?project_id=${projectId}` : '';

            const res = await authFetch(`${apiBase}/user/profile${query}`);
            if (res.ok) {
                const data = await res.json();

                let foundProjectId = data.project_id;

                // If not found in profile, try /api/user/projects
                if (!foundProjectId && !projectId) {
                    try {
                        const pRes = await authFetch(`${apiBase}/user/projects`);
                        if (pRes.ok) {
                            const pData = await pRes.json();
                            if (pData.projects && pData.projects.length > 0) {
                                foundProjectId = pData.projects[0].project_id;
                            }
                        }
                    } catch (e) { }
                }

                setProfile(prev => {
                    const newProfile = {
                        ...prev,
                        displayName: data.display_name || prev.displayName,
                        email: data.email || prev.email,
                        phone: data.phone || prev.phone,
                        avatar: data.avatar || prev.avatar,
                        notifications: {
                            ...prev.notifications,
                            ...(data.notifications || {})
                        },
                        projectId: projectId || foundProjectId || prev.projectId
                    };
                    // Sync to local storage
                    localStorage.setItem('user_profile_settings', JSON.stringify(newProfile));
                    return newProfile;
                });
            }
        } catch (e) {
            console.warn('API Sync failed, using local data', e);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const apiBase = getApiBase();
            const projectId = typeof selectedProject === 'object' ? selectedProject.id : selectedProject;

            await authFetch(`${apiBase}/user/profile`, {
                method: 'POST',
                body: JSON.stringify({
                    display_name: profile.displayName,
                    email: profile.email,
                    phone: profile.phone,
                    notifications: profile.notifications,
                    project_id: projectId || profile.projectId,
                    avatar: profile.avatar
                })
            });

            // Save to LocalStorage
            localStorage.setItem('user_profile_settings', JSON.stringify(profile));
            try {
                localStorage.setItem('display_name', profile.displayName || '');
                sessionStorage.setItem('display_name', profile.displayName || '');
                localStorage.setItem('app_language', profile.language || language);
            } catch (e) { }

            // Update Context
            if (setUser) {
                setUser(prev => ({
                    ...prev,
                    display_name: profile.displayName,
                    email: profile.email,
                    phone: profile.phone,
                    avatar: profile.avatar
                }));
            }

            // Show success feedback
            showAlert('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว');
        } catch (e) {
            console.error(e);
            showAlert('ผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึก: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, avatar: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const getProjectId = () => {
        // Prioritize API-provided project ID, then fallback to local storage
        return profile.projectId ||
            localStorage.getItem('last_selected_project') ||
            localStorage.getItem('selected_project');
    };

    return (
        <div className="min-h-full pb-24 space-y-6 animate-in fade-in duration-500">
            {/* Header / Avatar Section */}
            <div className="relative pt-8 pb-6 px-4 text-center">
                <div className="relative inline-block">
                    <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-yellow-400 via-orange-500 to-yellow-600 shadow-xl shadow-orange-500/20">
                        <div className="w-full h-full rounded-full bg-white overflow-hidden relative">
                            {profile.avatar ? (
                                <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                                    <User size={48} />
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-1 right-1 p-2 bg-slate-800 text-white rounded-full shadow-lg border-2 border-white hover:bg-slate-700 transition-colors"
                    >
                        <Camera size={16} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-800">{profile.displayName || 'User'}</h2>
                <p className="text-sm text-slate-500">{profile.email || 'user@example.com'}</p>
            </div>

            <div className="px-4 space-y-6">
                {/* Personal Information */}
                <GlassCard>
                    <SectionHeader icon={User} title={t('personal_info')} />
                    <div className="space-y-4">
                        <SettingItem
                            icon={User}
                            label={t('full_name')}
                            value={profile.displayName}
                            onChange={v => setProfile(p => ({ ...p, displayName: v }))}
                        />
                        <SettingItem
                            icon={Phone}
                            label={t('phone_number')}
                            value={profile.phone}
                            onChange={v => setProfile(p => ({ ...p, phone: v }))}
                        />
                        <SettingItem
                            icon={Mail}
                            label={t('email')}
                            value={profile.email}
                            onChange={v => setProfile(p => ({ ...p, email: v }))}
                        />
                    </div>
                </GlassCard>

                {/* App Settings */}
                <GlassCard>
                    <SectionHeader icon={Bell} title={t('notify_and_app')} />
                    <div className="space-y-3">
                        <ToggleItem
                            icon={Mail}
                            label={t('email_notify')}
                            checked={profile.notifications.email}
                            onChange={v => setProfile(p => ({ ...p, notifications: { ...p.notifications, email: v } }))}
                        />
                        <ToggleItem
                            icon={Bell}
                            label={t('push_notify')}
                            checked={profile.notifications.push}
                            onChange={v => setProfile(p => ({ ...p, notifications: { ...p.notifications, push: v } }))}
                        />
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Globe size={18} />
                            </div>
                            <select
                                value={profile.language || language}
                                onChange={(e) => { setLanguage(e.target.value); setProfile(p => ({ ...p, language: e.target.value })); }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-yellow-500 appearance-none"
                            >
                                <option value="th">{t('thai_label')}</option>
                                <option value="en">{t('english_label')}</option>
                            </select>
                        </div>
                    </div>
                </GlassCard>

                {/* LINE Integration */}
                <GlassCard>
                    <SectionHeader icon={MessageCircle} title="LINE Integration" />
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                            เชื่อมต่อกับ LINE Official Account เพื่อรับการแจ้งเตือนและสอบถามข้อมูลผ่าน AI
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={async () => {
                                    try {
                                        setLoading(true);
                                        const pid = getProjectId();

                                        // Try to get link from API
                                        let link = lineInfo?.add_friend_link || lineInfo?.deep_link;
                                        if (!link && pid) {
                                            try {
                                                const apiBase = getApiBase();
                                                const res = await authFetch(`${apiBase}/line/link_info?project_id=${pid}`);
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    setLineInfo(data);
                                                    link = data.add_friend_link || data.deep_link;
                                                }
                                            } catch (e) {
                                                console.warn('API link_info failed:', e);
                                            }
                                        }

                                        // Fallback: direct LINE Add Friend link
                                        if (!link) {
                                            link = 'https://line.me/R/ti/p/@585vtsqe';
                                        }

                                        window.location.href = link;
                                    } catch (e) {
                                        // Ultimate fallback
                                        window.location.href = 'https://line.me/R/ti/p/@585vtsqe';
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="py-3 px-4 bg-[#06C755] text-white rounded-xl font-bold text-sm hover:bg-[#05b34c] transition-all shadow-lg shadow-green-500/20 flex flex-col items-center justify-center gap-1"
                            >
                                <MessageCircle size={24} />
                                <span>Add Friend</span>
                            </button>

                            <button
                                onClick={async () => {
                                    if (showQr) {
                                        setShowQr(false);
                                        return;
                                    }
                                    try {
                                        setLoading(true);

                                        if (!lineInfo) {
                                            const pid = getProjectId();
                                            try {
                                                const apiBase = getApiBase();
                                                const query = pid ? `?project_id=${pid}` : '?project_id=default';
                                                const res = await authFetch(`${apiBase}/line/link_info${query}`);
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    setLineInfo(data);
                                                }
                                            } catch (e) {
                                                console.warn('API link_info failed for QR:', e);
                                            }

                                            // If API failed, create fallback lineInfo
                                            if (!lineInfo) {
                                                const fallbackLink = 'https://line.me/R/ti/p/@585vtsqe';
                                                setLineInfo({
                                                    basic_id: '@585vtsqe',
                                                    bot_name: 'EnergyLink Bot',
                                                    add_friend_link: fallbackLink,
                                                    qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fallbackLink)}`
                                                });
                                            }
                                        }
                                        setShowQr(true);
                                    } catch (e) {
                                        // Fallback QR
                                        const fallbackLink = 'https://line.me/R/ti/p/@585vtsqe';
                                        setLineInfo({
                                            basic_id: '@585vtsqe',
                                            bot_name: 'EnergyLink Bot',
                                            add_friend_link: fallbackLink,
                                            qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fallbackLink)}`
                                        });
                                        setShowQr(true);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all border border-slate-200 flex flex-col items-center justify-center gap-1"
                            >
                                <QrCode size={24} />
                                <span>QR Code</span>
                            </button>
                        </div>

                        {showQr && lineInfo && (
                            <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-inner flex flex-col items-center animate-in zoom-in duration-300">
                                <div className="flex w-full justify-end mb-2">
                                    <button onClick={() => setShowQr(false)} className="text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                    <img src={lineInfo.qr_url} alt="LINE QR Code" className="w-48 h-48 object-contain" />
                                </div>
                                <p className="mt-3 text-center text-sm font-medium text-slate-600">
                                    สแกนเพื่อเพิ่มเพื่อนและเชื่อมต่อโปรเจกต์
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Bot ID: {lineInfo.basic_id}
                                </p>
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/40 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <Save size={20} />
                            {t('save_changes')}
                        </>
                    )}
                </button>

                {/* Sign Out */}
                <button
                    className="w-full py-3 bg-red-50 text-red-500 border border-red-100 rounded-2xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    onClick={async () => {
                        const confirmed = await showConfirm('ยืนยัน', 'คุณต้องการออกจากระบบใช่หรือไม่?');
                        if (confirmed) {
                            try {
                                const apiBase = getApiBase();
                                await authFetch(`${apiBase}/logout`, { method: 'POST' });
                            } catch (e) { }

                            // Clear all storage
                            sessionStorage.clear();
                            localStorage.removeItem('selectedProject');
                            localStorage.removeItem('selectedDevice');
                            localStorage.removeItem('user_profile_settings');

                            await showAlert('สำเร็จ', 'ออกจากระบบเรียบร้อย');
                            window.location.href = '/login';
                        }
                    }}
                >
                    <LogOut size={18} />
                    {t('logout')}
                </button>
            </div>
        </div>
    );
};

export default MobileProfileSettings;
