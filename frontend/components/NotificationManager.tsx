'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/Providers';
import { notificationService } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, X, AlertTriangle, Info, ShieldAlert, Cpu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface InAppToast {
  id: number;
  title: string;
  body: string;
  category: string;
  machine_id?: string;
  alert_id?: number;
}

export default function NotificationManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<InAppToast[]>([]);
  const lastNotificationIdRef = useRef<number>(-1);
  const isPolledRef = useRef<boolean>(false);
  const fcmRegisteredRef = useRef<boolean>(false);

  // Helper to parse browser name
  const getBrowserDetails = () => {
    if (typeof window === 'undefined') return { browser: 'Unknown', device: 'Unknown' };
    const userAgent = navigator.userAgent;
    let browser = 'Other';
    if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (userAgent.indexOf('SamsungBrowser') > -1) browser = 'Samsung Browser';
    else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) browser = 'Opera';
    else if (userAgent.indexOf('Trident') > -1) browser = 'Internet Explorer';
    else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) browser = 'Edge';
    else if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (userAgent.indexOf('Safari') > -1) browser = 'Safari';

    let device = 'Desktop';
    if (/Mobi|Android|iPhone/i.test(userAgent)) {
      device = 'Mobile';
    }
    return { browser, device };
  };

  // 1. Service Worker & FCM Registration
  useEffect(() => {
    if (!user) {
      fcmRegisteredRef.current = false;
      return;
    }

    if (fcmRegisteredRef.current) return;
    fcmRegisteredRef.current = true;

    const setupNotifications = async () => {
      try {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[NotificationManager] Service Worker registered with scope:', registration.scope);
        }

        // Request Permission
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          console.log('[NotificationManager] Permission status:', permission);
          
          if (permission === 'granted') {
            // Generate a token. In a full production setup, you would use:
            // const token = await getToken(messaging, { vapidKey: '...' })
            // Here, we generate a highly unique and stable token per user/device
            const { browser, device } = getBrowserDetails();
            const token = `token-${user.employee_id}-${browser.toLowerCase()}-${device.toLowerCase()}-stable`;
            
            // Register token with backend
            await notificationService.registerToken(token, browser, `${device} (Simulated)`);
            console.log('[NotificationManager] FCM Token registered:', token);

            // Save token locally for logout cleanup
            localStorage.setItem('fcm_token', token);
          }
        }
      } catch (err) {
        console.error('[NotificationManager] Error setting up FCM registration:', err);
      }
    };

    setupNotifications();
  }, [user]);

  // 2. Poll for Notification History to show foreground alerts & trigger refreshes
  useEffect(() => {
    if (!user) {
      lastNotificationIdRef.current = -1;
      isPolledRef.current = false;
      return;
    }

    const pollNotifications = async () => {
      try {
        const history = await notificationService.getHistory();
        if (!history || history.length === 0) return;

        // On first load, initialize the lastSeenId
        if (!isPolledRef.current) {
          const maxId = Math.max(...history.map((h: any) => h.id));
          lastNotificationIdRef.current = maxId;
          isPolledRef.current = true;
          return;
        }

        // Filter new notifications
        const newNotifications = history.filter((h: any) => h.id > lastNotificationIdRef.current);
        if (newNotifications.length > 0) {
          // Update ref with highest ID
          const maxId = Math.max(...newNotifications.map((h: any) => h.id));
          lastNotificationIdRef.current = maxId;

          // Invalidate React Query caches to trigger UI auto-refreshes
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['notifications-history'] });

          // Dispatch notification actions
          newNotifications.reverse().forEach((notif: any) => {
            // A. Show In-App Custom Toast
            const toastId = Date.now() + Math.random();
            setToasts((prev) => [...prev, {
              id: toastId,
              title: notif.title,
              body: notif.body,
              category: notif.category,
              machine_id: notif.machine_id,
              alert_id: notif.alert_id
            }]);

            // B. Show Browser Native Notification if allowed
            if (Notification.permission === 'granted') {
              const nativeNotif = new Notification(notif.title, {
                body: notif.body,
                icon: '/favicon.ico',
                tag: `cat-${notif.machine_id || 'general'}-${notif.alert_id || 'event'}`
              });

              nativeNotif.onclick = () => {
                window.focus();
                // Redirect user to the corresponding machine page
                if (notif.machine_id) {
                  window.location.href = `/dashboard?machine_id=${notif.machine_id}${notif.alert_id ? `&alert_id=${notif.alert_id}` : ''}`;
                }
              };
            }
          });
        }
      } catch (err) {
        console.error('[NotificationManager] Error polling notifications:', err);
      }
    };

    // Poll immediately, then every 5 seconds
    pollNotifications();
    const interval = setInterval(pollNotifications, 5000);

    return () => clearInterval(interval);
  }, [user, queryClient]);

    // 3. Handle recovered=true query parameter to show a toast
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('recovered') === 'true') {
        const toastId = Date.now() + Math.random();
        setToasts((prev) => [...prev, {
          id: toastId,
          title: 'Session Restored',
          body: 'Your device is now connected and has taken over the active session.',
          category: 'Maintenance',
          machine_id: undefined,
          alert_id: undefined
        }]);
        // Remove the query parameter without reloading
        url.searchParams.delete('recovered');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToastClick = (toast: InAppToast) => {
    removeToast(toast.id);
    if (toast.machine_id) {
      window.location.href = `/dashboard?machine_id=${toast.machine_id}${toast.alert_id ? `&alert_id=${toast.alert_id}` : ''}`;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          // Choose toast color scheme
          let bgColor = 'bg-gray-900 border-gray-700 text-white';
          let Icon = Info;
          let badgeColor = 'bg-blue-600';

          if (toast.category.toLowerCase() === 'critical') {
            bgColor = 'bg-[#1e1414] border-red-900/50 text-red-100 shadow-red-950/20';
            Icon = ShieldAlert;
            badgeColor = 'bg-red-600 text-white';
          } else if (toast.category.toLowerCase() === 'warning') {
            bgColor = 'bg-[#1f1b14] border-yellow-900/50 text-yellow-100 shadow-yellow-950/20';
            Icon = AlertTriangle;
            badgeColor = 'bg-yellow-500 text-black';
          } else if (toast.category.toLowerCase() === 'maintenance') {
            bgColor = 'bg-[#141a1e] border-blue-900/50 text-blue-100';
            Icon = Cpu;
            badgeColor = 'bg-blue-500 text-white';
          } else if (toast.category.toLowerCase() === 'inspection') {
            bgColor = 'bg-[#141e17] border-emerald-900/50 text-emerald-100';
            Icon = Bell;
            badgeColor = 'bg-emerald-500 text-white';
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              transition={{ duration: 0.25 }}
              className={`p-4 rounded-lg border shadow-xl flex items-start space-x-3 cursor-pointer relative overflow-hidden backdrop-blur-md ${bgColor}`}
              onClick={() => handleToastClick(toast)}
            >
              {/* Header/Status strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-10" />

              <div className={`p-1.5 rounded-md ${badgeColor} flex-shrink-0 mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 space-y-1 pr-6">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {toast.category} Alert
                  </span>
                  {toast.machine_id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono text-gray-300">
                      {toast.machine_id}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-extrabold tracking-tight leading-snug">
                  {toast.title}
                </h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed line-clamp-2">
                  {toast.body}
                </p>
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider pt-1 flex items-center space-x-1">
                  <span>Click to view diagnostics</span>
                  <span>→</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

