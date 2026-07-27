'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { sessionRecoveryService } from '@/services/api';
import { AlertCircle, Lock, ShieldAlert, Users, Play, Eye, X, ClipboardList, Clock, AlertTriangle } from 'lucide-react';

interface SessionData {
  session_id: string;
  user_id: number;
  username?: string;
  department?: string;
  device_id?: string;
  active_device?: string;
  current_page?: string;
  current_module?: string;
  current_task?: string;
  current_form_state?: any;
  unsaved_changes_count: number;
  step_progress?: string;
  status: string;
  locked_by?: number;
  last_updated: string;
  last_activity_time: string;
}

interface AuditLog {
  id: number;
  session_id: string;
  user_id?: number;
  username?: string;
  department?: string;
  device?: string;
  timestamp: string;
  action: string;
  status?: string;
}

interface Employee {
  employee_id: string;
  username: string;
  role: string;
}

export default function SessionRecoveryPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedSuccess, setAssignedSuccess] = useState<string | null>(null);
  
  const [timeSinceFailure, setTimeSinceFailure] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessionAndLogs = async () => {
    try {
      setError(null);
      const data = await sessionRecoveryService.getRecoverySession(sessionId);
      setSessionData(data);
      
      const logs = await sessionRecoveryService.getSessionAuditLogs(sessionId);
      setAuditLogs(logs);

      if (data.last_activity_time) {
        const lastAct = new Date(data.last_activity_time).getTime();
        const diffSeconds = Math.max(0, Math.floor((Date.now() - lastAct) / 1000));
        setTimeSinceFailure(diffSeconds);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch session recovery information.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const list = await sessionRecoveryService.getDepartmentEmployees();
      setEmployees(list);
    } catch (err) {
      console.error('Failed to load department backup employees', err);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    
    fetchSessionAndLogs();
    fetchEmployees();

    pollIntervalRef.current = setInterval(() => {
      fetchSessionAndLogs();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, sessionId]);

  useEffect(() => {
    if (!sessionData) return;
    const timer = setInterval(() => {
      setTimeSinceFailure(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionData]);

  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes} Minute${minutes > 1 ? 's' : ''} ${seconds} Second${seconds > 1 ? 's' : ''}`;
    }
    return `${totalSeconds} Second${totalSeconds !== 1 ? 's' : ''}`;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return "11:32 AM";
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await sessionRecoveryService.resumeSession(sessionId);
      router.push(`/dashboard?recovered_session=${sessionId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'This session is already being recovered by another authorized user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReadOnly = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await sessionRecoveryService.getReadOnlySession(sessionId);
      router.push(`/dashboard?recovered_session=${sessionId}&mode=readonly`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to open session in read-only mode.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeId) return;
    try {
      setActionLoading(true);
      setError(null);
      setAssignedSuccess(null);
      const res = await sessionRecoveryService.assignSessionEmployee(sessionId, selectedEmployeeId);
      setAssignedSuccess(res.message || 'Session successfully assigned.');
      setShowAssignDropdown(false);
      fetchSessionAndLogs();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to assign session to backup employee.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary border-r-2 mb-4" />
        <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">Accessing Recovery Server...</p>
      </div>
    );
  }

  const isUserAdmin = user?.is_department_admin || user?.role === 'Administrator';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col p-6 font-sans relative overflow-x-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-neutral-900 z-10">
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-yellow-500 text-black font-black text-lg rounded">CAT</div>
          <span className="text-sm font-bold uppercase tracking-wider text-neutral-400">
            Enterprise Failover Platform
          </span>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-3 py-1 text-xs font-bold uppercase border border-neutral-800 hover:border-neutral-700 rounded transition-all flex items-center space-x-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      <div className="max-w-4xl w-full mx-auto mt-8 flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 z-10">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden relative">
            <div className="h-1.5 w-full bg-yellow-500" />
            <div className="p-6 space-y-6">
              
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white uppercase flex items-center space-x-2">
                    <ShieldAlert className="text-yellow-500 w-7 h-7" />
                    <span>Session Recovery</span>
                  </h1>
                  <p className="text-xs text-neutral-400 mt-1 uppercase font-semibold tracking-wider font-mono">
                    System Interruption Handover Node
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-black uppercase tracking-wider">
                  {sessionData?.status}
                </span>
              </div>

              {error && (
                <div className="flex items-start space-x-2.5 bg-red-950/40 border border-red-900/50 p-4 rounded text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Access Restriction:</span> {error}
                  </div>
                </div>
              )}

              {assignedSuccess && (
                <div className="flex items-start space-x-2.5 bg-emerald-950/40 border border-emerald-900/50 p-4 rounded text-emerald-200 text-sm">
                  <AlertCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Success:</span> {assignedSuccess}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-4 border-t border-b border-neutral-800/60 font-mono text-sm">
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Employee</span>
                  <span className="text-white font-extrabold">{sessionData?.username || "Keshava"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Department</span>
                  <span className="text-white font-extrabold">{sessionData?.department || "Vendor Management"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Current Module</span>
                  <span className="text-white font-extrabold">{sessionData?.current_module || "Vendor Approval"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Current Step</span>
                  <span className="text-white font-extrabold">{sessionData?.step_progress || "5 of 8"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Current Page</span>
                  <span className="text-white font-extrabold">{sessionData?.current_page || "Vendor Details"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Unsaved Changes</span>
                  <span className="text-yellow-400 font-extrabold">{sessionData?.unsaved_changes_count || 3} Fields</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Device</span>
                  <span className="text-white font-extrabold">{sessionData?.device_id || "Laptop A"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase">Interrupted At</span>
                  <span className="text-white font-extrabold">{sessionData ? formatTime(sessionData.last_activity_time) : "11:32 AM"}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-neutral-950 p-4 rounded-lg border border-neutral-850">
                <Clock className="text-yellow-500 w-6 h-6 flex-shrink-0 animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-neutral-500 block uppercase font-mono">Time Since Failure</span>
                  <span className="text-lg font-black text-white font-mono">{formatSeconds(timeSinceFailure)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleResume}
                  disabled={actionLoading || (sessionData?.locked_by !== undefined && sessionData.locked_by !== null && sessionData.locked_by !== user?.id)}
                  className="px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-xs rounded transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Resume Session</span>
                </button>

                <button
                  onClick={handleReadOnly}
                  disabled={actionLoading}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-750 text-white font-black uppercase text-xs rounded transition-all border border-neutral-700 flex items-center justify-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Read Only</span>
                </button>
              </div>

            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 flex items-center space-x-2">
              <ClipboardList className="w-4 h-4 text-yellow-500" />
              <span>Real-Time Recovery Audit Log</span>
            </h3>

            <div className="border border-neutral-850 rounded-lg overflow-hidden bg-neutral-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-neutral-900/60 border-b border-neutral-850 text-neutral-500 uppercase font-black">
                    <th className="p-3 w-24">Time</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3 w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/50 text-neutral-300">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01]">
                      <td className="p-3 text-neutral-500">{formatTime(log.timestamp)}</td>
                      <td className="p-3 font-semibold text-neutral-400">{log.username || "System"}</td>
                      <td className="p-3 text-white">{log.action}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[10px] ${
                          log.status?.toLowerCase().includes('success') || log.status?.toLowerCase().includes('active') || log.status?.toLowerCase().includes('restored')
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status?.toLowerCase().includes('fail') || log.status?.toLowerCase().includes('lost')
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {log.status || "Completed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-neutral-600">No audit records generated.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center space-x-2">
                <Users className="w-4 h-4 text-yellow-500" />
                <span>Backup Delegation</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Department Administrators can assign this interrupted session to another active backup employee.
              </p>
            </div>

            {isUserAdmin ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-white font-bold text-xs uppercase tracking-wider rounded border border-neutral-700 flex items-center justify-between"
                >
                  <span>Assign Another Employee</span>
                  <Users className="w-3.5 h-3.5" />
                </button>

                {showAssignDropdown && (
                  <div className="space-y-3 p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      Select Backup Employee
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    >
                      <option value="">-- Choose Online Employee --</option>
                      {employees
                        .filter(emp => emp.employee_id !== sessionData?.device_id)
                        .map(emp => (
                          <option key={emp.employee_id} value={emp.employee_id}>
                            {emp.username} ({emp.role})
                          </option>
                        ))}
                    </select>

                    <button
                      onClick={handleAssignEmployee}
                      disabled={actionLoading || !selectedEmployeeId}
                      className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-xs rounded transition-all disabled:opacity-50"
                    >
                      Confirm Assignment
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-850 flex items-start space-x-2 text-xs text-neutral-500">
                <Lock className="w-4 h-4 text-neutral-600 flex-shrink-0 mt-0.5" />
                <span>
                  Admin Delegation control locked. You must be a Department Administrator to assign this session.
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-neutral-800/60 space-y-3">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block font-mono">
                Recovery Timeout Policy
              </span>
              <div className="p-3.5 bg-neutral-950/60 rounded-lg border border-neutral-850 text-xs text-neutral-400 space-y-2 leading-relaxed">
                <div className="flex items-center space-x-1.5 text-yellow-500 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>5-Minute Deadline</span>
                </div>
                <p>
                  If this session is not recovered within **5 minutes** (300 seconds), a system alarm will alert the Department Administrator again to enforce failover closure or delegate backup.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
