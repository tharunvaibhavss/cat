'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/api';
import { useAuth } from '@/components/Providers';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  ShieldCheck, 
  UserPlus, 
  Check,
  Search,
  KeyRound
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { user: currentUser, activeRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Protect client side route - redirect if not Administrator
  useEffect(() => {
    if (activeRole && activeRole !== 'Administrator') {
      router.push('/dashboard');
    }
  }, [activeRole, router]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Operator');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['usersList'],
    queryFn: userService.list,
    enabled: activeRole === 'Administrator'
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error creating user');
    }
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => userService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error updating user');
    }
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Error deleting user');
    }
  });

  const resetForm = () => {
    setEmployeeId('');
    setUsername('');
    setRole('Operator');
    setPassword('');
    setEmail('');
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ employee_id: employeeId, username, role, password, email });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateMutation.mutate({
      id: selectedUser.id,
      data: { username, role, password: password || undefined, email }
    });
  };

  const startEdit = (user: any) => {
    setSelectedUser(user);
    setEmployeeId(user.employee_id);
    setUsername(user.username);
    setRole(user.role);
    setPassword(''); // don't load hashed password
    setEmail(user.email || '');
    setIsEditOpen(true);
  };

  const filteredUsers = users.filter((u: any) => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (activeRole !== 'Administrator') {
    return <div className="p-8 text-center text-gray-500 font-bold">Verifying authorization access credentials...</div>;
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">USER REGISTRY</h1>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            Admin console to manage employee diagnostic authorizations and roles
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="flex items-center space-x-1 bg-primary hover:bg-primary-dark text-black rounded px-3 py-2 text-xs font-bold shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>REGISTER USER</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="card-industrial p-4 bg-white flex items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search employees by name, ID, role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-xs bg-gray-50 focus:outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card-industrial bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="table-header text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4">Employee ID</th>
                <th className="p-4">Employee Name</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Role Designation</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">Loading user database...</td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-900">{u.employee_id}</td>
                    <td className="p-4 font-bold text-gray-950">{u.username}</td>
                    <td className="p-4 font-mono text-gray-600">{u.email || 'N/A'}</td>
                    <td className="p-4 font-semibold text-gray-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 border border-gray-200 uppercase font-mono">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => startEdit(u)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          title="Edit user details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (currentUser?.employee_id === u.employee_id) {
                              alert("Safety lock: cannot delete your own active administrator account.");
                              return;
                            }
                            if (confirm(`Confirm permanent deletion of user ${u.username} (${u.employee_id})?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">No users match the search parameters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- ADD / EDIT USER DIALOG ----------------- */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-gray-200">
            <div className="bg-industrial-dark text-white p-4 flex justify-between items-center">
              <span className="font-bold text-xs uppercase tracking-widest flex items-center">
                <Users className="w-4 h-4 mr-2 text-primary" />
                {isAddOpen ? 'Register New User' : 'Edit User Settings'}
              </span>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={isAddOpen ? handleAddSubmit : handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Employee Unique ID</label>
                <input
                  type="text"
                  required
                  disabled={isEditOpen}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-ENG02"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Robert Field-Engineer"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Passcode / Password</label>
                <input
                  type="password"
                  required={isAddOpen}
                  placeholder={isEditOpen ? 'Leave blank to retain original' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. user@cat-diagnostics.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Access Role Class</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-semibold text-gray-700"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Maintenance Engineer">Maintenance Engineer</option>
                  <option value="Operator">Operator</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded text-xs font-bold hover:bg-gray-50 uppercase"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-primary text-black py-2 rounded text-xs font-bold hover:bg-primary-dark uppercase"
                >
                  {isAddOpen ? 'Register' : 'Apply Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
