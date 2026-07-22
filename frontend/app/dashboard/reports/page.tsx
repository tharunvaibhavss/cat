'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService, api } from '@/services/api';
import { useAuth } from '@/components/Providers';
import { 
  FileText, 
  Search, 
  Download, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  ExternalLink,
  Calendar,
  FileDown
} from 'lucide-react';

export default function ReportsPage() {
  const { activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Authenticated PDF downloader
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

  // Editing state
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');

  // Fetch reports list
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reportsList', searchTerm],
    queryFn: () => reportService.list(searchTerm || undefined)
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => reportService.updateMetadata(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportsList'] });
      setEditingReport(null);
      setEditTitle('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error updating title');
    }
  });

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: reportService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportsList'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error deleting report');
    }
  });

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport || !editTitle.trim()) return;
    updateTitleMutation.mutate({ id: editingReport.id, title: editTitle });
  };

  const startEdit = (report: any) => {
    setEditingReport(report);
    setEditTitle(report.title);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">PDF REPORT ARCHIVE</h1>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
          View, download, and manage compiled professional PDF engineering audit certificates
        </p>
      </div>

      {/* Search Bar */}
      <div className="card-industrial p-4 bg-white flex items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search report titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-xs bg-gray-50 focus:outline-none"
          />
        </div>
      </div>

      {/* Reports Grid/List */}
      <div className="card-industrial bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="table-header text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4">Report ID</th>
                <th className="p-4">Document Title</th>
                <th className="p-4">Diag ID Reference</th>
                <th className="p-4">Generated At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">Loading document vault...</td>
                </tr>
              ) : reports.length > 0 ? (
                reports.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-900">#REP-{r.id}</td>
                    <td className="p-4 font-bold text-gray-950 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-primary-dark" />
                      {r.title}
                    </td>
                    <td className="p-4 font-mono">Diag #{r.diagnostic_result_id}</td>
                    <td className="p-4 text-gray-500 font-semibold flex items-center space-x-1 mt-1">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {new Date(r.generated_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        
                        {/* Download button uses authenticated Axios fetch */}
                        <button
                          onClick={() => handleDownloadPdf(r.id, r.title)}
                          className="p-1.5 text-success hover:bg-green-50 rounded flex items-center justify-center cursor-pointer"
                          title="Download PDF file"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        {/* Edit metadata (title) */}
                        {['Administrator', 'Maintenance Engineer', 'Supervisor'].includes(activeRole || '') && (
                          <button
                            onClick={() => startEdit(r)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="Edit report title"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete report (restricted) */}
                        {['Administrator', 'Maintenance Engineer', 'Supervisor'].includes(activeRole || '') && (
                          <button
                            onClick={() => {
                              if (confirm(`Confirm permanent deletion of report #REP-${r.id}? This removes the physical PDF file.`)) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Delete report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">No PDF reports located in archives.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- EDIT TITLE DIALOG ----------------- */}
      {editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-gray-200">
            <div className="bg-industrial-dark text-white p-4 flex justify-between items-center">
              <span className="font-bold text-xs uppercase tracking-widest flex items-center">
                <Edit3 className="w-4 h-4 mr-2 text-primary" />
                Edit Report Title Metadata
              </span>
              <button onClick={() => setEditingReport(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded text-xs font-bold hover:bg-gray-50 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTitleMutation.isPending}
                  className="flex-1 bg-primary text-black py-2 rounded text-xs font-bold hover:bg-primary-dark uppercase"
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
