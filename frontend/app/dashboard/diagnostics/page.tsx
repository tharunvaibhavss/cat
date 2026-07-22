'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machineService, diagnosticService, llmService, reportService, manualInspectionService, api } from '@/services/api';
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
  Edit3,
  Save,
  X,
  Sliders
} from 'lucide-react';

export default function DiagnosticsPage() {
  const { activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  
  // Diagnostic run state
  const [activeResult, setActiveResult] = useState<any>(null);

  // Real-Time Telemetry Edit states
  const [isRealtimeEditOpen, setIsRealtimeEditOpen] = useState(false);
  const [realtimeForm, setRealtimeForm] = useState({
    operating_hours: 5890.0,
    engine_temp: 68.2,
    battery_voltage: 24.0,
    oil_pressure: 40.0,
    hydraulic_pressure: 3000.0,
    error_codes: '',
    observations: 'Manual real-time telemetry update from Diagnostic Bench'
  });

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

  // Real-Time Telemetry creation mutation
  const createManualInspectionMutation = useMutation({
    mutationFn: manualInspectionService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectedMachines'] });
      setIsRealtimeEditOpen(false);
      // Automatically re-run diagnostics so telemetry comparison and AI workbook update live
      if (selectedMachineId) {
        runDiagnosticMutation.mutate(selectedMachineId);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error saving real-time telemetry values');
    }
  });

  const openRealtimeEdit = () => {
    if (!selectedMachine) return;
    
    let opHours = selectedMachine.operating_hours || 5890.0;
    let engTemp = 68.2;
    let battVolt = 24.0;
    let oilPress = 40.0;
    let hydPress = 3000.0;
    let errCodesStr = '';
    let obs = 'Manual real-time telemetry update from Diagnostic Bench';

    if (activeResult?.details?.telemetry_comparison) {
      activeResult.details.telemetry_comparison.forEach((item: any) => {
        const valStr = String(item.realtime || '');
        const numVal = parseFloat(valStr.replace(/[^0-9.]/g, ''));
        if (item.parameter === 'Operating Hours' && !isNaN(numVal)) opHours = numVal;
        if (item.parameter === 'Engine Temperature' && !isNaN(numVal)) engTemp = numVal;
        if (item.parameter === 'Battery Voltage' && !isNaN(numVal)) battVolt = numVal;
        if (item.parameter === 'Oil Pressure' && !isNaN(numVal)) oilPress = numVal;
        if (item.parameter === 'Hydraulic Pressure' && !isNaN(numVal)) hydPress = numVal;
        if (item.parameter === 'Error Codes') {
          errCodesStr = valStr === 'None' ? '' : valStr;
        }
      });
      if (activeResult?.details?.observations && activeResult.details.observations !== 'None') {
        obs = activeResult.details.observations;
      }
    }

    setRealtimeForm({
      operating_hours: opHours,
      engine_temp: engTemp,
      battery_voltage: battVolt,
      oil_pressure: oilPress,
      hydraulic_pressure: hydPress,
      error_codes: errCodesStr,
      observations: obs
    });
    setIsRealtimeEditOpen(true);
  };

  const handleSaveRealtimeTelemetry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) return;

    const parsedErrorCodes = realtimeForm.error_codes
      ? realtimeForm.error_codes.split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== 'None')
      : [];

    createManualInspectionMutation.mutate({
      machine_id: selectedMachineId,
      operating_hours: Number(realtimeForm.operating_hours),
      engine_temp: Number(realtimeForm.engine_temp),
      battery_voltage: Number(realtimeForm.battery_voltage),
      oil_pressure: Number(realtimeForm.oil_pressure),
      hydraulic_pressure: Number(realtimeForm.hydraulic_pressure),
      error_codes: parsedErrorCodes,
      observations: realtimeForm.observations || 'Manual real-time telemetry edit from Diagnostic Bench'
    });
  };

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
          
          {/* LEFT COLUMN: REAL-TIME TELEMETRY & HISTORICAL AUDIT */}
          <div className="space-y-6">
            <div className="card-industrial bg-white p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-150 pb-1.5 flex-wrap gap-2">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-primary-dark" />
                  Real-Time Telemetry &amp; Historical Audit
                </h3>
                <div className="flex items-center space-x-2">
                  {activeResult && (
                    <span className={`badge text-[10px] px-2 py-0.5 font-black ${
                      activeResult.status === 'Healthy' ? 'badge-green' : activeResult.status === 'Warning' ? 'badge-orange' : 'badge-red'
                    }`}>
                      {activeResult.status?.toUpperCase()}
                    </span>
                  )}
                  <button
                    onClick={openRealtimeEdit}
                    className="flex items-center space-x-1 bg-primary hover:bg-primary-dark text-black px-2.5 py-1 rounded text-[11px] font-extrabold transition-all shadow-xs cursor-pointer uppercase tracking-wider"
                    title="Manually edit real-time telemetry values"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>EDIT REAL-TIME VALUES</span>
                  </button>
                </div>
              </div>

              {activeResult?.details?.telemetry_comparison ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-left border border-gray-200 rounded">
                      <thead>
                        <tr className="bg-gray-900 text-[10px] text-white font-bold uppercase tracking-wider">
                          <th className="p-3">Telemetry Parameter</th>
                          <th className="p-3">Normal / Baseline</th>
                          <th className="p-3">Real-Time Value</th>
                          <th className="p-3">Previous Value</th>
                          <th className="p-3">Diagnostic</th>
                          <th className="p-3 text-right">Edit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-mono">
                        {activeResult.details.telemetry_comparison.map((item: any, idx: number) => {
                          const isWarning = item.status === 'Warning';
                          const isCritical = item.status === 'Critical';
                          const rowClass = isCritical
                            ? 'bg-red-50 text-red-950'
                            : isWarning
                              ? 'bg-orange-50 text-orange-950'
                              : '';
                          return (
                            <tr key={idx} className={rowClass}>
                              <td className="p-3 font-sans font-semibold text-gray-800">{item.parameter}</td>
                              <td className="p-3 text-gray-500">{item.normal}</td>
                              <td className={`p-3 font-bold ${isCritical ? 'text-red-700' : isWarning ? 'text-orange-700' : 'text-gray-900'}`}>
                                {item.realtime}
                              </td>
                              <td className="p-3 text-gray-500">{item.old}</td>
                              <td className="p-3 font-black">
                                {isCritical ? (
                                  <span className="text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> CRITICAL
                                  </span>
                                ) : isWarning ? (
                                  <span className="text-orange-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> WARNING
                                  </span>
                                ) : item.status === 'Matched' ? (
                                  <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> NOMINAL
                                  </span>
                                ) : (
                                  <span className="text-gray-400">INFO</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={openRealtimeEdit}
                                  className="text-gray-400 hover:text-black p-1 rounded transition-colors"
                                  title={`Edit ${item.parameter}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {activeResult?.details?.observations && activeResult?.details?.observations !== 'None' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs flex justify-between items-start">
                      <div>
                        <p className="font-bold text-amber-800 uppercase tracking-wider mb-1">Operator Observations</p>
                        <p className="text-amber-900 italic">"{activeResult.details.observations}"</p>
                      </div>
                      <button
                        onClick={openRealtimeEdit}
                        className="text-amber-700 hover:text-amber-900 text-[10px] font-bold underline ml-2"
                      >
                        Edit Notes
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-mono">
                    <span>* real-time values from latest manual inspection.</span>
                    <button
                      onClick={openRealtimeEdit}
                      className="text-primary-dark font-extrabold hover:underline cursor-pointer"
                    >
                      [ Override Values ]
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-gray-400 flex flex-col items-center justify-center space-y-3">
                  <Activity className="w-8 h-8 text-gray-300" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Run diagnostics or edit real-time values</p>
                    <p className="text-[10px] text-gray-400 mt-1">Submit custom real-time sensor data or click Execute Diagnostics</p>
                  </div>
                  <button
                    onClick={openRealtimeEdit}
                    className="flex items-center space-x-1.5 bg-primary hover:bg-primary-dark text-black rounded px-4 py-2 text-xs font-black shadow-sm tracking-wider uppercase"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>MANUALLY EDIT REAL-TIME TELEMETRY</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: RUN RESULTS & AI ENGINE */}
          <div className="space-y-6">
            
            {/* 1. Diagnostic Run Status Card */}
            <div className="card-industrial bg-white p-5 space-y-4">
              <h3 className="text-xs font-black text-gray-900 border-b border-gray-150 pb-1.5 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-primary-dark" />
                  Diagnostics Execution Console
                </span>
                {activeResult && (
                  <span className="text-[10px] font-mono text-gray-400 font-bold">
                    ID: #{activeResult.id}
                  </span>
                )}
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

                  {/* AI Operational Decision Banner */}
                  {activeResult.details?.historical_evaluation && (
                    <div className="p-3 bg-slate-900 text-white rounded text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold uppercase text-primary">
                          AI Operational Decision
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-gray-800 text-amber-300 rounded font-bold">
                          {activeResult.details.historical_evaluation.urgency}
                        </span>
                      </div>
                      <p className="font-extrabold tracking-wide text-xs text-white">
                        {activeResult.details.historical_evaluation.status_display}
                      </p>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {activeResult.details.historical_evaluation.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Combined Audit Breakdown: Real-Time Telemetry & Sensor Audit */}
                  <div className="space-y-4">
                    
                    {/* Real-Time Telemetry & Sensor Audit */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider flex items-center">
                          <Activity className="w-3.5 h-3.5 mr-1.5 text-primary-dark" />
                          Real-Time Telemetry &amp; Sensor Audit
                        </h4>
                        <span className="text-[10px] font-mono font-bold text-gray-500">
                          ({activeResult.details?.telemetry_comparison?.length || 0} parameters)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                        {activeResult.details?.telemetry_comparison?.map((t: any, idx: number) => {
                          const isNominal = t.status === 'Matched' || t.status === 'Info';
                          const isCrit = t.status === 'Critical';
                          return (
                            <div 
                              key={idx} 
                              className={`p-2 rounded border flex flex-col justify-between ${
                                isCrit ? 'bg-red-50 border-red-200 text-red-950' : !isNominal ? 'bg-orange-50 border-orange-200 text-orange-950' : 'bg-gray-50 border-gray-200 text-gray-800'
                              }`}
                            >
                              <span className="text-[10px] font-sans font-bold text-gray-500 truncate">{t.parameter}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="font-extrabold text-xs">{t.realtime}</span>
                                <span className={`text-[9px] font-sans font-black px-1 py-0.5 rounded uppercase ${
                                  isCrit ? 'bg-red-600 text-white' : !isNominal ? 'bg-orange-500 text-white' : 'bg-green-100 text-green-800'
                                }`}>
                                  {isNominal ? 'NOMINAL' : t.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

      {/* ----------------- EDIT REAL-TIME TELEMETRY MODAL ----------------- */}
      {isRealtimeEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  Edit Real-Time Telemetry — {selectedMachine?.name}
                </h3>
              </div>
              <button
                onClick={() => setIsRealtimeEditOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRealtimeTelemetry} className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-600 font-medium">
                Manually update real-time sensor &amp; inspection telemetry parameters. Saving will record a new inspection log entry and immediately re-evaluate live diagnostics.
              </p>

              {/* Quick Presets */}
              <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Quick Simulation Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRealtimeForm({
                      operating_hours: selectedMachine?.operating_hours || 5890.0,
                      engine_temp: 68.2,
                      battery_voltage: 24.0,
                      oil_pressure: 40.0,
                      hydraulic_pressure: 3000.0,
                      error_codes: '',
                      observations: 'All system parameters nominal baseline'
                    })}
                    className="text-[11px] font-bold bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    🟢 Nominal Baseline
                  </button>
                  <button
                    type="button"
                    onClick={() => setRealtimeForm(prev => ({
                      ...prev,
                      engine_temp: 98.5,
                      observations: 'High engine temperature spike recorded under heavy loading conditions.'
                    }))}
                    className="text-[11px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    🔥 Overheat (98.5°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRealtimeForm(prev => ({
                      ...prev,
                      oil_pressure: 22.0,
                      hydraulic_pressure: 1950.0,
                      observations: 'Low oil & hydraulic pressure detected in primary manifold.'
                    }))}
                    className="text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    ⚠️ Low Pressure (22 PSI)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRealtimeForm(prev => ({
                      ...prev,
                      battery_voltage: 21.2,
                      error_codes: 'ERR-302, ERR-404',
                      observations: 'Low battery voltage and multiple ECU fault codes triggered.'
                    }))}
                    className="text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    🚨 Battery &amp; ECU Fault
                  </button>
                </div>
              </div>

              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Operating Hours (hrs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={realtimeForm.operating_hours}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, operating_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Engine Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={realtimeForm.engine_temp}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, engine_temp: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                  <span className="text-[10px] text-gray-400">Nominal &lt; 85 °C</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Battery Voltage (V)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={realtimeForm.battery_voltage}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, battery_voltage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                  <span className="text-[10px] text-gray-400">Nominal &gt;= 23.5 V</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Oil Pressure (PSI)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={realtimeForm.oil_pressure}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, oil_pressure: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                  <span className="text-[10px] text-gray-400">Nominal &gt;= 35 PSI</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Hydraulic Pressure (PSI)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={realtimeForm.hydraulic_pressure}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, hydraulic_pressure: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                  <span className="text-[10px] text-gray-400">Nominal &gt;= 2200 PSI</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Error Codes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ERR-302, ERR-104 (or leave empty)"
                    value={realtimeForm.error_codes}
                    onChange={(e) => setRealtimeForm({ ...realtimeForm, error_codes: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  />
                  <span className="text-[10px] text-gray-400">Comma-separated fault codes</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Operator Observations
                </label>
                <textarea
                  rows={2}
                  value={realtimeForm.observations}
                  onChange={(e) => setRealtimeForm({ ...realtimeForm, observations: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-sans text-gray-900 focus:ring-2 focus:ring-primary focus:border-black"
                  placeholder="Add notes or field observations..."
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRealtimeEditOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold transition-all uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createManualInspectionMutation.isPending}
                  className="flex items-center space-x-1.5 bg-primary hover:bg-primary-dark text-black px-5 py-2 rounded text-xs font-black shadow-sm transition-all disabled:opacity-50 uppercase tracking-wider cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{createManualInspectionMutation.isPending ? 'Saving...' : 'Save & Re-Run Diagnostics'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
