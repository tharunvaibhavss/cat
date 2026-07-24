'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authService, notificationService, handoverService } from '@/services/api';
import NotificationManager from './NotificationManager';

interface User {
  employee_id: string;
  username: string;
  role: string;
  email?: string | null;
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

    // B. Send Heartbeat every 20 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await handoverService.sendHeartbeat(deviceId, sessionId);
      } catch (err) {
        console.error('Failed sending heartbeat', err);
      }
    }, 20000);

    // C. Periodically save session state every 30 seconds
    const saveStateInterval = setInterval(async () => {
      try {
        await handoverService.saveSession({
          session_id: sessionId,
          device_id: deviceId,
          ...currentDashboardState
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

  // Manual dashboard state updater that triggers instant save
  const updateDashboardState = (updates: any) => {
    setCurrentDashboardState((prev: any) => {
      const nextState = { ...prev, ...updates };
      // Save state immediately on navigation, selection or filters update
      if (user && deviceId && sessionId) {
        handoverService.saveSession({
          session_id: sessionId,
          device_id: deviceId,
          ...nextState
        }).catch(err => console.error('Failed immediate session save', err));
      }
      return nextState;
    });
  };

  // Inactivity Listeners
  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setShowTimeoutWarning(false);
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      if (showTimeoutWarning) {
        // If warning modal is open, user activity resets warning
        resetInactivityTimer();
      }
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity));
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearAllTimers();
    };
  }, [user]);

  const clearAllTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const resetInactivityTimer = () => {
    clearAllTimers();
    setShowTimeoutWarning(false);
    setSecondsRemaining(WARNING_INITIAL_SECONDS);

    if (!user) return;

    // Set timer for warning display (45 seconds)
    warningTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
      setSecondsRemaining(WARNING_INITIAL_SECONDS);

      // Start countdown ticker
      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_LIMIT_MS - WARNING_BUFFER_MS);

    // Set hard logout timer (60 seconds)
    logoutTimerRef.current = setTimeout(() => {
      handleAutomaticLogout();
    }, INACTIVITY_LIMIT_MS);
  };

  const handleAutomaticLogout = async () => {
    clearAllTimers();
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
