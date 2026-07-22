'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { llmService, machineService } from '@/services/api';
import { Bot, Send, ShieldAlert, Wrench, Clock, CheckCircle2, AlertTriangle, Sparkles, HelpCircle } from 'lucide-react';

export default function AssistantPage() {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('CAT-HEX-320');
  const [question, setQuestion] = useState<string>('Why is Excavator EX-12 overheating?');
  const [querying, setQuerying] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const { data: machines } = useQuery({
    queryKey: ['machinesAssistant'],
    queryFn: () => machineService.list(),
  });

  const samplePrompts = [
    'Why is Excavator EX-12 overheating?',
    'What causes low hydraulic pressure in CAT-HEX-320?',
    'What are the LOTO safety protocols before replacing a cooling fan relay?',
    'How to troubleshoot battery voltage drops on CAT-777G Dump Truck?'
  ];

  const handleAsk = async (promptText?: string) => {
    const qText = promptText || question;
    if (!qText.trim()) return;

    setQuerying(true);
    try {
      const res = await llmService.assistantQuery(qText, selectedMachineId);
      setResponse(res);
    } catch (e: any) {
      console.error('Assistant query error', e);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Bot className="w-6 h-6 mr-2 text-primary-dark" />
            AI MAINTENANCE ASSISTANT & TROUBLESHOOTING Q&A
          </h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Interactive AI Expert for Root Cause Analysis, Maintenance Sequences, & LOTO Safety Guidelines
          </p>
        </div>

        {/* Machine Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-gray-700 uppercase">Unit Context:</label>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-xs font-bold text-gray-800 shadow-sm"
          >
            {machines && machines.map((m: any) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input & Prompt Recommendations */}
        <div className="card-industrial p-6 bg-white space-y-5">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
            <HelpCircle className="w-4 h-4 mr-1.5 text-primary-dark" /> Technician Question
          </h3>

          <div>
            <textarea
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the AI Assistant a diagnostic or repair question..."
              className="w-full p-3 border border-gray-300 rounded text-xs font-medium text-gray-800 focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <button
            onClick={() => handleAsk()}
            disabled={querying}
            className="w-full py-3 bg-primary hover:bg-yellow-500 text-black font-extrabold text-xs rounded uppercase shadow transition-colors flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{querying ? 'Analyzing Diagnostic Data...' : 'Ask AI Maintenance Assistant'}</span>
          </button>

          <div className="pt-3 border-t border-gray-150">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-primary-dark" /> Quick Sample Prompts
            </span>
            <div className="space-y-2">
              {samplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuestion(p);
                    handleAsk(p);
                  }}
                  className="w-full text-left p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs font-semibold text-gray-700 transition-colors"
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Answer & Technical Sequence Display */}
        <div className="lg:col-span-2 card-industrial p-6 bg-white space-y-6">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
            <Bot className="w-4 h-4 mr-1.5 text-primary-dark" /> AI Diagnostic Synthesis
          </h3>

          {response ? (
            <div className="space-y-6 animate-fade-in">
              {/* Answer Box */}
              <div className="p-4 bg-primary/10 border-l-4 border-l-primary rounded text-xs font-semibold text-gray-900 leading-relaxed">
                {response.answer}
              </div>

              {/* Probable Cause & Repair Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 bg-gray-50 border border-gray-200 rounded">
                  <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block mb-1">PROBABLE ROOT CAUSE</span>
                  <p className="text-xs font-bold text-gray-900">{response.probable_cause}</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center flex flex-col justify-center">
                  <span className="text-[10px] text-emerald-800 font-mono font-bold uppercase block">ESTIMATED REPAIR TIME</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono my-0.5">{response.estimated_repair_time}</span>
                </div>
              </div>

              {/* Recommended Inspection Sequence */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center">
                  <Wrench className="w-4 h-4 mr-1 text-primary-dark" /> Recommended Inspection & Service Sequence
                </h4>
                <div className="space-y-2">
                  {response.recommended_sequence.map((step: string, sIdx: number) => (
                    <div key={sIdx} className="p-3 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-gray-800">
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              {/* Spare Parts & Safety Precautions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Required OEM Spare Parts</h4>
                  <div className="space-y-1">
                    {response.required_spare_parts.map((part: string, pIdx: number) => (
                      <div key={pIdx} className="p-2 bg-gray-100 rounded text-xs font-semibold text-gray-800 border">
                        &bull; {part}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold font-mono text-rose-600 uppercase tracking-wider mb-2 flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1" /> Safety & LOTO Protocols
                  </h4>
                  <div className="space-y-1">
                    {response.safety_precautions.map((safe: string, sfIdx: number) => (
                      <div key={sfIdx} className="p-2 bg-rose-50 border border-rose-200 rounded text-xs font-bold text-rose-900">
                        {safe}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 space-y-2 border-2 border-dashed border-gray-200 rounded">
              <Bot className="w-12 h-12 text-gray-300" />
              <p className="text-xs font-medium">Ask a question or select a quick prompt to receive AI diagnostic assistance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
