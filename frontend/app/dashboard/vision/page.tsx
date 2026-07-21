'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visionService, machineService } from '@/services/api';
import { Camera, ShieldAlert, CheckCircle, AlertTriangle, Cpu, Upload, RefreshCw, Eye } from 'lucide-react';

export default function VisionPage() {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('CAT-HEX-320');
  const [imageUrl, setImageUrl] = useState<string>('/static/samples/engine_leak.jpg');
  const [inspecting, setInspecting] = useState(false);
  const [latestResult, setLatestResult] = useState<any>(null);

  const { data: machines } = useQuery({
    queryKey: ['machinesListVision'],
    queryFn: () => machineService.list(),
  });

  const { data: history, refetch } = useQuery({
    queryKey: ['visionHistory', selectedMachineId],
    queryFn: () => visionService.getHistory(selectedMachineId),
  });

  const sampleImages = [
    { label: 'Hydraulic Oil Leak Inspection', url: '/static/samples/engine_leak.jpg' },
    { label: 'Surface Corrosion & Paint Damage', url: '/static/samples/corrosion.jpg' },
    { label: 'Exposed Electrical Harness', url: '/static/samples/harness.jpg' },
    { label: 'Clean Machine Surface Scan', url: '/static/samples/clean.jpg' },
  ];

  const handleRunScan = async () => {
    setInspecting(true);
    try {
      const res = await visionService.inspect(selectedMachineId, imageUrl);
      setLatestResult(res);
      refetch();
    } catch (e: any) {
      console.error('Vision Inspection failed', e);
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Camera className="w-6 h-6 mr-2 text-primary-dark" />
            COMPUTER VISION EQUIPMENT INSPECTION
          </h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            AI Surface Defect Recognition, Oil Seepage Detection, & PPE Compliance Monitoring
          </p>
        </div>

        {/* Machine Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-gray-700 uppercase">Unit:</label>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-xs font-bold text-gray-800 focus:ring-1 focus:ring-primary shadow-sm"
          >
            {machines && machines.map((m: any) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Inspection Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Controls */}
        <div className="card-industrial p-6 bg-white space-y-5">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
            <Upload className="w-4 h-4 mr-1.5 text-primary-dark" /> Select Inspection Image
          </h3>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image Source / Path:</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono text-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Preset Inspection Scans:</label>
            <div className="space-y-2">
              {sampleImages.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setImageUrl(s.url)}
                  className={`w-full text-left p-2.5 rounded text-xs font-semibold border transition-all ${
                    imageUrl === s.url ? 'bg-primary/10 border-primary font-bold text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleRunScan}
            disabled={inspecting}
            className="w-full py-3 bg-primary hover:bg-yellow-500 text-black font-extrabold text-xs rounded uppercase shadow transition-colors flex items-center justify-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>{inspecting ? 'Analyzing Image...' : 'Execute AI Vision Scan'}</span>
          </button>
        </div>

        {/* Vision Inspection Results Display */}
        <div className="lg:col-span-2 card-industrial p-6 bg-white space-y-6">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
            <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" /> AI Detection Results
          </h3>

          {latestResult ? (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block">OVERALL CONFIDENCE</span>
                  <span className="text-2xl font-black text-gray-900 font-mono">{(latestResult.confidence_score * 100).toFixed(0)}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block">PPE COMPLIANCE</span>
                  <span className={`badge ${latestResult.ppe_compliant ? 'badge-green' : 'badge-red'}`}>
                    {latestResult.ppe_compliant ? 'COMPLIANT (Helmet/Vest)' : 'NON-COMPLIANT'}
                  </span>
                </div>
              </div>

              {/* Summary Box */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded text-xs font-semibold text-amber-900">
                {latestResult.summary}
              </div>

              {/* Detected Defects Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Detected Anomalies / Defects</h4>
                {latestResult.defects_detected && latestResult.defects_detected.length > 0 ? (
                  <div className="space-y-2">
                    {latestResult.defects_detected.map((defect: string, idx: number) => (
                      <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded flex justify-between items-center text-xs font-bold text-rose-900">
                        <span>{defect}</span>
                        <span className="badge badge-red uppercase">HIGH SEVERITY</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 text-center">
                    No structural defects or fluid seepage detected on surface.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 space-y-2 border-2 border-dashed border-gray-200 rounded">
              <Camera className="w-10 h-10 text-gray-300" />
              <p className="text-xs font-medium">Select an inspection image and execute AI Vision Scan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Vision History */}
      {history && history.length > 0 && (
        <div className="card-industrial p-6 bg-white space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Historical Vision Inspections ({selectedMachineId})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[10px] text-gray-500 font-bold uppercase">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">PPE Status</th>
                  <th className="pb-2">Anomalies Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {history.map((h: any) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-500 font-mono">{h.timestamp}</td>
                    <td className="py-2 font-mono font-bold">{(h.confidence_score * 100).toFixed(0)}%</td>
                    <td className="py-2">
                      <span className={`badge ${h.ppe_compliant ? 'badge-green' : 'badge-red'}`}>
                        {h.ppe_compliant ? 'Pass' : 'Warning'}
                      </span>
                    </td>
                    <td className="py-2 font-semibold">
                      {h.defects_detected && h.defects_detected.length > 0 ? h.defects_detected.join(', ') : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
