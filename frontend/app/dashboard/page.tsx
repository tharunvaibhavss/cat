'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/services/api';
import { useAuth } from '@/components/Providers';
import { 
  Cpu, 
  CheckCircle, 
  AlertTriangle, 
  XOctagon, 
  FileText, 
  Bell, 
  Play, 
  Users, 
  RefreshCw,
  Clock,
  Wrench
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';

export default function DashboardPage() {
  const { activeRole } = useAuth();
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  // Avoid hydration mismatch for Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: dashboardService.getData,
    refetchInterval: 10000, // Auto refresh every 10s for real-time look
  });

  if (isLoading || !mounted) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-24 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded border border-gray-200 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-white rounded border border-gray-200 animate-pulse" />
          <div className="h-96 bg-white rounded border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-industrial bg-white p-8 text-center space-y-4 my-6">
        <AlertTriangle className="w-12 h-12 text-warning mx-auto animate-pulse" />
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase">Gateway Connection Disrupted</h3>
          <p className="text-xs text-gray-500 mt-1">Unable to load dashboard telemetry feeds from the backend diagnostic gateway.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded text-xs font-bold uppercase transition-all shadow-sm cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { summary, charts, recent_diagnostics, recent_reports, timeline } = data;

  const COLORS = ['#10B981', '#F59E0B', '#EF4444']; // Green, Yellow, Red

  return (
    <div className="space-y-6">
      
      {/* ----------------- TOP BAR / TITLE ----------------- */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">OPERATIONAL DASHBOARD</h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Caterpillar Machinery Diagnostics and Telemetry Fleet Overview
          </p>
        </div>
        <button
          onClick={async () => {
            await queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
            refetch();
          }}
          disabled={isFetching}
          className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded px-4 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>REFRESH FEEDS</span>
        </button>
      </div>

      {/* ----------------- SUMMARY CARDS (KPIs) ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Machines */}
        <div className="card-industrial p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Fleet Units</span>
            <Cpu className="w-5 h-5 text-gray-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{summary.total_machines}</span>
            <span className="text-xs text-gray-500 block">Total Catalogued</span>
          </div>
        </div>

        {/* Healthy Machines */}
        <div className="card-industrial p-4 flex flex-col justify-between border-l-4 border-l-success">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Healthy</span>
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-success">{summary.healthy_machines}</span>
            <span className="text-xs text-gray-500 block">Config Match</span>
          </div>
        </div>

        {/* Warning Machines */}
        <div className="card-industrial p-4 flex flex-col justify-between border-l-4 border-l-warning">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Warning</span>
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-warning">{summary.warning_machines}</span>
            <span className="text-xs text-gray-500 block">Minor Deviations</span>
          </div>
        </div>

        {/* Faulty Machines */}
        <div className="card-industrial p-4 flex flex-col justify-between border-l-4 border-l-danger">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Faulty</span>
            <XOctagon className="w-5 h-5 text-danger" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-danger">{summary.faulty_machines}</span>
            <span className="text-xs text-gray-500 block">Requires Intercept</span>
          </div>
        </div>

        {/* Today's Diagnostics */}
        <div className="card-industrial p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Today's Runs</span>
            <Play className="w-5 h-5 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{summary.todays_diagnostics}</span>
            <span className="text-xs text-gray-500 block">Audit Executions</span>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="card-industrial p-4 flex flex-col justify-between bg-red-50 border border-red-200">
          <div className="flex justify-between items-center text-red-500">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">Critical Alerts</span>
            <Bell className="w-5 h-5 text-red-600 animate-bounce" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-red-700">{summary.critical_alerts}</span>
            <span className="text-xs text-red-500 block">Faults (Last 7d)</span>
          </div>
        </div>
      </div>

      {/* ----------------- QUICK ACTIONS PANEL ----------------- */}
      <div className="card-industrial p-4 bg-white">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3">Operator Quick Workspaces</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Administrator', 'Maintenance Engineer', 'Operator'].includes(activeRole || '') && (
            <Link href="/dashboard/diagnostics" className="flex items-center justify-center space-x-2 py-3 px-4 bg-primary hover:bg-primary-dark text-black rounded font-bold text-xs shadow-sm hover:shadow transition-all uppercase">
              <Wrench className="w-4 h-4" />
              <span>Run Diagnostic Bench</span>
            </Link>
          )}
          {['Administrator', 'Maintenance Engineer', 'Supervisor'].includes(activeRole || '') && (
            <Link href="/dashboard/reports" className="flex items-center justify-center space-x-2 py-3 px-4 bg-gray-800 hover:bg-black text-white rounded font-bold text-xs shadow-sm hover:shadow transition-all uppercase">
              <FileText className="w-4 h-4 text-primary" />
              <span>PDF Archives</span>
            </Link>
          )}
          <Link href="/dashboard/machines" className="flex items-center justify-center space-x-2 py-3 px-4 bg-white hover:bg-gray-150 text-gray-700 border border-gray-300 rounded font-bold text-xs shadow-sm hover:shadow transition-all uppercase">
            <Cpu className="w-4 h-4 text-gray-500" />
            <span>Manage Fleet</span>
          </Link>
          {activeRole === 'Administrator' && (
            <Link href="/dashboard/users" className="flex items-center justify-center space-x-2 py-3 px-4 bg-white hover:bg-gray-150 text-gray-700 border border-gray-300 rounded font-bold text-xs shadow-sm hover:shadow transition-all uppercase">
              <Users className="w-4 h-4 text-gray-500" />
              <span>User Registers</span>
            </Link>
          )}
        </div>
      </div>

      {/* ----------------- CHARTS ROW 1 ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Diagnostic Trend Chart */}
        <div className="card-industrial p-5 bg-white lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Diagnostic Run Trend</h3>
            <span className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono font-bold uppercase">Last 7 Days</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.diagnostic_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDiags" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFCC00" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FFCC00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="diagnostics" stroke="#E5B200" strokeWidth={2} fillOpacity={1} fill="url(#colorDiags)" name="Runs Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Distribution Pie Chart */}
        <div className="card-industrial p-5 bg-white">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Fleet Health Distribution</h3>
          <div className="h-80 flex flex-col items-center justify-center">
            {charts.health_distribution.some((d: any) => d.value > 0) ? (
              <>
                <div className="w-full h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.health_distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.health_distribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-mono">
                  Telemetry health categorization logic active
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 py-10 font-medium text-xs">
                No telemetry configurations processed yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------- CHARTS ROW 2 & TABLES ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Diagnostics Table */}
        <div className="card-industrial p-5 bg-white lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Recent Diagnostics Runs</h3>
            <Link href="/dashboard/diagnostics" className="text-xs font-bold text-primary-dark hover:underline hover:text-black">
              View History
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <th className="pb-3">Machine</th>
                  <th className="pb-3">Diagnostic ID</th>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Health Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-xs">
                {recent_diagnostics.length > 0 ? (
                  recent_diagnostics.map((run: any) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="py-3 font-semibold text-gray-900">{run.machine_name} ({run.machine_id})</td>
                      <td className="py-3 font-mono">{run.id}</td>
                      <td className="py-3 text-gray-500">{run.timestamp}</td>
                      <td className="py-3">
                        <span className={`badge ${
                          run.status === 'Healthy' 
                            ? 'badge-green' 
                            : run.status === 'Warning' 
                              ? 'badge-orange' 
                              : 'badge-red'
                        }`}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-right font-black text-gray-900">{run.health_score}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-semibold">No recent runs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Logs Timeline */}
        <div className="card-industrial p-5 bg-white flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary-dark" />
              Activity Audit Logs
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {timeline.length > 0 ? (
              timeline.map((log: any) => (
                <div key={log.id} className="flex space-x-3 text-xs border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      log.action.includes('Connected') || log.action === 'Login'
                        ? 'bg-success'
                        : log.action.includes('Completed')
                          ? 'bg-info'
                          : log.action.includes('Generated')
                            ? 'bg-primary'
                            : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex justify-between text-[10px] text-gray-400 font-semibold font-mono">
                      <span>{log.employee_id}</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <p className="font-bold text-gray-900">{log.action}</p>
                    <p className="text-gray-500 font-medium text-[11px] leading-snug">{log.details}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-10 font-semibold">No logs recorded.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
