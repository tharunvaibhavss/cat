'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteService } from '@/services/api';
import { Globe, Building2, Cpu, CheckCircle, AlertTriangle, XOctagon, MapPin, RefreshCw } from 'lucide-react';

export default function SitesPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const { data: sites, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sitesList'],
    queryFn: siteService.list,
  });

  const { data: siteAnalytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['siteAnalytics', selectedSiteId],
    queryFn: () => siteService.getAnalytics(selectedSiteId!),
    enabled: !!selectedSiteId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white rounded border border-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Globe className="w-6 h-6 mr-2 text-primary-dark" />
            MULTI-SITE FLEET MANAGEMENT
          </h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Centralized Regional Monitoring, Site Benchmarking, and Operations Comparison
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded px-4 py-2 text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>REFRESH SITES</span>
        </button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sites && sites.map((site: any) => {
          const isSelected = selectedSiteId === site.site_id;
          return (
            <div
              key={site.id}
              onClick={() => setSelectedSiteId(site.site_id)}
              className={`card-industrial p-5 bg-white cursor-pointer transition-all ${
                isSelected ? 'border-2 border-primary ring-2 ring-primary/20 shadow-md' : 'hover:border-gray-400'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-gray-100 rounded text-gray-800">
                  <Building2 className="w-5 h-5 text-primary-dark" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                  {site.site_id}
                </span>
              </div>

              <h3 className="font-extrabold text-base text-gray-900">{site.name}</h3>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />
                {site.location} &bull; <span className="font-semibold text-gray-700 ml-1">{site.region}</span>
              </p>

              <div className="mt-4 pt-3 border-t border-gray-150 flex justify-between items-center">
                <div className="flex items-center text-xs font-bold text-gray-700">
                  <Cpu className="w-4 h-4 mr-1.5 text-gray-500" />
                  <span>{site.machine_count} Fleet Machine(s)</span>
                </div>
                <span className="text-xs font-bold text-primary-dark hover:underline">
                  {isSelected ? 'Viewing Analytics →' : 'Select Site'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Site Analytics Details */}
      {selectedSiteId && (
        <div className="card-industrial p-6 bg-white space-y-6 animate-fade-in border-t-4 border-t-primary">
          {loadingAnalytics ? (
            <div className="h-48 bg-gray-100 animate-pulse rounded" />
          ) : siteAnalytics ? (
            <>
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest font-mono">
                    SITE ANALYTICS & REGIONAL BENCHMARK
                  </span>
                  <h2 className="text-xl font-black text-gray-900">{siteAnalytics.name} ({siteAnalytics.site_id})</h2>
                  <p className="text-xs text-gray-500">{siteAnalytics.location} &bull; Region: {siteAnalytics.region}</p>
                </div>
                <div className="flex space-x-3 text-center">
                  <div className="px-4 py-2 bg-emerald-50 rounded border border-emerald-200">
                    <span className="block text-xl font-black text-emerald-600">{siteAnalytics.health_summary.healthy}</span>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Healthy</span>
                  </div>
                  <div className="px-4 py-2 bg-amber-50 rounded border border-amber-200">
                    <span className="block text-xl font-black text-amber-600">{siteAnalytics.health_summary.warning}</span>
                    <span className="text-[10px] font-bold text-amber-700 uppercase">Warning</span>
                  </div>
                  <div className="px-4 py-2 bg-rose-50 rounded border border-rose-200">
                    <span className="block text-xl font-black text-rose-600">{siteAnalytics.health_summary.faulty}</span>
                    <span className="text-[10px] font-bold text-rose-700 uppercase">Faulty</span>
                  </div>
                </div>
              </div>

              {/* Site Machines Table */}
              <div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Assigned Site Equipment</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        <th className="pb-3">Machine ID</th>
                        <th className="pb-3">Name & Model</th>
                        <th className="pb-3">Telemetry Status</th>
                        <th className="pb-3">Operating Hours</th>
                        <th className="pb-3 text-right">RUL Estimate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-xs">
                      {siteAnalytics.machines.map((m: any) => (
                        <tr key={m.machine_id} className="hover:bg-gray-50">
                          <td className="py-3 font-mono font-bold text-gray-900">{m.machine_id}</td>
                          <td className="py-3 font-semibold text-gray-800">{m.name} ({m.model})</td>
                          <td className="py-3">
                            <span className={`badge ${m.status === 'Connected' ? 'badge-green' : 'badge-orange'}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600 font-mono">{m.operating_hours} hrs</td>
                          <td className="py-3 text-right font-bold text-emerald-600 font-mono">{m.rul_hours} hrs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
