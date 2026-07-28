import React from 'react';
import { AlertTriangle, Activity } from 'lucide-react';

export default function CriticalMachinesList({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="card-industrial bg-white p-6 h-full flex flex-col items-center justify-center text-center">
        <Activity className="w-12 h-12 text-success mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-gray-900 uppercase">No Critical Machines</h3>
        <p className="text-xs text-gray-500">All machines are currently operating within safe health parameters.</p>
      </div>
    );
  }

  return (
    <div className="card-industrial bg-white p-6 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase">Critical Machines Action Required</h3>
        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">{data.length} Critical</span>
      </div>
      <div className="overflow-y-auto pr-2 space-y-3 flex-1">
        {data.map((machine: any, i: number) => (
          <div key={i} className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
              <div>
                <p className="text-sm font-bold text-gray-900">{machine.name}</p>
                <p className="text-xs text-gray-500">{machine.machine_id} • {machine.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-red-600">{machine.health_score}/100 Health</p>
              <p className="text-xs text-gray-500">{machine.risk_score}% Risk</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
