'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workOrderService, machineService, userService } from '@/services/api';
import { ClipboardList, Plus, CheckCircle, Clock, AlertTriangle, User as UserIcon, Wrench, RefreshCw, X } from 'lucide-react';

export default function WorkOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);

  // New WO form state
  const [machineId, setMachineId] = useState('CAT-HEX-320');
  const [title, setTitle] = useState('Cooling Radiator Fan Relay Replacement');
  const [faultDesc, setFaultDesc] = useState('Engine thermal load exceeding 90°C threshold under high load operation.');
  const [priority, setPriority] = useState('High');
  const [repairHours, setRepairHours] = useState(2.5);
  const [spareParts, setSpareParts] = useState('OEM Radiator Fan Relay, Coolant Fluid 10L');
  const [submitting, setSubmitting] = useState(false);

  const { data: workOrders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['workOrders', statusFilter, priorityFilter],
    queryFn: () => workOrderService.list({ status: statusFilter || undefined, priority: priorityFilter || undefined }),
  });

  const { data: machines } = useQuery({
    queryKey: ['machinesWO'],
    queryFn: () => machineService.list(),
  });

  const handleCreateWO = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const partsArray = spareParts.split(',').map(s => s.trim()).filter(Boolean);
      await workOrderService.create({
        machine_id: machineId,
        title,
        fault_description: faultDesc,
        priority,
        est_repair_hours: Number(repairHours),
        spare_parts_json: partsArray
      });
      setModalOpen(false);
      refetch();
    } catch (err: any) {
      console.error('Failed to create work order', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      await workOrderService.update(id, { status: newStatus });
      refetch();
    } catch (err) {
      console.error('Status update failed', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <ClipboardList className="w-6 h-6 mr-2 text-primary-dark" />
            AUTOMATIC WORK ORDER MANAGEMENT
          </h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            AI-Triggered Maintenance Schedules, Technician Assignments, & Spare Parts Allocations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-2 bg-primary hover:bg-yellow-500 text-black px-4 py-2 rounded text-xs font-bold uppercase shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Work Order</span>
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-white border border-gray-300 hover:bg-gray-100 rounded text-gray-700 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-industrial p-4 bg-white flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-600 uppercase">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-800"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-600 uppercase">Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-800"
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      {isLoading ? (
        <div className="h-64 bg-white rounded border border-gray-200 animate-pulse" />
      ) : workOrders && workOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workOrders.map((wo: any) => (
            <div key={wo.id} className="card-industrial p-5 bg-white space-y-4 flex flex-col justify-between border-l-4 border-l-primary">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-bold bg-black text-primary px-2.5 py-1 rounded">
                    {wo.work_order_id}
                  </span>
                  <div className="flex space-x-2">
                    <span className={`badge ${
                      wo.priority === 'Critical' ? 'badge-red' : wo.priority === 'High' ? 'badge-orange' : 'badge-green'
                    }`}>
                      {wo.priority.toUpperCase()}
                    </span>
                    <span className={`badge ${
                      wo.status === 'Completed' ? 'badge-green' : wo.status === 'In Progress' ? 'badge-blue' : 'badge-orange'
                    }`}>
                      {wo.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-gray-900">{wo.title}</h3>
                <p className="text-xs text-gray-500 font-mono">Unit ID: <span className="font-bold text-gray-800">{wo.machine_id}</span></p>
                <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-150">{wo.fault_description}</p>
              </div>

              {/* Work Order Details */}
              <div className="space-y-3 pt-3 border-t border-gray-150 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Est. Repair Time:</span>
                  <span className="font-mono font-bold text-gray-900">{wo.est_repair_hours} Hours</span>
                </div>
                {wo.spare_parts_json && wo.spare_parts_json.length > 0 && (
                  <div>
                    <span className="font-bold text-gray-700 uppercase block mb-1">Required Spare Parts:</span>
                    <div className="flex flex-wrap gap-1">
                      {wo.spare_parts_json.map((part: string, pIdx: number) => (
                        <span key={pIdx} className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-[11px] font-medium text-gray-700">
                          {part}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Toggle Action */}
                <div className="flex justify-end space-x-2 pt-2">
                  {wo.status !== 'In Progress' && wo.status !== 'Completed' && (
                    <button
                      onClick={() => handleStatusUpdate(wo.id, 'In Progress')}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold uppercase"
                    >
                      Start Repair
                    </button>
                  )}
                  {wo.status !== 'Completed' && (
                    <button
                      onClick={() => handleStatusUpdate(wo.id, 'Completed')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold uppercase"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-industrial p-12 bg-white text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-gray-900 text-base">No Outstanding Work Orders</h3>
          <p className="text-xs text-gray-500">All equipment maintenance work orders are currently completed or cleared.</p>
        </div>
      )}

      {/* Create Work Order Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="px-6 py-4 bg-black text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-widest text-primary uppercase">Generate Work Order</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWO} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Machine:</label>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-bold text-gray-800"
                >
                  {machines && machines.map((m: any) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_id} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Work Order Title:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fault Description & AI Findings:</label>
                <textarea
                  required
                  rows={3}
                  value={faultDesc}
                  onChange={(e) => setFaultDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs text-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs font-bold text-gray-800"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Est. Repair Hours:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={repairHours}
                    onChange={(e) => setRepairHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-xs font-bold text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Required Spare Parts (Comma Separated):</label>
                <input
                  type="text"
                  value={spareParts}
                  onChange={(e) => setSpareParts(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs text-gray-800"
                />
              </div>

              <div className="pt-4 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded text-xs font-bold text-gray-600 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-yellow-500 text-black font-bold text-xs rounded uppercase"
                >
                  {submitting ? 'Creating...' : 'Submit Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
