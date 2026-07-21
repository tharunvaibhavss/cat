'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { digitalTwinService, machineService } from '@/services/api';
import { Box, Activity, Flame, Zap, ShieldAlert, Cpu, Wrench, RefreshCw, Play } from 'lucide-react';

export default function DigitalTwinPage() {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('CAT-HEX-320');
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState('');

  const { data: machines } = useQuery({
    queryKey: ['machinesListTwin'],
    queryFn: () => machineService.list(),
  });

  const { data: twinData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['digitalTwin', selectedMachineId],
    queryFn: () => digitalTwinService.get(selectedMachineId),
    enabled: !!selectedMachineId,
  });

  const handleSimulate = async (scenario: string) => {
    setSimulating(true);
    setSimMsg('');
    try {
      await digitalTwinService.simulate(selectedMachineId, scenario);
      setSimMsg(`Applied '${scenario}' simulation to Digital Twin.`);
      refetch();
    } catch (e: any) {
      setSimMsg('Simulation Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Box className="w-6 h-6 mr-2 text-primary-dark" />
            DIGITAL TWIN VISUALIZATION & FAILURE SIMULATION
          </h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Real-Time Virtual Equipment Representation & Predictive Subsystem Breakdown
          </p>
        </div>

        {/* Machine Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-gray-700 uppercase">Select Unit:</label>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-xs font-bold text-gray-800 focus:ring-1 focus:ring-primary focus:border-primary shadow-sm"
          >
            {machines && machines.map((m: any) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-white border border-gray-300 hover:bg-gray-100 rounded text-gray-700 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading || !twinData ? (
        <div className="h-96 bg-white rounded border border-gray-200 animate-pulse" />
      ) : (
        <>
          {/* Main Digital Twin Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Component Subsystems Virtual View */}
            <div className="lg:col-span-2 card-industrial p-6 bg-white space-y-6">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black text-primary rounded flex items-center justify-center font-bold font-mono text-sm">
                    TWIN
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900">{twinData.name} ({twinData.machine_id})</h3>
                    <p className="text-xs text-gray-500">{twinData.category} &bull; Model {twinData.model}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block">Virtual Status</span>
                  <span className="badge badge-green font-bold">{twinData.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Component Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {twinData.components.map((comp: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded border border-gray-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-gray-900">{comp.name}</span>
                      <span className={`badge text-[10px] ${comp.status === 'Nominal' ? 'badge-green' : 'badge-orange'}`}>
                        {comp.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-semibold">Subsystem Health</span>
                        <span className="font-bold text-gray-800">{comp.health}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            comp.health > 80 ? 'bg-emerald-500' : comp.health > 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${comp.health}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simulation Controls Panel */}
              <div className="p-4 bg-slate-900 text-white rounded space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center">
                    <Flame className="w-4 h-4 mr-1.5" /> FAILURE SCENARIO INJECTION (SIMULATION)
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Inject anomaly vectors into the Digital Twin telemetry stream to evaluate real-time health score degradation and RUL impact.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleSimulate('Thermal Spike')}
                    disabled={simulating}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold uppercase transition-colors"
                  >
                    Thermal Spike (98°C)
                  </button>
                  <button
                    onClick={() => handleSimulate('Low Power Voltage')}
                    disabled={simulating}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold uppercase transition-colors"
                  >
                    Low Power Voltage
                  </button>
                  <button
                    onClick={() => handleSimulate('Hydraulic Overload')}
                    disabled={simulating}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold uppercase transition-colors"
                  >
                    Hydraulic Overload
                  </button>
                  <button
                    onClick={() => handleSimulate('Reset Nominal')}
                    disabled={simulating}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold uppercase transition-colors"
                  >
                    Reset Nominal State
                  </button>
                </div>
                {simMsg && <p className="text-xs font-bold text-primary pt-1">{simMsg}</p>}
              </div>
            </div>

            {/* Predictive & Telemetry Sidebar */}
            <div className="card-industrial p-6 bg-white space-y-6">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                <Activity className="w-4 h-4 mr-1.5 text-primary-dark" /> Predictive RUL Metrics
              </h3>

              <div className="p-4 bg-emerald-50 rounded border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">REMAINING USEFUL LIFE (RUL)</span>
                <span className="text-3xl font-black text-emerald-700 block my-1 font-mono">
                  {twinData.predictive.rul_hours} <span className="text-sm font-normal text-emerald-900">HRS</span>
                </span>
                <span className="text-xs font-bold text-emerald-800">{twinData.predictive.suggested_action}</span>
              </div>

              {/* Breakdown Risk by Subsystem */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase">Subsystem Failure Probability (%)</h4>
                {Object.entries(twinData.predictive.component_risk).map(([key, val]: [string, any]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-600 uppercase">{key}</span>
                      <span className="font-bold text-gray-900">{val}%</span>
                    </div>
                    <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${val > 50 ? 'bg-rose-500' : val > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Sensor Feed Box */}
              <div className="p-4 bg-gray-50 rounded border border-gray-200 space-y-2 text-xs">
                <span className="font-bold text-gray-700 uppercase block border-b pb-1">Live Sensor Telemetry</span>
                <div className="flex justify-between text-gray-600">
                  <span>Operating Hours:</span>
                  <span className="font-mono font-bold text-gray-900">{twinData.telemetry.operating_hours} hrs</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Operating Temp:</span>
                  <span className="font-mono font-bold text-gray-900">{twinData.telemetry.temperature}°C</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Power Status:</span>
                  <span className="font-bold text-emerald-700">{twinData.telemetry.power_status}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>PLC Logic Image:</span>
                  <span className="font-mono font-bold text-gray-900">{twinData.telemetry.plc_version}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
