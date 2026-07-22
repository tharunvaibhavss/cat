'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/Providers';
import { alertService } from '@/services/api';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Check, 
  RefreshCw,
  Mail,
  X,
  Trash2
} from 'lucide-react';

interface AlertItem {
  id: number;
  machine_id: string;
  timestamp: string;
  health_score: number;
  message: string;
  is_resolved: boolean;
  resolved_at?: string | null;
}

export default function AlertsPage() {
  const { activeRole } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  
  // Modal Recipient dropdown configurations
  const [supervisors, setSupervisors] = useState<{username: string, email: string}[]>([]);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mailAlertId, setMailAlertId] = useState<number | null>(null);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [mailingId, setMailingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSupervisorsList = async () => {
    try {
      const { userService } = await import('@/services/api');
      const sups = await userService.listSupervisors();
      const filteredSups = sups.filter((u: any) => u.email && u.email.trim());
      setSupervisors(filteredSups);
      if (filteredSups.length > 0) {
        setSelectedEmail(filteredSups[0].email);
      } else {
        setSelectedEmail('workwiththarun@gmail.com');
      }
    } catch (e) {
      console.error("Failed to load supervisors", e);
      setSelectedEmail('workwiththarun@gmail.com');
    }
  };

  const handleSendMail = (id: number) => {
    setMailAlertId(id);
    setIsMailOpen(true);
    setIsCustomMode(false);
    setCustomEmail('');
    if (supervisors.length > 0) {
      setSelectedEmail(supervisors[0].email);
    } else {
      setSelectedEmail('workwiththarun@gmail.com');
    }
  };

  const submitSendMail = async () => {
    if (!mailAlertId) return;
    const emailToUse = isCustomMode ? customEmail.trim() : selectedEmail.trim();
    
    if (!emailToUse) {
      alert("Email address cannot be empty.");
      return;
    }
    if (!emailToUse.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    
    setMailingId(mailAlertId);
    try {
      const res = await alertService.sendEmail(mailAlertId, emailToUse);
      alert(`Report manually emailed to: ${res.recipients.join(', ')}`);
      setIsMailOpen(false);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'SMTP server connection error. Make sure App Password is correct.');
    } finally {
      setMailingId(null);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await alertService.list();
      setAlerts(data);
    } catch (e: any) {
      setErrorMsg('Failed to load alert log. Ensure backend is running.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

     useEffect(() => {
    fetchAlerts();
    fetchSupervisorsList();
  }, []);

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      await alertService.resolve(id);
      // Refresh alert list
      await fetchAlerts();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to resolve alert.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this alert log?")) {
      return;
    }
    setDeletingId(id);
    try {
      await alertService.delete(id);
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to delete alert.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter alerts based on active selection
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'active') return !alert.is_resolved;
    if (filter === 'resolved') return alert.is_resolved;
    return true;
  });

  const canResolve = ['Administrator', 'Maintenance Engineer'].includes(activeRole || '');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <ShieldAlert className="w-7 h-7 mr-2.5 text-red-600 animate-pulse" />
            ALERT LOG CENTER
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time critical alarms triggered for machinery operating at &ge;80% Risk (Health Score &le;20%).
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <button 
            onClick={fetchAlerts} 
            disabled={loading}
            className="p-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded border border-gray-300 bg-white transition-all flex items-center space-x-1 text-xs font-bold uppercase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-gray-200 p-1 rounded-lg max-w-sm">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 text-xs font-bold uppercase rounded transition-all ${
            filter === 'all' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-1.5 text-xs font-bold uppercase rounded transition-all ${
            filter === 'active' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-gray-500 hover:text-red-600'
          }`}
        >
          Active ({alerts.filter(a => !a.is_resolved).length})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`flex-1 py-1.5 text-xs font-bold uppercase rounded transition-all ${
            filter === 'resolved' 
              ? 'bg-green-600 text-white shadow-sm' 
              : 'text-gray-500 hover:text-green-600'
          }`}
        >
          Resolved ({alerts.filter(a => a.is_resolved).length})
        </button>
      </div>

      {/* Content Area */}
      {errorMsg ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm font-semibold">
          {errorMsg}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading Alert logs...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-gray-900 uppercase">System status fully healthy</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
            No critical alarms have been logged for this filter option. All machinery status parameters are operating within safe bounds.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black text-white text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Alarm ID</th>
                  <th className="px-6 py-4">Machine Reference</th>
                  <th className="px-6 py-4">Risk Severity</th>
                  <th className="px-6 py-4">Alarm Details</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredAlerts.map((alert) => {
                  const timestamp = new Date(alert.timestamp).toLocaleString();
                  const resolvedAt = alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : '';

                  return (
                    <tr 
                      key={alert.id} 
                      className={`hover:bg-gray-50 transition-colors ${
                        !alert.is_resolved ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-gray-600">
                        #ALRT-{String(alert.id).padStart(4, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-gray-900 block font-mono">{alert.machine_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded uppercase tracking-wider">
                            {(100 - alert.health_score)}% Risk
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs md:max-w-md">
                        <p className="text-gray-800 font-medium">{alert.message}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{timestamp}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {alert.is_resolved ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Unresolved
                          </span>
                        )}
                        {alert.is_resolved && resolvedAt && (
                          <span className="block text-[10px] text-gray-400 font-mono mt-1">
                            Fixed: {resolvedAt}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleSendMail(alert.id)}
                            disabled={mailingId === alert.id}
                            className="px-3 py-1.5 text-xs font-bold uppercase rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-all hover:shadow-sm flex items-center space-x-1"
                            title="Resend email alert report to supervisors"
                          >
                            <Mail className="w-3.5 h-3.5 text-gray-500" />
                            <span>{mailingId === alert.id ? 'Sending...' : 'Mail'}</span>
                          </button>
                          
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolvingId === alert.id || !canResolve}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded border transition-all ${
                              !canResolve
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : alert.is_resolved
                                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700 hover:shadow-sm'
                                : 'bg-green-600 hover:bg-green-700 text-white border-green-700 hover:shadow-sm'
                            }`}
                            title={!canResolve ? 'Requires Administrator or Engineer role' : alert.is_resolved ? 'Reopen/unresolve alarm' : 'Mark issue as resolved'}
                          >
                            {resolvingId === alert.id ? 'Saving...' : alert.is_resolved ? 'Reopen' : 'Resolve'}
                          </button>

                          <button
                            onClick={() => handleDelete(alert.id)}
                            disabled={deletingId === alert.id || !canResolve}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded border transition-all flex items-center space-x-1 ${
                              !canResolve
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white border-red-750 hover:shadow-sm'
                            }`}
                            title={!canResolve ? 'Requires Administrator or Engineer role' : 'Permanently delete this alert log'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingId === alert.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- MANUAL MAIL MODAL ----------------- */}
      {isMailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-black text-white border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-widest text-primary uppercase flex items-center">
                <Mail className="w-5 h-5 mr-2 text-primary" />
                Dispatch Fault Report
              </h3>
              <button onClick={() => setIsMailOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="recipient-select" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select Recipient Supervisor</label>
                <select
                  id="recipient-select"
                  value={isCustomMode ? 'custom' : selectedEmail}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomMode(true);
                    } else {
                      setIsCustomMode(false);
                      setSelectedEmail(e.target.value);
                    }
                  }}
                  className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-semibold text-gray-700 focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {supervisors.map((sup) => (
                    <option key={sup.email} value={sup.email}>
                      {sup.username} ({sup.email})
                    </option>
                  ))}
                  {supervisors.length === 0 && (
                    <option value="workwiththarun@gmail.com">
                      Helen Supervisor (workwiththarun@gmail.com)
                    </option>
                  )}
                  <option value="custom">-- Custom Email Address... --</option>
                </select>
              </div>
              
              {isCustomMode && (
                <div className="animate-fade-in">
                  <label htmlFor="custom-recipient-input" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Enter Custom Email Address</label>
                  <input
                    id="custom-recipient-input"
                    type="email"
                    placeholder="e.g. manager@cat-diagnostics.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary text-sm text-gray-800"
                  />
                </div>
              )}
              
              <p className="text-[11px] text-gray-400 mt-1">
                The fault audit certificate and machinery details will be compiled into the standard Caterpillar engineering email report and sent immediately.
              </p>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-2">
              <button
                onClick={() => setIsMailOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 uppercase"
              >
                Cancel
              </button>
              <button
                onClick={submitSendMail}
                disabled={mailingId !== null}
                className="px-4 py-2 bg-primary hover:bg-yellow-500 text-black rounded text-xs font-bold uppercase transition-colors flex items-center space-x-1"
              >
                {mailingId !== null ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
