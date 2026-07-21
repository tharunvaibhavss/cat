'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { Lock, User, AlertCircle, Cpu } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
    if (typeof window !== 'undefined' && window.location.search.includes('reason=timeout')) {
      setError('SESSION EXPIRED: You were automatically logged out due to 15 minutes of inactivity.');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(employeeId, password, rememberMe);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        'Connection failure. Verify the backend Uvicorn service is active.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#111] bg-radial-gradient from-gray-900 to-black p-4">
      {/* Visual background grid pattern to mimic industrial styling */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29371a_1px,transparent_1px),linear-gradient(to_bottom,#1f29371a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        
        {/* Decorative Caterpillar yellow accent top bar */}
        <div className="h-2 w-full bg-primary rounded-t-lg" />
        
        <div className="bg-white p-8 rounded-b-lg shadow-2xl border border-gray-200">
          
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-lg text-primary font-black text-2xl mb-3 shadow-md">
              CAT
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
              DIAGNOSTICS & SYSTEM AUDIT
            </h1>
            <p className="text-xs text-gray-500 mt-1 uppercase font-semibold tracking-wider">
              Industrial Service Portal
            </p>
          </div>

          {error && (
            <div className="flex items-center space-x-2 bg-red-50 border-l-4 border-red-500 p-3 mb-6 rounded text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                Employee ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-ENG01"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary-dark transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("Password reset workflow: Contact your Caterpillar Site Administrator to request a passcode override.")}
                  className="text-xs font-semibold text-primary-dark hover:underline hover:text-black"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary-dark transition-all"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="remember_me" className="ml-2 block text-xs font-bold text-gray-700 uppercase cursor-pointer select-none">
                Remember this terminal
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary-dark text-black py-2.5 px-4 rounded-md font-bold text-sm tracking-wide shadow hover:shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>AUTHORIZING UNIT...</span>
                </>
              ) : (
                <span>ACCESS SYSTEM CONTROL</span>
              )}
            </button>
          </form>

          {/* Quick Sandbox Help Info */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <div className="inline-flex items-center space-x-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-mono">
              <Cpu className="w-3.5 h-3.5" />
              <span>Diagnostic Sandbox accounts</span>
            </div>
            <div className="mt-2 text-left bg-gray-50 border border-gray-200 rounded p-2 text-[10px] text-gray-500 font-mono space-y-1">
              <div><span className="font-bold text-gray-700">Admin:</span> EMP-ADMIN01 / admin123</div>
              <div><span className="font-bold text-gray-700">Engineer:</span> EMP-ENG01 / eng123</div>
              <div><span className="font-bold text-gray-700">Operator:</span> EMP-OP01 / op123</div>
              <div><span className="font-bold text-gray-700">Supervisor:</span> EMP-SUP01 / sup123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
