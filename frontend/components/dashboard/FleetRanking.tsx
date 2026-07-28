import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function FleetRanking({ rankingData }: { rankingData: any }) {
  if (!rankingData) return null;

  return (
    <div className="card-industrial bg-white p-6 h-full flex flex-col">
      <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Fleet Health Ranking</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Top Performers */}
        <div>
          <div className="flex items-center text-success mb-2">
            <ArrowUp className="w-4 h-4 mr-1" />
            <h4 className="text-xs font-bold uppercase">Top Performers</h4>
          </div>
          <div className="space-y-2">
            {rankingData.top.map((m: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-sm font-bold text-success">{m.health_score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Performers */}
        <div>
          <div className="flex items-center text-warning mb-2">
            <ArrowDown className="w-4 h-4 mr-1" />
            <h4 className="text-xs font-bold uppercase">Needs Attention</h4>
          </div>
          <div className="space-y-2">
            {rankingData.bottom.map((m: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-sm font-bold text-warning">{m.health_score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
