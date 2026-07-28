'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fleetService, dashboardService } from '@/services/api';
import { useAuth } from '@/components/Providers';
import { 
  Cpu, 
  Activity, 
  AlertTriangle,
  RefreshCw,
  Clock,
  DollarSign,
  Droplet
} from 'lucide-react';
import FleetHealthDistribution from '@/components/dashboard/FleetHealthDistribution';
import CriticalMachinesList from '@/components/dashboard/CriticalMachinesList';
import FleetRanking from '@/components/dashboard/FleetRanking';

export default function DashboardPage() {
  const { activeRole } = useAuth();
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview, isFetching } = useQuery({
    queryKey: ['fleetOverview'],
    queryFn: fleetService.getOverview,
    refetchInterval: 10000,
  });

  const { data: distribution, isLoading: distLoading } = useQuery({
    queryKey: ['fleetDistribution'],
    queryFn: fleetService.getDistribution,
    refetchInterval: 10000,
  });

  const { data: ranking, isLoading: rankLoading } = useQuery({
    queryKey: ['fleetRanking'],
    queryFn: fleetService.getRanking,
    refetchInterval: 10000,
  });

  const { data: critical, isLoading: critLoading } = useQuery({
    queryKey: ['fleetCritical'],
    queryFn: fleetService.getCritical,
    refetchInterval: 10000,
  });

  const isLoading = overviewLoading || distLoading || rankLoading || critLoading || !mounted;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded border border-gray-200 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-white rounded border border-gray-200 animate-pulse" />
          <div className="h-96 bg-white rounded border border-gray-200 animate-pulse" />
          <div className="h-96 bg-white rounded border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="card-industrial bg-white p-8 text-center space-y-4 my-6">
        <AlertTriangle className="w-12 h-12 text-warning mx-auto animate-pulse" />
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase">Gateway Connection Disrupted</h3>
          <p className="text-xs text-gray-500 mt-1">Unable to load fleet intelligence data.</p>
        </div>
        <button
          onClick={() => refetchOverview()}
          className="bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded text-xs font-bold uppercase transition-all shadow-sm cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ----------------- TOP BAR / TITLE ----------------- */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">ENTERPRISE COMMAND CENTER</h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Phase 1: AI Decision Intelligence Platform
          </p>
        </div>
        <button
          onClick={async () => {
            await queryClient.invalidateQueries({ queryKey: ['fleetOverview'] });
            await queryClient.invalidateQueries({ queryKey: ['fleetDistribution'] });
            await queryClient.invalidateQueries({ queryKey: ['fleetRanking'] });
            await queryClient.invalidateQueries({ queryKey: ['fleetCritical'] });
          }}
          disabled={isFetching}
          className="flex items-center space-x-2 bg-gray-900 hover:bg-black text-primary border border-gray-900 rounded px-4 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>SYNC INTELLIGENCE</span>
        </button>
      </div>

      {/* ----------------- FLEET KPIs ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fleet Health */}
        <div className="card-industrial p-6 flex flex-col justify-between border-l-4 border-l-primary bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div className="flex justify-between items-center opacity-80">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Fleet Health</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-primary">{overview.average_fleet_health.toFixed(1)}</span>
            <span className="text-xs opacity-70 block mt-1">AI Composite Score</span>
          </div>
        </div>

        {/* Total Downtime */}
        <div className="card-industrial p-6 flex flex-col justify-between bg-white border border-gray-200">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Downtime</span>
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-gray-900">{overview.total_downtime_hours.toFixed(1)}h</span>
            <span className="text-xs text-gray-500 block mt-1">Last 30 Days</span>
          </div>
        </div>

        {/* Maintenance Cost */}
        <div className="card-industrial p-6 flex flex-col justify-between bg-white border border-gray-200">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Maintenance Cost</span>
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-gray-900">${overview.maintenance_cost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
            <span className="text-xs text-gray-500 block mt-1">Estimated Accrual</span>
          </div>
        </div>

        {/* Fuel Consumption */}
        <div className="card-industrial p-6 flex flex-col justify-between bg-white border border-gray-200">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Fuel Consumption</span>
            <Droplet className="w-5 h-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-gray-900">{overview.fuel_consumption.toLocaleString()}L</span>
            <span className="text-xs text-gray-500 block mt-1">Total Burn</span>
          </div>
        </div>
      </div>

      {/* ----------------- CORE CHARTS & LISTS ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
        <div className="lg:col-span-1 h-full">
          <FleetHealthDistribution data={distribution} />
        </div>
        <div className="lg:col-span-1 h-full">
          <CriticalMachinesList data={critical} />
        </div>
        <div className="lg:col-span-1 h-full">
          <FleetRanking rankingData={ranking} />
        </div>
      </div>
      
    </div>
  );
}
