'use client';

import React, { useState, useEffect } from 'react';
import { notificationService } from '@/services/api';
import { Bell, ShieldAlert, AlertTriangle, Cpu, Eye, Info, Clock, Check, Send, Trash2, CheckSquare } from 'lucide-react';

interface NotificationSettings {
  critical_enabled: boolean;
  warning_enabled: boolean;
  maintenance_enabled: boolean;
  inspection_enabled: boolean;
  info_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface NotificationHistoryItem {
  id: number;
  title: string;
  body: string;
  category: string;
  machine_id: string | null;
  alert_id: number | null;
  sent_at: string;
  is_read: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsData = await notificationService.getSettings();
      setSettings({
        critical_enabled: settingsData.critical_enabled,
        warning_enabled: settingsData.warning_enabled,
        maintenance_enabled: settingsData.maintenance_enabled,
        inspection_enabled: settingsData.inspection_enabled,
        info_enabled: settingsData.info_enabled,
        quiet_hours_start: settingsData.quiet_hours_start || '',
        quiet_hours_end: settingsData.quiet_hours_end || ''
      });

      const historyData = await notificationService.getHistory();
      setHistory(historyData);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load notification settings or history.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof Omit<NotificationSettings, 'quiet_hours_start' | 'quiet_hours_end'>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const handleTimeChange = (key: 'quiet_hours_start' | 'quiet_hours_end', val: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: val === '' ? null : val
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        ...settings,
        quiet_hours_start: settings.quiet_hours_start || null,
        quiet_hours_end: settings.quiet_hours_end || null
      };
      const updated = await notificationService.updateSettings(payload);
      setSuccessMsg('NOTIFICATION PREFERENCES UPDATED SUCCESSFULLY.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError('Failed to save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await notificationService.testNotification();
      setSuccessMsg('TEST PUSH DISPATCHED. VERIFY ON YOUR DESKTOP.');
      setTimeout(() => setSuccessMsg(null), 4000);
      // Reload history to show test log
      setTimeout(async () => {
        const historyData = await notificationService.getHistory();
        setHistory(historyData);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError('Test push failed. Confirm browser permission is allowed.');
    } finally {
      setTesting(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markRead(id);
      setHistory(prev =>
        prev.map(item => (item.id === id ? { ...item, is_read: true } : item))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const formatTimestamp = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Retrieving System Configurations...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">NOTIFICATION PROFILE CONFIGURATION</h1>
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mt-1">
          Configure real-time native alerts, filters, quiet hours, and test remote messaging systems.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm font-bold uppercase rounded">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 text-sm font-bold uppercase rounded flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: preferences form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">Push Notification Channels</span>
              <span className="text-[10px] bg-primary text-black font-black px-2 py-0.5 rounded font-mono">FCM CONTROL</span>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="space-y-4">
                
                {/* Critical */}
                <div className="flex items-start justify-between p-3.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                  <div className="flex space-x-3">
                    <div className="p-2 bg-red-50 text-red-600 rounded">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900">Critical Machine Alerts</h4>
                      <p className="text-xs text-gray-500">Overheating, total failures, telemetry critical limits (Health Score &le; 20%).</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.critical_enabled}
                    onChange={() => handleToggle('critical_enabled')}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                  />
                </div>

                {/* Warnings */}
                <div className="flex items-start justify-between p-3.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                  <div className="flex space-x-3">
                    <div className="p-2 bg-yellow-50 text-yellow-600 rounded">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900">Warning Threshold Exceeded</h4>
                      <p className="text-xs text-gray-500">Low pressure, slight temperature rises, diagnostic warnings.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.warning_enabled}
                    onChange={() => handleToggle('warning_enabled')}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                  />
                </div>

                {/* Maintenance */}
                <div className="flex items-start justify-between p-3.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                  <div className="flex space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900">Maintenance Events</h4>
                      <p className="text-xs text-gray-500">Scheduled maintenance warnings, machine hours thresholds due.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.maintenance_enabled}
                    onChange={() => handleToggle('maintenance_enabled')}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                  />
                </div>

                {/* Inspection */}
                <div className="flex items-start justify-between p-3.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                  <div className="flex space-x-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900">Computer Vision Inspections</h4>
                      <p className="text-xs text-gray-500">Cracks, structural anomalies, operator safety harness check failures.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.inspection_enabled}
                    onChange={() => handleToggle('inspection_enabled')}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                  />
                </div>

                {/* Info */}
                <div className="flex items-start justify-between p-3.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                  <div className="flex space-x-3">
                    <div className="p-2 bg-gray-50 text-gray-600 rounded">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900">Information Updates</h4>
                      <p className="text-xs text-gray-500">System logins, data sync completions, recovery to healthy status.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.info_enabled}
                    onChange={() => handleToggle('info_enabled')}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <h4 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight">Quiet Hours Configuration</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Mute Start Time</label>
                    <input
                      type="time"
                      value={settings?.quiet_hours_start || ''}
                      onChange={(e) => handleTimeChange('quiet_hours_start', e.target.value)}
                      className="block w-full border border-gray-300 rounded p-2 text-xs focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Mute End Time</label>
                    <input
                      type="time"
                      value={settings?.quiet_hours_end || ''}
                      onChange={(e) => handleTimeChange('quiet_hours_end', e.target.value)}
                      className="block w-full border border-gray-300 rounded p-2 text-xs focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  System will suppress all desktop/browser push events during this period (based on UTC/GMT server coordinates).
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-yellow-500 text-black px-5 py-2 rounded text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right column: test notification and history */}
        <div className="space-y-6">
          
          {/* Dispatch Tester */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">FCM Diagnostic Dispatcher</h3>
            <p className="text-xs text-gray-500">
              Send a test notification packet to this device to check background/foreground service worker operations.
            </p>
            <button
              onClick={handleSendTest}
              disabled={testing}
              className="w-full bg-black hover:bg-gray-800 text-primary px-4 py-2.5 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 shadow"
            >
              <Send className="w-4 h-4" />
              <span>{testing ? 'DISPATCHING...' : 'TEST PUSH DISPATCH'}</span>
            </button>
          </div>

          {/* History */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">Recent Notifications</span>
              <span className="text-[9px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded font-mono">HISTORY</span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                  No notifications recorded.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 transition-colors flex items-start space-x-2.5 relative ${
                      !item.is_read ? 'bg-[#fffae6]/30' : ''
                    }`}
                  >
                    {!item.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        title="Mark as read"
                        className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded text-amber-600 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[9px] font-bold uppercase px-1 rounded ${
                          item.category.toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' :
                          item.category.toLowerCase() === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          item.category.toLowerCase() === 'maintenance' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {item.category}
                        </span>
                        {item.machine_id && (
                          <span className="text-[9px] font-mono text-gray-400 font-semibold">{item.machine_id}</span>
                        )}
                      </div>
                      <h5 className="text-xs font-extrabold text-gray-900 leading-snug">{item.title}</h5>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{item.body}</p>
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{formatTimestamp(item.sent_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
