'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { edgeService } from '@/services/api';
import { 
  LayoutDashboard, 
  Cpu, 
  FileText, 
  Users, 
  LogOut, 
  Wrench, 
  Activity, 
  Menu, 
  X,
  User as UserIcon,
  ShieldCheck,
  Bell,
  Settings,
  Globe,
  Box,
  Camera,
  ClipboardList,
  Bot,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, activeRole, switchRole, logout, setUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [myEmail, setMyEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  
  // Edge AI state
  const [edgeStatus, setEdgeStatus] = useState<any>(null);
  const [syncingEdge, setSyncingEdge] = useState(false);

  useEffect(() => {
    fetchEdgeStatus();
  }, []);

  const fetchEdgeStatus = async () => {
    try {
      const status = await edgeService.getStatus();
      setEdgeStatus(status);
    } catch (e) {
      console.error('Failed to load edge status', e);
    }
  };

  const handleToggleEdge = async () => {
    try {
      const updated = await edgeService.toggle(!edgeStatus?.is_offline_mode);
      setEdgeStatus(updated);
    } catch (e) {
      console.error('Failed to toggle edge mode', e);
    }
  };

  const handleSyncEdge = async () => {
    setSyncingEdge(true);
    try {
      const res = await edgeService.sync();
      setEdgeStatus(res.edge_state);
    } catch (e) {
      console.error('Failed to sync edge', e);
    } finally {
      setSyncingEdge(false);
    }
  };

  // Define navigation items based on active role permissions
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Administrator', 'Maintenance Engineer', 'Operator', 'Supervisor'] },
    { name: 'Machine Fleet', href: '/dashboard/machines', icon: Cpu, roles: ['Administrator', 'Maintenance Engineer', 'Operator', 'Supervisor'] },
    { name: 'Multi-Site Fleet', href: '/dashboard/sites', icon: Globe, roles: ['Administrator', 'Maintenance Engineer', 'Supervisor'] },
    { name: 'Digital Twin', href: '/dashboard/digital-twin', icon: Box, roles: ['Administrator', 'Maintenance Engineer', 'Supervisor'] },
    { name: 'Diagnostic Bench', href: '/dashboard/diagnostics', icon: Wrench, roles: ['Administrator', 'Maintenance Engineer', 'Operator'] },
    { name: 'Vision Inspection', href: '/dashboard/vision', icon: Camera, roles: ['Administrator', 'Maintenance Engineer', 'Operator'] },
    { name: 'Work Orders', href: '/dashboard/work-orders', icon: ClipboardList, roles: ['Administrator', 'Maintenance Engineer', 'Supervisor'] },
    { name: 'AI Assistant', href: '/dashboard/assistant', icon: Bot, roles: ['Administrator', 'Maintenance Engineer', 'Operator', 'Supervisor'] },
    { name: 'PDF Reports', href: '/dashboard/reports', icon: FileText, roles: ['Administrator', 'Maintenance Engineer', 'Supervisor'] },
    { name: 'Alert Log', href: '/dashboard/alerts', icon: Bell, roles: ['Administrator', 'Maintenance Engineer', 'Operator', 'Supervisor'] },
    { name: 'User Management', href: '/dashboard/users', icon: Users, roles: ['Administrator'] }
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(activeRole || ''));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ----------------- SIDEBAR (DESKTOP) ----------------- */}
      <aside className="hidden md:flex md:flex-col md:w-64 sidebar-dark border-r border-gray-800 flex-shrink-0">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between h-16 px-6 bg-black border-b border-gray-900">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center font-black text-black text-lg">
              CAT
            </div>
            <span className="font-extrabold text-sm tracking-widest text-white">MONITORING</span>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-semibold rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'sidebar-active-link font-bold'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Account */}
        <div className="p-4 border-t border-gray-800 bg-[#151515]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-gray-800 rounded-full text-primary flex-shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden w-24">
                <p className="text-xs font-bold text-white truncate">{user?.username}</p>
                <p className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">{user?.employee_id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => {
                  setMyEmail(user?.email || '');
                  setEmailMsg('');
                  setProfileOpen(true);
                }} 
                className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-gray-800 transition-colors"
                title="Edit Profile Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={logout} 
                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-800 transition-colors"
                title="Logout from terminal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ----------------- MOBILE SIDEBAR DIALOG ----------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 max-w-xs sidebar-dark border-r border-gray-800 h-full z-50">
            <div className="flex items-center justify-between h-16 px-6 bg-black">
              <span className="font-extrabold text-sm tracking-widest text-primary">CAT MONITORING</span>
              <button onClick={() => setMobileOpen(false)} className="text-white hover:text-primary">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-semibold rounded-md ${
                      isActive
                        ? 'sidebar-active-link font-bold'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-800 bg-[#151515] flex items-center justify-between">
              <div className="flex items-center space-x-3 text-left overflow-hidden">
                <UserIcon className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="overflow-hidden w-28">
                  <p className="text-xs font-bold text-white truncate">{user?.username}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{user?.employee_id}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => {
                    setMobileOpen(false);
                    setMyEmail(user?.email || '');
                    setEmailMsg('');
                    setProfileOpen(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-gray-800"
                  title="Profile Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-800">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ----------------- MAIN WORKSPACE CONTENT AREA ----------------- */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setMobileOpen(true)} 
              className="p-1 -ml-1 text-gray-500 rounded-md md:hidden hover:text-gray-900 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center space-x-2 text-sm font-medium text-gray-600">
              <Activity className="w-4 h-4 text-primary-dark" />
              <span>Heavy Machinery Real-Time Platform</span>
            </div>

            {/* Offline Edge AI Gateway Indicator */}
            {edgeStatus && (
              <div className="flex items-center space-x-2 bg-gray-100 border border-gray-200 px-3 py-1 rounded text-xs">
                {edgeStatus.is_offline_mode ? (
                  <span className="flex items-center text-amber-600 font-bold">
                    <WifiOff className="w-3.5 h-3.5 mr-1" /> EDGE OFFLINE ({edgeStatus.buffer_count} Buffered)
                  </span>
                ) : (
                  <span className="flex items-center text-emerald-600 font-bold">
                    <Wifi className="w-3.5 h-3.5 mr-1" /> EDGE ONLINE
                  </span>
                )}
                <button
                  onClick={handleToggleEdge}
                  className="text-[10px] uppercase font-bold text-gray-500 hover:text-black underline ml-1 cursor-pointer"
                >
                  {edgeStatus.is_offline_mode ? 'Go Online' : 'Simulate Offline'}
                </button>
                {edgeStatus.buffer_count > 0 && (
                  <button
                    onClick={handleSyncEdge}
                    disabled={syncingEdge}
                    className="flex items-center text-[10px] uppercase font-bold bg-primary px-2 py-0.5 rounded text-black hover:bg-yellow-500 cursor-pointer ml-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 mr-1 ${syncingEdge ? 'animate-spin' : ''}`} /> Sync
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Session & Dynamic Role Switcher (RBAC Tester) */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className={`flex items-center bg-gray-100 border border-gray-300 rounded-md p-1 shadow-sm ${user.role === 'Administrator' ? 'pr-3' : 'pr-1'}`}>
                <div className="flex items-center px-3 py-1 bg-industrial-dark text-white rounded text-xs font-mono font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  ROLE: {activeRole}
                </div>
                
                {/* Role Switcher Dropdown only accessible to Administrator */}
                {user.role === 'Administrator' && (
                  <select
                    value={activeRole || ''}
                    onChange={(e) => switchRole(e.target.value)}
                    className="text-xs font-semibold bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-2 cursor-pointer"
                    title="Dynamic RBAC Switcher (Prototype utility)"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Maintenance Engineer">Maintenance Engineer</option>
                    <option value="Operator">Operator</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Scrolling View */}
        <main className="flex-1 overflow-y-auto focus:outline-none bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* ----------------- PROFILE SETTINGS MODAL ----------------- */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-black text-white border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-widest text-primary uppercase">Profile Configurations</h3>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employee Account</label>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-bold text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{user?.employee_id} &bull; {activeRole}</p>
                </div>
              </div>
              <div>
                <label htmlFor="profile-email-input" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Supervisor / Contact Email</label>
                <input
                  id="profile-email-input"
                  type="email"
                  placeholder="e.g. supervisor@gmail.com"
                  value={myEmail}
                  onChange={(e) => setMyEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary text-sm text-gray-800"
                />
                <p className="text-[11px] text-gray-400 mt-1">This email address will be notified when critical machine faults are detected.</p>
              </div>
              {emailMsg && (
                <div className={`p-3 rounded text-xs font-semibold ${emailMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {emailMsg}
                </div>
              )}
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-2">
              <button
                onClick={() => setProfileOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 uppercase"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setSavingEmail(true);
                  setEmailMsg('');
                  try {
                    const { userService } = await import('@/services/api');
                    const updated = await userService.updateMyEmail(myEmail);
                    setUser(prev => prev ? { ...prev, email: updated.email } : null);
                    const savedUser = localStorage.getItem('user');
                    if (savedUser) {
                      const parsed = JSON.parse(savedUser);
                      parsed.email = updated.email;
                      localStorage.setItem('user', JSON.stringify(parsed));
                    }
                    setEmailMsg('Email updated successfully!');
                  } catch (e: any) {
                    setEmailMsg('Error: ' + (e.response?.data?.detail || e.message || 'Failed to update email.'));
                  } finally {
                    setSavingEmail(false);
                  }
                }}
                disabled={savingEmail}
                className="px-4 py-2 bg-primary hover:bg-yellow-500 text-black rounded text-xs font-bold uppercase transition-colors"
              >
                {savingEmail ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
