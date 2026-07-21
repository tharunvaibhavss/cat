'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machineService, diagnosticService, llmService, reportService, api } from '@/services/api';
import { useAuth } from '@/components/Providers';
import { 
  Play, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle,
  Brain,
  FileText,
  Copy,
  Download,
  RotateCcw,
  Layers,
  Thermometer,
  Zap,
  Activity,
  FileDown,
  Edit,
  Save,
  X
} from 'lucide-react';

export default function DiagnosticsPage() {
  const { activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  
  // Diagnostic run state
  const [activeResult, setActiveResult] = useState<any>(null);

  // Manual Telemetry Edit states
  const [isEditingTelemetry, setIsEditingTelemetry] = useState(false);
  const [telemetryForm, setTelemetryForm] = useState({
    firmware: '',
    plc_version: '',
    cpu: '',
    ram: '',
    storage: '',
    sensor_count: 0,
    communication_ports: '',
    installed_modules: '',
    temperature: 0,
    power_status: 'Stable'
  });
  
  // AI workbook state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // PDF report state
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Fetch only connected machines
  const { data: machines = [] } = useQuery({
    queryKey: ['connectedMachines'],
    queryFn: () => machineService.list({ status: 'Connected' })
  });

  const selectedMachine = machines.find((m: any) => m.machine_id === selectedMachineId);

  // Run diagnostics mutation
  const runDiagnosticMutation = useMutation({
    mutationFn: diagnosticService.run,
    onSuccess: (data) => {
      setActiveResult(data);
      setAiAnalysis(null); // Clear previous AI analysis
      setGeneratedReport(null); // Clear previous report
      queryClient.invalidateQueries({ queryKey: ['diagnosticHistory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error running diagnostics');
    }
  });

  // LLM analysis mutation
  const runAiAnalysisMutation = useMutation({
    mutationFn: llmService.analyze,
    onSuccess: (data) => {
      setAiAnalysis(data);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error running AI analysis');
    }
  });

  // Update telemetry mutation
  const updateTelemetryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => machineService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectedMachines'] });
      setIsEditingTelemetry(false);
      alert('Active Telemetry configuration updated successfully in database.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error saving telemetry changes');
    }
  });

  const handleDownloadPdf = async (id: number, title: string) => {
    try {
      const response = await api.get(`/reports/download/${id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Error downloading PDF file. Please try again.');
    }
  };

  const startEditingTelemetry = () => {
    if (!selectedMachine?.current_config) return;
    const cur = selectedMachine.current_config;
    setTelemetryForm({
      firmware: cur.firmware || '',
      plc_version: cur.plc_version || '',
      cpu: cur.cpu || '',
      ram: cur.ram || '',
      storage: cur.storage || '',
      sensor_count: cur.sensor_count || 0,
      communication_ports: cur.communication_ports?.join(', ') || '',
      installed_modules: cur.installed_modules?.join(', ') || '',
      temperature: cur.temperature || 45.0,
      power_status: cur.power_status || 'Stable'
    });
    setIsEditingTelemetry(true);
  };

  const handleSaveTelemetry = () => {
    if (!selectedMachine) return;
    const updatedData = {
      current_config: {
        firmware: telemetryForm.firmware,
        plc_version: telemetryForm.plc_version,
        cpu: telemetryForm.cpu,
        ram: telemetryForm.ram,
        storage: telemetryForm.storage,
        communication_ports: telemetryForm.communication_ports.split(',').map((s: string) => s.trim()).filter((s: string) => s !== ''),
        installed_modules: telemetryForm.installed_modules.split(',').map((s: string) => s.trim()).filter((s: string) => s !== ''),
        sensor_count: Number(telemetryForm.sensor_count),
        temperature: Number(telemetryForm.temperature),
        power_status: telemetryForm.power_status
      }
    };
    updateTelemetryMutation.mutate({ id: selectedMachine.id, data: updatedData });
  };

  // Generate PDF report mutation
  const generateReportMutation = useMutation({
    mutationFn: ({ resultId, title }: { resultId: number; title: string }) => reportService.create(resultId, title),
    onSuccess: (data) => {
      setGeneratedReport(data);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error compiling PDF report');
    }
  });

  const handleRunDiagnostic = () => {
    if (!selectedMachineId) return;
    runDiagnosticMutation.mutate(selectedMachineId);
  };

  const handleRunAiAnalysis = () => {
    if (!activeResult) return;
    setIsAiAnalyzing(true);
    runAiAnalysisMutation.mutate(activeResult.id, {
      onSettled: () => setIsAiAnalyzing(false)
    });
  };

  const handleGenerateReport = () => {
    if (!activeResult || !selectedMachine) return;
    setIsGeneratingReport(true);
    const title = `Service Audit Report: ${selectedMachine.name} - ${activeResult.status}`;
    generateReportMutation.mutate({ resultId: activeResult.id, title }, {
      onSettled: () => setIsGeneratingReport(false)
    });
  };

  const handleCopyAnalysis = () => {
    if (!aiAnalysis) return;
    const text = `
CAT DIAGNOSTICS WORKBOOK
=======================
Health: ${aiAnalysis.machine_health}

ROOT CAUSE ANALYSIS:
${aiAnalysis.root_cause_analysis}

SEVERITY CLASSIFICATION:
${aiAnalysis.severity_explanation}

MAINTENANCE WORKSTEPS:
${aiAnalysis.maintenance_recommendation}

SAFETY NOTES:
${aiAnalysis.safety_notes}

TROUBLESHOOTING & CALIBRATION:
${aiAnalysis.troubleshooting_steps}
    `;
    navigator.clipboard.writeText(text);
    alert('Copied AI Maintenance Workbook to Clipboard.');
  };

  const handleDownloadAnalysis = () => {
    if (!aiAnalysis) return;
    const text = JSON.stringify(aiAnalysis, null, 2);
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `CAT_Diagnostic_Analysis_${selectedMachineId}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Helper to diff fields visually
  const isMismatched = (field: string) => {
    if (!selectedMachine?.reference_config || !selectedMachine?.current_config) return false;
    
    const refVal = selectedMachine.reference_config[field];
    const curVal = selectedMachine.current_config[field];

    if (Array.isArray(refVal)) {
      // Compare arrays
      return JSON.stringify(refVal.sort()) !== JSON.stringify(curVal.sort());
    }
    return refVal !== curVal;
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">DIAGNOSTIC BENCH</h1>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
          Read active machine telemetry, highlight parameter mismatches, and run AI diagnostic workbooks
        </p>
      </div>

      {/* Select connected unit */}
      <div className="card-industrial p-4 bg-white flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Connected Fleet Unit</label>
          <select
            value={selectedMachineId}
            onChange={(e) => {
              setSelectedMachineId(e.target.value);
              setActiveResult(null);
              setAiAnalysis(null);
              setGeneratedReport(null);
            }}
            className="w-full bg-white border border-gray-300 rounded p-2.5 text-xs font-semibold text-gray-700"
          >
            <option value="">-- Choose active unit --</option>
            {machines.map((m: any) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.name} ({m.machine_id}) - Model {m.model}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleRunDiagnostic}
          disabled={!selectedMachineId || runDiagnosticMutation.isPending}
          className="w-full sm:w-auto mt-5 sm:mt-0 flex items-center justify-center space-x-2 bg-primary hover:bg-primary-dark text-black rounded px-6 py-2.5 text-xs font-black shadow-sm disabled:opacity-50 tracking-wider"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>EXECUTE DIAGNOSTICS</span>
        </button>
      </div>

      {/* ----------------- DIAGNOSTIC WORKSPACE ----------------- */}
      {selectedMachine ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: CONFIGURATION DIFF VIEWER */}
          <div className="card-industrial bg-white p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-150 pb-1.5">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center">
                <Layers className="w-4 h-4 mr-2 text-primary-dark" />
                Machine Configuration Audit Reader
              </h3>
              
              {/* Telemetry Edit Actions */}
              {['Administrator', 'Maintenance Engineer'].includes(activeRole || '') && (
                isEditingTelemetry ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveTelemetry}
                      disabled={updateTelemetryMutation.isPending}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-success hover:bg-emerald-600 text-white rounded text-[10px] font-bold shadow-sm transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>SAVE</span>
                    </button>
                    <button
                      onClick={() => setIsEditingTelemetry(false)}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-bold shadow-sm transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>CANCEL</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startEditingTelemetry}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded text-[10px] font-bold shadow-sm transition-all"
                  >
                    <Edit className="w-3.5 h-3.5 text-gray-500" />
                    <span>MANUAL EDIT</span>
                  </button>
                )
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-100 text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                    <th className="p-3">Parameter</th>
                    <th className="p-3">Reference Blueprint</th>
                    <th className="p-3">Active Telemetry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  
                  {/* Mapping static hardware configurations */}
                  {[
                    { label: 'Firmware Version', key: 'firmware' },
                    { label: 'PLC Version', key: 'plc_version' },
                    { label: 'CPU Architecture', key: 'cpu' },
                    { label: 'RAM Memory', key: 'ram' },
                    { label: 'Storage Size', key: 'storage' },
                    { label: 'Sensor Count', key: 'sensor_count' },
                  ].map((field) => {
                    const mismatch = isMismatched(field.key);
                    return (
                      <tr key={field.key} className={mismatch ? 'bg-red-50 text-red-950 font-bold' : ''}>
                        <td className="p-3 font-sans font-semibold text-gray-700">{field.label}</td>
                        <td className="p-3">{selectedMachine.reference_config?.[field.key]}</td>
                        <td className="p-3">
                          {isEditingTelemetry ? (
                            <input
                              type={field.key === 'sensor_count' ? 'number' : 'text'}
                              value={(telemetryForm as any)[field.key]}
                              onChange={(e) => setTelemetryForm({ ...telemetryForm, [field.key]: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary-dark"
                            />
                          ) : (
                            selectedMachine.current_config?.[field.key]
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Ports & Modules (Arrays) */}
                  {[
                    { label: 'Communication Ports', key: 'communication_ports' },
                    { label: 'Installed Modules', key: 'installed_modules' },
                  ].map((field) => {
                    const mismatch = isMismatched(field.key);
                    return (
                      <tr key={field.key} className={mismatch ? 'bg-red-50 text-red-950 font-bold' : ''}>
                        <td className="p-3 font-sans font-semibold text-gray-700">{field.label}</td>
                        <td className="p-3">{selectedMachine.reference_config?.[field.key]?.join(', ')}</td>
                        <td className="p-3">
                          {isEditingTelemetry ? (
                            <input
                              type="text"
                              value={(telemetryForm as any)[field.key]}
                              onChange={(e) => setTelemetryForm({ ...telemetryForm, [field.key]: e.target.value })}
                              placeholder="comma-separated list"
                              className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary-dark"
                            />
                          ) : (
                            selectedMachine.current_config?.[field.key]?.join(', ')
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Telemetry/Runtime stats */}
                  <tr className={selectedMachine.current_config?.temperature >= 75 ? 'bg-orange-50 text-orange-950 font-bold' : ''}>
                    <td className="p-3 font-sans font-semibold text-gray-700 flex items-center">
                      <Thermometer className="w-3.5 h-3.5 mr-1 text-orange-600" />
                      Operating Temp
                    </td>
                    <td className="p-3 text-gray-400">Under 70 C</td>
                    <td className="p-3">
                      {isEditingTelemetry ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.1"
                            value={telemetryForm.temperature}
                            onChange={(e) => setTelemetryForm({ ...telemetryForm, temperature: Number(e.target.value) })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded bg-white text-xs font-mono text-gray-900 focus:outline-none"
                          />
                          <span>C</span>
                        </div>
                      ) : (
                        `${selectedMachine.current_config?.temperature} C`
                      )}
                    </td>
                  </tr>

                  <tr className={selectedMachine.current_config?.power_status !== 'Stable' ? 'bg-orange-50 text-orange-950 font-bold' : ''}>
                    <td className="p-3 font-sans font-semibold text-gray-700 flex items-center">
                      <Zap className="w-3.5 h-3.5 mr-1 text-yellow-600" />
                      Power Supply
                    </td>
                    <td className="p-3 text-gray-400">Stable</td>
                    <td className="p-3">
                      {isEditingTelemetry ? (
                        <select
                          value={telemetryForm.power_status}
                          onChange={(e) => setTelemetryForm({ ...telemetryForm, power_status: e.target.value })}
                          className="w-full bg-white border border-gray-300 rounded p-1 text-xs text-gray-700 focus:outline-none"
                        >
                          <option value="Stable">Stable</option>
                          <option value="Fluctuating">Fluctuating</option>
                          <option value="Low Voltage">Low Voltage</option>
                        </select>
                      ) : (
                        selectedMachine.current_config?.power_status
                      )}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-gray-400 uppercase font-mono">
              * highlighted parameters indicate discrepancies between active telemetry and original reference designs.
            </div>
          </div>

          {/* RIGHT COLUMN: RUN RESULTS & AI ENGINE */}
          <div className="space-y-6">
            
            {/* 1. Diagnostic Run Status Card */}
            <div className="card-industrial bg-white p-5 space-y-4">
              <h3 className="text-xs font-black text-gray-900 border-b border-gray-150 pb-1.5 uppercase tracking-widest flex items-center">
                <Activity className="w-4 h-4 mr-2 text-primary-dark" />
                Diagnostics Execution Console
              </h3>

              {activeResult ? (
                <div className="space-y-4">
                  {/* Header score / status */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded">
                    <div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase font-mono">Unit Diagnostic Score</div>
                      <div className="text-3xl font-black text-gray-900 mt-1">{activeResult.health_score}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 font-bold uppercase font-mono mb-1">Status Badge</div>
                      <span className={`badge text-xs px-3 py-1 font-black ${
                        activeResult.status === 'Healthy' 
                          ? 'badge-green' 
                          : activeResult.status === 'Warning' 
                            ? 'badge-orange' 
                            : 'badge-red'
                      }`}>
                        {activeResult.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Specific issues list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detected Mismatches ({activeResult.details?.issues?.length || 0})</h4>
                    <div className="space-y-2max-h-[160px] overflow-y-auto pr-1">
                      {activeResult.details?.issues?.length > 0 ? (
                        activeResult.details.issues.map((issue: any, index: number) => (
                          <div key={index} className="p-3 bg-red-50/50 border border-red-100 rounded text-xs">
                            <p className="font-bold text-red-950 uppercase">{issue.parameter} Mismatch</p>
                            <p className="text-red-900 mt-1">{issue.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-green-50 border border-green-150 rounded text-xs flex items-center text-green-800">
                          <CheckCircle className="w-4 h-4 mr-2flex-shrink-0" />
                          <span>ALL HARDWARE & FIRMWARE BLOCKS SECURELY MATCH BLUEPRINTS.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons for AI & PDF */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-gray-100">
                    <button
                      onClick={handleRunAiAnalysis}
                      disabled={isAiAnalyzing}
                      className="flex-1 flex items-center justify-center space-x-1.5 bg-gray-800 hover:bg-black text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 uppercase"
                    >
                      <Brain className="w-4 h-4 text-primary" />
                      <span>{isAiAnalyzing ? 'Consulting GPT...' : 'AI WORKBOOK'}</span>
                    </button>
                    
                    <button
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport}
                      className="flex-1 flex items-center justify-center space-x-1.5 bg-white border border-gray-300 text-gray-700 py-2 rounded text-xs font-bold hover:bg-gray-50 transition-all disabled:opacity-50 uppercase"
                    >
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span>{isGeneratingReport ? 'Compiling PDF...' : 'COMPILE PDF REPORT'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                  <Play className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider">Execute diagnostics tool to fetch status</p>
                </div>
              )}
            </div>

            {/* 2. PDF Report download block */}
            {generatedReport && (
              <div className="card-industrial bg-gray-50 border-l-4 border-l-primary p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-primary-dark" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 uppercase">PDF Report Compiled Successfully</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{generatedReport.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadPdf(generatedReport.id, generatedReport.title)}
                  className="flex items-center space-x-1 bg-primary hover:bg-primary-dark text-black px-3.5 py-1.5 rounded text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>DOWNLOAD</span>
                </button>
              </div>
            )}

            {/* 3. AI Analysis Display Panel */}
            {aiAnalysis && (
              <div className="card-industrial bg-white p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center">
                    <Brain className="w-4 h-4 mr-2 text-primary-dark" />
                    AI Root-Cause Maintenance Workbook
                  </h3>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={handleCopyAnalysis}
                      className="p-1 text-gray-500 hover:text-black rounded hover:bg-gray-100" 
                      title="Copy workbook text"
                    >
                      <Copy className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={handleDownloadAnalysis}
                      className="p-1 text-gray-500 hover:text-black rounded hover:bg-gray-100" 
                      title="Save as JSON"
                    >
                      <Download className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={handleRunAiAnalysis}
                      className="p-1 text-gray-500 hover:text-black rounded hover:bg-gray-100 animate-pulse" 
                      title="Regenerate analysis"
                    >
                      <RotateCcw className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 text-xsh-[300px] overflow-y-auto pr-1">
                  <div>
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">Safety & Health Assessment</h4>
                    <p className="text-gray-600 leading-relaxed">{aiAnalysis.machine_health}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">Root Cause Analysis</h4>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{aiAnalysis.root_cause_analysis}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">Severity Explanation</h4>
                    <p className="text-gray-600 leading-relaxed">{aiAnalysis.severity_explanation}</p>
                  </div>

                  <div>
                    <h4 className="font-boldtext-gray-900 border-b border-gray-100 pb-1 mb-1font-bold text-primary-dark">Step-by-Step Maintenance Recommendations</h4>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{aiAnalysis.maintenance_recommendation}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-red-700 border-b border-gray-100 pb-1 mb-1">Essential Safety Precautions</h4>
                    <p className="text-red-950 leading-relaxed whitespace-pre-line bg-red-50 p-2.5 rounded border border-red-100">{aiAnalysis.safety_notes}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">Troubleshooting & Calibration Procedures</h4>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{aiAnalysis.troubleshooting_steps}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        <div className="card-industrial p-12 text-center text-gray-400 bg-white">
          <Cpu className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-700">No active unit chosen</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Choose a connected Caterpillar machine from the selector bar to view its telemetry, read configurations, and perform diagnostics.
          </p>
        </div>
      )}

    </div>
  );
}
