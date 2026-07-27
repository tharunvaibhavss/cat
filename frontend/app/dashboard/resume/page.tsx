'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { handoverService, sessionRecoveryService } from '@/services/api';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function ResumePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, deviceId, updateDashboardState } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (!user || !deviceId || !sessionId) {
      if (!user) {
        setStatus('error');
        setErrorMsg('Please log in first before resuming the session.');
      } else if (!sessionId) {
        setStatus('error');
        setErrorMsg('Missing session identifier in URL.');
      }
      return;
    }

    const performResume = async () => {
      try {
        // 1. Transfer active session role to this device using the recovery lock
        await sessionRecoveryService.resumeSession(sessionId);
        
        // 2. Fetch the stored workspace state from recovery service
        const sessionState = await sessionRecoveryService.getRecoverySession(sessionId);

        // 3. Update Providers state locally
        updateDashboardState({
          current_page: sessionState.current_page || '/dashboard',
          selected_machine: sessionState.selected_machine || '',
          selected_site: sessionState.selected_site || '',
          filters: sessionState.filters || {},
          dashboard_state: sessionState.dashboard_state || {}
        });

        // Save session_id in sessionStorage to persist it during this session
        sessionStorage.setItem('handover_session_id', sessionId);

        setStatus('success');
        
        // Redirect back to the exact page where the user left off
        setTimeout(() => {
                    const targetPage = sessionState.current_page || '/dashboard';
          const separator = targetPage.includes('?') ? '&' : '?';
          router.push(targetPage + separator + 'recovered=true');
        }, 1500);

      } catch (err: any) {
        console.error('Session resume process failed', err);
        setStatus('error');
        setErrorMsg(err.response?.data?.detail || err.message || 'Failed to resume session');
      }
    };

    performResume();
  }, [user, deviceId, sessionId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <div className="flex flex-col items-center text-center space-y-4">
            
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <h2 className="text-xl font-extrabold text-gray-900">Resuming Monitoring Session</h2>
                <p className="text-sm text-gray-500">
                  Retrieving workspace configuration from the secure gateway...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
                <h2 className="text-xl font-extrabold text-gray-900">Session Handover Complete</h2>
                <p className="text-sm text-emerald-600 font-semibold">
                  Restored workspace state successfully. Redirecting you...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-extrabold text-gray-900">Resume Session Failed</h2>
                <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded border border-red-200 w-full">
                  {errorMsg}
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-4 px-4 py-2 bg-primary hover:bg-yellow-500 text-black text-xs font-bold rounded uppercase tracking-wider"
                >
                  Go to Dashboard
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>}>
      <ResumePageContent />
    </Suspense>
  );
}

