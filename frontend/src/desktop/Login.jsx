import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getApiBase } from 'services/api';

const EnergyLinkLogin = () => {
  const navigate = useNavigate();
  const { setIsAdminMode, selectedProject } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('Loading...');
  const [responseTime, setResponseTime] = useState('35ms');

  const backgrounds = [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920'
  ];

  // Clock update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const date = now.toLocaleDateString('en-GB');
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setCurrentTime(`Bangkok | ${date} | ${time}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Enter key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        doLogin();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [username, password]);

  const doLogin = async () => {
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Please enter username and password');
      return;
    }

    setIsLoading(true);

    try {
      const startTime = Date.now();
      const API = getApiBase();
      const urlParams = new URLSearchParams(window.location.search);
      const pidParam = urlParams.get('pid');

      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          project_id: pidParam || undefined
        }),
      });

      const endTime = Date.now();
      setResponseTime(`${endTime - startTime}ms`);

      if (res.ok) {
        const data = await res.json();
        const isAdmin = data.role === 'admin';
        setIsAdminMode(isAdmin);
        // Store Token and Role in SessionStorage (Isolation)
        if (data.session_id) sessionStorage.setItem('auth_token', data.session_id);
        sessionStorage.setItem('isAdminMode', isAdmin ? '1' : '0');
        sessionStorage.setItem('username', username.trim());
        try {
          const sel = data && data.selected_project;
          if (sel) {
            sessionStorage.setItem('selectedProject', sel);
            localStorage.setItem('selectedProject', sel);
          }
        } catch {}
        const pid = sessionStorage.getItem('selectedProject') || new URLSearchParams(window.location.search).get('pid') || '';
        navigate(pid ? `/app?pid=${encodeURIComponent(pid)}` : '/app');
      } else {
        try {
          const errBody = await res.json();
          setErrorMsg(errBody && errBody.message ? errBody.message : 'Invalid username or password');
        } catch (e) {
          setErrorMsg('Invalid username or password');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Server connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen relative overflow-hidden flex items-center justify-center bg-transparent">
      {/* Background with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 transition-all duration-1000"
        style={{ backgroundImage: `url('/image/bg-en.png')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/10 via-transparent to-transparent z-0" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md p-10 bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-40 h-40 md:w-48 md:h-48 mx-auto mb-6 relative group cursor-pointer">
            <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-2xl animate-pulse group-hover:bg-yellow-500/50 transition-all duration-500" />
            <div className="relative w-full h-full drop-shadow-2xl hover:scale-105 transition-transform duration-500">
               <img src="/image/EnergyLink2.png" alt="EnergyLink Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-wider font-orbitron bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">ENERGY LINK</h1>
          <p className="text-slate-500 text-sm mt-2 tracking-[0.3em] uppercase font-bold">Intelligent Monitoring System</p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identity</label>
            <div className="relative group">
              <div className="absolute inset-0 bg-yellow-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="relative w-full bg-white border border-slate-200 text-slate-800 px-4 py-3.5 rounded-xl focus:outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 transition-all pl-12 placeholder:text-slate-400 font-medium shadow-sm"
                placeholder="Username"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-yellow-600 transition-colors z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
            <div className="relative group">
              <div className="absolute inset-0 bg-yellow-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative w-full bg-white border border-slate-200 text-slate-800 px-4 py-3.5 rounded-xl focus:outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 transition-all pl-12 pr-12 placeholder:text-slate-400 font-medium shadow-sm"
                placeholder="Password"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-yellow-600 transition-colors z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors z-10 p-1 hover:bg-slate-100 rounded-lg"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50/80 backdrop-blur border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center shadow-sm animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errorMsg}
            </div>
          )}

          <button
            onClick={doLogin}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-bold py-4 rounded-xl transition-all transform active:scale-[0.98] shadow-xl shadow-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            {isLoading ? (
              <span className="flex items-center justify-center tracking-wider">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AUTHENTICATING...
              </span>
            ) : <span className="tracking-wider">ACCESS CONTROL</span>}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-500 font-mono font-medium">
          <div>{currentTime}</div>
          <div className="flex items-center">
            <div className="relative mr-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            SYSTEM ONLINE ({responseTime})
          </div>
        </div>
      </div>
      
      {/* Version */}
      <div className="absolute bottom-4 right-6 text-slate-400 text-xs font-mono backdrop-blur-sm px-2 py-1 rounded border border-slate-200/50">
        v3.0.1-STABLE
      </div>
    </div>
  );
};

export default EnergyLinkLogin;
