import React, { useState, useEffect } from 'react';
import { Shield, Filter, Download, Eye, AlertCircle, Clock, User, FileText, CheckCircle, XCircle, Activity } from 'lucide-react';

const AuditTrail = ({ projectId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [filterEventType, setFilterEventType] = useState('all');
  const [days, setDays] = useState(30);
  const [expandedLog, setExpandedLog] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [projectId, filterUsername, filterEventType, days]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        project_id: projectId,
        days: days,
        limit: 500
      });

      if (filterUsername) params.append('username', filterUsername);
      if (filterEventType !== 'all') params.append('event_type', filterEventType);

      const response = await fetch(`/api/audit/activity?${params}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        setError('Unauthorized - Please log in again');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(`Failed to load audit logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch(`/api/audit/summary?project_id=${projectId}&days=${days}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const handleDownload = () => {
    if (!logs.length) return;

    // Create CSV content
    const headers = ['Timestamp', 'Event Type', 'Action', 'Username', 'Status', 'IP Address', 'Resource', 'Details'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        `"${new Date(log.timestamp).toLocaleString()}"`,
        `"${log.event_type}"`,
        `"${log.action}"`,
        `"${log.username || ''}"`,
        `"${log.status}"`,
        `"${log.ip_address || ''}"`,
        `"${log.resource_type || ''}: ${log.resource_name || log.resource_id || ''}"`,
        `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_trail_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventColor = (eventType) => {
    const colors = {
      'LOGIN': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'LOGOUT': 'bg-slate-50 text-slate-500 border-slate-100',
      'DEVICE_CONTROL': 'bg-blue-50 text-blue-600 border-blue-100',
      'CONFIG_CHANGE': 'bg-yellow-50 text-yellow-600 border-yellow-100',
      'USER_MANAGEMENT': 'bg-purple-50 text-purple-600 border-purple-100',
      'ERROR': 'bg-red-50 text-red-600 border-red-100'
    };
    return colors[eventType] || 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle size={14} className="text-emerald-500" />;
    if (status === 'failure') return <XCircle size={14} className="text-red-500" />;
    return <Activity size={14} className="text-slate-400" />;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('th-TH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-50 to-white border border-yellow-100 shadow-sm">
                <Shield className="text-yellow-600" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent tracking-tight">
                  Audit Trail
                </h1>
                <p className="text-[10px] text-slate-500 font-rajdhani uppercase tracking-[0.2em] mt-1">Security & Activity Logging</p>
              </div>
            </div>
            
            <button 
                onClick={handleDownload}
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-yellow-500/50 hover:shadow-md transition-all text-xs font-bold uppercase tracking-wider text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download size={16} className="text-yellow-600" />
                Export CSV
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 group">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-yellow-500 transition-colors" size={16} />
                <input
                    type="text"
                    placeholder="Filter by username..."
                    value={filterUsername}
                    onChange={(e) => setFilterUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all text-sm font-rajdhani"
                />
            </div>
            <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all text-sm font-rajdhani min-w-[150px]"
            >
                <option value="all">All Events</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
                <option value="DEVICE_CONTROL">Device Control</option>
                <option value="CONFIG_CHANGE">Config Change</option>
                <option value="USER_MANAGEMENT">User Management</option>
                <option value="ERROR">Error</option>
            </select>
            <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all text-sm font-rajdhani min-w-[150px]"
            >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Summary Stats */}
        {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group hover:border-yellow-500/30 transition-all">
                    <p className="text-[10px] text-slate-400 font-rajdhani uppercase tracking-wider mb-1">Total Events</p>
                    <p className="text-2xl font-bold font-orbitron text-slate-800">{summary.total_events}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group hover:border-emerald-500/30 transition-all">
                    <p className="text-[10px] text-slate-400 font-rajdhani uppercase tracking-wider mb-1">Login Events</p>
                    <p className="text-2xl font-bold font-orbitron text-emerald-600">{summary.event_types.LOGIN || 0}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group hover:border-blue-500/30 transition-all">
                    <p className="text-[10px] text-slate-400 font-rajdhani uppercase tracking-wider mb-1">Device Controls</p>
                    <p className="text-2xl font-bold font-orbitron text-blue-600">{summary.event_types.DEVICE_CONTROL || 0}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group hover:border-yellow-500/30 transition-all">
                    <p className="text-[10px] text-slate-400 font-rajdhani uppercase tracking-wider mb-1">Config Changes</p>
                    <p className="text-2xl font-bold font-orbitron text-yellow-600">{summary.event_types.CONFIG_CHANGE || 0}</p>
                </div>
            </div>
        )}

        {/* Error Message */}
        {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                <p className="text-red-700 text-sm">{error}</p>
            </div>
        )}

        {/* Logs List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-700 font-rajdhani uppercase tracking-wider text-sm">Activity Log</h3>
                <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                    {logs.length} Entries
                </span>
            </div>
            
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-yellow-100 border-t-yellow-500 rounded-full animate-spin mb-4" />
                    <p className="text-slate-400 font-rajdhani uppercase tracking-wider text-xs animate-pulse">Synchronizing Logs...</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="p-4 rounded-full bg-slate-50 mb-4">
                        <FileText size={32} className="opacity-50" />
                    </div>
                    <p className="font-rajdhani uppercase tracking-wider text-sm">No activity recorded</p>
                    <p className="text-xs opacity-60 mt-1">Try adjusting your filters</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {logs.map((log) => (
                        <div key={log.id} className="group">
                            <div 
                                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                className={`p-4 cursor-pointer hover:bg-slate-50 transition-all ${expandedLog === log.id ? 'bg-yellow-50/30' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getEventColor(log.event_type)}`}>
                                                {log.event_type}
                                            </span>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-100 bg-white">
                                                {getStatusIcon(log.status)}
                                                <span className="text-[10px] font-mono text-slate-500 uppercase">{log.status}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 truncate">{log.action}</span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={12} className="text-yellow-600/50" />
                                                <span>{formatDate(log.timestamp)}</span>
                                            </div>
                                            {log.username && (
                                                <div className="flex items-center gap-1.5">
                                                    <User size={12} className="text-yellow-600/50" />
                                                    <span className="font-semibold text-slate-600">{log.username}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`p-2 rounded-lg transition-all ${expandedLog === log.id ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-50 text-slate-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                                        <Eye size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedLog === log.id && (
                                <div className="bg-slate-50/50 border-y border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {log.resource_type && (
                                            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Resource</p>
                                                <p className="text-sm font-mono text-slate-700 break-all">
                                                    <span className="text-yellow-600">{log.resource_type}:</span> {log.resource_name || log.resource_id || 'N/A'}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {log.ip_address && (
                                            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Origin IP</p>
                                                <p className="text-sm font-mono text-slate-700">{log.ip_address}</p>
                                            </div>
                                        )}
                                    </div>

                                    {log.details && Object.keys(log.details).length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Technical Payload</p>
                                            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto shadow-inner">
                                                <pre className="text-xs font-mono text-emerald-400">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
