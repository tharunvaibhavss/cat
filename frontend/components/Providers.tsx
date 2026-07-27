'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authService, notificationService, handoverService, sessionRecoveryService } from '@/services/api';
import NotificationManager from './NotificationManager';

interface User {
  employee_id: string;
  username: string;
  role: string;
  email?: string | null;
  is_department_admin?: boolean;
  id?: string | number;
}

interface AuthContextType {
  user: User | null;
  activeRole: string | null;
  login: (employeeId: string, password: string, rememberMe?: boolean) => Promise<any>;
  logout: () => Promise<void>;
  switchRole: (role: string) => void;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  resetInactivityTimer: () => void;
  deviceId: string | null;
  sessionId: string | null;
  currentDashboardState: any;
  updateDashboardState: (updates: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 10 Minutes total inactivity limit (600 seconds)
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
// Show warning modal when 60 seconds remain (at 9 minutes of idleness)
const WARNING_BUFFER_MS = 60 * 1000;
const WARNING_INITIAL_SECONDS = 60;

// Helper to detect OS/Browser
const getDeviceMeta = () => {
  if (typeof window === 'undefined') return { os: 'Unknown', browser: 'Unknown', name: 'Unknown Device' };
  const userAgent = navigator.userAgent;
  let browser = 'Unknown Browser';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';

  let os = 'Unknown OS';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  let type = 'Desktop';
  if (/Mobi|Android|iPhone/i.test(userAgent)) type = 'Mobile';

  return {
    os,
    browser,
    name: `${browser} on ${os} (${type})`
  };
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Handover state
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentDashboardState, setCurrentDashboardState] = useState<any>({
    current_page: '/dashboard',
    selected_machine: '',
    selected_site: '',
    filters: {},
    dashboard_state: {}
  });

  // Timeout Modal & Countdown state
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_INITIAL_SECONDS);
  const [recoveryPrompt, setRecoveryPrompt] = useState<any>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or fetch stable device_id and session_id
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedDeviceId = localStorage.getItem('handover_device_id');
      if (!storedDeviceId) {
        storedDeviceId = 'device-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
        localStorage.setItem('handover_device_id', storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      let currentSessionId = sessionStorage.getItem('handover_session_id');
      if (!currentSessionId) {
        currentSessionId = 'session-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
        sessionStorage.setItem('handover_session_id', currentSessionId);
      }
      setSessionId(currentSessionId);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setActiveRole(parsed.role);
    }
    setIsLoading(false);
  }, []);

  // Handover: Heartbeat and Session Save timers
  useEffect(() => {
    if (!user || !deviceId || !sessionId) return;

    // A. Register device immediately
    const register = async () => {
      try {
        const meta = getDeviceMeta();
        const fcmToken = localStorage.getItem('fcm_token') || `token-${user.employee_id}-${meta.browser.toLowerCase()}-${meta.os.toLowerCase()}-stable`;
        await handoverService.registerDevice(deviceId, meta.name, meta.browser, meta.os, fcmToken);
      } catch (err) {
        console.error('Failed to register device for handover', err);
      }
    };
    register();

    // B. Send Heartbeat to Session Recovery every 10 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await sessionRecoveryService.sendHeartbeat({
          session_id: sessionId,
          device_id: deviceId,
          current_page: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
          current_module: currentDashboardState.current_module || "Vendor Approval",
          current_task: currentDashboardState.current_task || "Vendor Approval",
          current_form_state: currentDashboardState.current_form_state || {
            vendor_name: "Caterpillar Parts Corp",
            approval_status: "Pending Review",
            priority_level: "High"
          },
          unsaved_changes_count: currentDashboardState.unsaved_changes_count !== undefined ? currentDashboardState.unsaved_changes_count : 3,
          step_progress: currentDashboardState.step_progress || "5 of 8"
        });
      } catch (err) {
        console.error('Failed sending session recovery heartbeat', err);
      }
    }, 10000);

    // C. Periodically save session state every 30 seconds
    const saveStateInterval = setInterval(async () => {
      try {
        await sessionRecoveryService.saveState({
          session_id: sessionId,
          device_id: deviceId,
          current_page: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
          current_module: currentDashboardState.current_module || "Vendor Approval",
          current_task: currentDashboardState.current_task || "Vendor Approval",
          current_form_state: currentDashboardState.current_form_state || {
            vendor_name: "Caterpillar Parts Corp",
            approval_status: "Pending Review",
            priority_level: "High"
          },
          unsaved_changes_count: currentDashboardState.unsaved_changes_count !== undefined ? currentDashboardState.unsaved_changes_count : 3,
          step_progress: currentDashboardState.step_progress || "5 of 8",
          selected_machine: currentDashboardState.selected_machine,
          selected_site: currentDashboardState.selected_site,
          filters: currentDashboardState.filters,
          dashboard_state: currentDashboardState.dashboard_state
        });
      } catch (err) {
        console.error('Failed auto-saving session state', err);
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(saveStateInterval);
    };
  }, [user, deviceId, sessionId, currentDashboardState]);

  // WebSocket client connection for real-time recovery alerts
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    // Ensure we run on backend port 8000
    const wsUrl = `ws://${host}:8000/api/ws/notifications?token=${token}`;
    
    let socket: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[WebSocket] Session Recovery channel established');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Event received:', data);

          if (data.type === 'SESSION_INTERRUPTED') {
            // Show a prompt to same-department authorized users instead of instant redirect
            if (data.session_id !== sessionId) {
               setRecoveryPrompt(data);
            }
          } else if (data.type === 'SESSION_ASSIGNED') {
            if (data.assigned_to === user.employee_id && data.session_id !== sessionId) {
              window.location.href = `/dashboard/resume?session=${data.session_id}`;
            }
          } else if (data.type === 'SESSION_HANDOVER_REQUESTED') {
            if (data.target_session_id === sessionId) {
              window.location.href = `/dashboard/resume?session=${data.session_id}`;
            }
          }
        } catch (err) {
          console.error('[WebSocket] Parsing error:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('[WebSocket] Connection error:', err);
      };

      socket.onclose = (event) => {
        console.log('[WebSocket] Connection closed. Code:', event.code);
        reconnectTimeout = setTimeout(() => {
          if (user) connectWebSocket();
        }, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (socket) socket.close();
      clearTimeout(reconnectTimeout);
    };
  }, [user]);

  // Manual dashboard state updater that triggers instant save
  const updateDashboardState = (updates: any) => {
    setCurrentDashboardState((prev: any) => {
      const nextState = { ...prev, ...updates };
      if (user && deviceId && sessionId) {
        sessionRecoveryService.saveState({
          session_id: sessionId,
          device_id: deviceId,
          current_page: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
          current_module: nextState.current_module || "Vendor Approval",
          current_task: nextState.current_task || "Vendor Approval",
          current_form_state: nextState.current_form_state || {
            vendor_name: "Caterpillar Parts Corp",
            approval_status: "Pending Review",
            priority_level: "High"
          },
          unsaved_changes_count: nextState.unsaved_changes_count !== undefined ? nextState.unsaved_changes_count : 3,
          step_progress: nextState.step_progress || "5 of 8",
          selected_machine: nextState.selected_machine,
          selected_site: nextState.selected_site,
          filters: nextState.filters,
          dashboard_state: nextState.dashboard_state
        }).catch(err => console.error('Failed immediate session save', err));
      }
      return nextState;
    });
  };

  // Inactivity Listeners
  useEffect(() => {
    if (!user) {
      setShowTimeoutWarning(false);
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity));
    lastActivityRef.current = Date.now();

    const interval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityRef.current;
      
      if (inactiveTime >= INACTIVITY_LIMIT_MS) {
        handleAutomaticLogout();
      } else if (inactiveTime >= (INACTIVITY_LIMIT_MS - WARNING_BUFFER_MS)) {
        setShowTimeoutWarning(true);
        setSecondsRemaining(Math.ceil((INACTIVITY_LIMIT_MS - inactiveTime) / 1000));
      } else {
        setShowTimeoutWarning(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
    };
  }, [user]);

  const clearAllTimers = () => {
    // Left for compatibility, not strictly needed for inactivity anymore
  };

  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
  };

  const handleAutomaticLogout = async () => {
    setShowTimeoutWarning(false);
    setUser(null);
    setActiveRole(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/?reason=timeout';
  };

  const login = async (employeeId: string, password: string, rememberMe?: boolean) => {
    setIsLoading(true);
    try {
      const data = await authService.login(employeeId, password, rememberMe);
      const profile = await authService.getProfile();
      const loggedUser = {
        employee_id: profile.employee_id,
        username: profile.username,
        role: profile.role,
        email: profile.email
      };
      localStorage.setItem('user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      setActiveRole(loggedUser.role);
      resetInactivityTimer();
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    clearAllTimers();
    try {
      const token = localStorage.getItem('fcm_token');
      if (token) {
        await notificationService.removeToken(token).catch(err => console.error("FCM token removal failed:", err));
        localStorage.removeItem('fcm_token');
      }
      await authService.logout();
    } catch (e) {
      console.error("Logout API failed, forcing local cleanup", e);
    } finally {
      setUser(null);
      setActiveRole(null);
      setIsLoading(false);
      window.location.href = '/';
    }
  };

  const switchRole = (role: string) => {
    setActiveRole(role);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ 
        user, 
        activeRole, 
        login, 
        logout, 
        switchRole, 
        isLoading, 
        setUser, 
        resetInactivityTimer,
        deviceId,
        sessionId,
        currentDashboardState,
        updateDashboardState
      }}>
        {children}
        <NotificationManager />

        {/* Inactivity Session Timeout Warning Modal */}
        {showTimeoutWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border-2 border-amber-500">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ⚠️
              </div>
              <h3 className="font-extrabold text-base text-gray-900 uppercase">Session Inactivity Timeout</h3>
              <p className="text-xs text-gray-600">
                You have been idle for 9 minutes. For security compliance, your terminal session will auto-terminate in:
              </p>
              <div className="text-3xl font-black font-mono text-rose-600 my-2">
                {secondsRemaining}s
              </div>
              <div className="pt-2 flex space-x-2">
                <button
                  onClick={() => handleAutomaticLogout()}
                  className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded uppercase"
                >
                  Logout Now
                </button>
                <button
                  onClick={() => resetInactivityTimer()}
                  className="flex-1 px-3 py-2 bg-primary hover:bg-yellow-500 text-black text-xs font-extrabold rounded uppercase"
                >
                  Stay Logged In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Handover Prompt Modal -> Top Right Push Notification style */}
        {recoveryPrompt && (
          <div className="fixed top-5 right-5 z-50 flex items-start justify-end p-4 animate-fade-in pointer-events-none">
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-5 space-y-3 border-l-4 border-emerald-500 pointer-events-auto">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                  🔄
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Session Handover</h3>
                  <p className="text-xs text-gray-500 font-medium">Session disconnected for <strong className="text-emerald-700">{recoveryPrompt.employee}</strong></p>
                </div>
              </div>
              
              <div className="text-left text-[11px] bg-gray-50 border border-gray-100 p-2.5 rounded space-y-1">
                <div><span className="font-semibold text-gray-700">Module:</span> <span className="text-gray-600">{recoveryPrompt.module}</span></div>
                <div><span className="font-semibold text-gray-700">Task:</span> <span className="text-gray-600">{recoveryPrompt.task}</span></div>
                <div><span className="font-semibold text-gray-700">Device:</span> <span className="text-gray-600">{recoveryPrompt.device}</span></div>
              </div>
              
              <div className="pt-1 flex space-x-2">
                <button
                  onClick={() => setRecoveryPrompt(null)}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded uppercase transition-colors"
                >
                  Ignore
                </button>
                <button
                  onClick={() => window.location.href = `/dashboard/resume?session=${recoveryPrompt.session_id}`}
                  className="flex-[2] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded uppercase shadow-sm transition-colors"
                >
                  Take Over Session
                </button>
              </div>
            </div>
          </div>
        )}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
