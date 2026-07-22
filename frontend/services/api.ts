import axios from 'axios';

const getInitialBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
};

export const api = axios.create({
  baseURL: getInitialBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach authorization header & dynamic network hostname
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      config.baseURL = process.env.NEXT_PUBLIC_API_URL || `http://${hostname}:8000/api`;
      
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session timeouts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Force redirect to login page if unauthorized
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authService = {
  login: async (employeeId: string, password: string, rememberMe?: boolean) => {
    const response = await api.post('/auth/login', { employee_id: employeeId, password, remember_me: rememberMe });
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify({
        employee_id: response.data.employee_id,
        username: response.data.username,
        role: response.data.role
      }));
    }
    return response.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  }
};

// Users endpoints
export const userService = {
  list: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/users', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  updateMyEmail: async (email: string) => {
    const response = await api.put('/users/me/email', { email });
    return response.data;
  },
  listSupervisors: async () => {
    const response = await api.get('/users/supervisors');
    return response.data;
  }
};

// Alerts endpoints
export const alertService = {
  list: async () => {
    const response = await api.get('/alerts');
    return response.data;
  },
  resolve: async (id: number) => {
    const response = await api.post(`/alerts/${id}/resolve`);
    return response.data;
  },
  sendEmail: async (id: number, email?: string) => {
    const response = await api.post(`/alerts/${id}/email`, null, { params: { email } });
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/alerts/${id}`);
    return response.data;
  }
};

// Machines endpoints
export const machineService = {
  list: async (filters?: { category?: string; status?: string; search?: string }) => {
    const response = await api.get('/machines', { params: filters });
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/machines', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/machines/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/machines/${id}`);
    return response.data;
  },
  connect: async (machineId: string, connectionType: string) => {
    const response = await api.post('/machines/connect', { machine_id: machineId, connection_type: connectionType });
    return response.data;
  },
  disconnect: async (machineId: string) => {
    const response = await api.post('/machines/disconnect', { machine_id: machineId, connection_type: 'none' });
    return response.data;
  }
};

// Diagnostic endpoints
export const diagnosticService = {
  run: async (machineId: string) => {
    const response = await api.post('/diagnostic/run', { machine_id: machineId });
    return response.data;
  },
  getHistory: async (filters?: { machine_id?: string; status?: string }) => {
    const response = await api.get('/diagnostic/history', { params: filters });
    return response.data;
  },
  getResult: async (id: number) => {
    const response = await api.get(`/diagnostic/${id}`);
    return response.data;
  },
  deleteResult: async (id: number) => {
    const response = await api.delete(`/diagnostic/${id}`);
    return response.data;
  },
  updateNotes: async (id: number, notes: string) => {
    const response = await api.put(`/diagnostic/${id}/notes`, { notes });
    return response.data;
  }
};

// LLM Analysis & Assistant endpoints
export const llmService = {
  analyze: async (diagnosticResultId: number) => {
    const response = await api.post('/llm/analyze', { diagnostic_result_id: diagnosticResultId });
    return response.data;
  },
  assistantQuery: async (question: string, machineId?: string) => {
    const response = await api.post('/llm/assistant-query', { question, machine_id: machineId });
    return response.data;
  }
};

// Manual Inspections (Hybrid Data Collection)
export const manualInspectionService = {
  create: async (data: any) => {
    const response = await api.post('/manual-inspections', data);
    return response.data;
  },
  list: async (machineId?: string) => {
    const response = await api.get('/manual-inspections', { params: { machine_id: machineId } });
    return response.data;
  }
};

// Work Orders
export const workOrderService = {
  list: async (filters?: { machine_id?: string; status?: string; priority?: string }) => {
    const response = await api.get('/work-orders', { params: filters });
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/work-orders', data);
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/work-orders/${id}`);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/work-orders/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/work-orders/${id}`);
    return response.data;
  }
};

// Computer Vision Inspection
export const visionService = {
  inspect: async (machineId: string, imageUrl: string) => {
    const response = await api.post('/vision/inspect', { machine_id: machineId, image_url: imageUrl });
    return response.data;
  },
  getHistory: async (machineId?: string) => {
    const response = await api.get('/vision/history', { params: { machine_id: machineId } });
    return response.data;
  }
};

// Multi-Site Fleet Management
export const siteService = {
  list: async () => {
    const response = await api.get('/sites');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/sites', data);
    return response.data;
  },
  getAnalytics: async (siteId: string) => {
    const response = await api.get(`/sites/${siteId}/analytics`);
    return response.data;
  }
};

// Digital Twin Visualization
export const digitalTwinService = {
  get: async (machineId: string) => {
    const response = await api.get(`/digital-twin/${machineId}`);
    return response.data;
  },
  simulate: async (machineId: string, scenario: string) => {
    const response = await api.post('/digital-twin/simulate', { machine_id: machineId, scenario });
    return response.data;
  }
};

// Predictive Maintenance
export const predictiveService = {
  get: async (machineId: string) => {
    const response = await api.get(`/predictive/${machineId}`);
    return response.data;
  }
};

// Offline Edge AI Gateway
export const edgeService = {
  getStatus: async () => {
    const response = await api.get('/edge/status');
    return response.data;
  },
  toggle: async (offlineMode: boolean) => {
    const response = await api.post('/edge/toggle', { offline_mode: offlineMode });
    return response.data;
  },
  sync: async () => {
    const response = await api.post('/edge/sync');
    return response.data;
  }
};

// Report endpoints
export const reportService = {
  list: async (search?: string) => {
    const response = await api.get('/reports', { params: { search } });
    return response.data;
  },
  create: async (diagnosticResultId: number, title: string) => {
    const response = await api.post('/reports', { diagnostic_result_id: diagnosticResultId, title });
    return response.data;
  },
  updateMetadata: async (id: number, title: string) => {
    const response = await api.put(`/reports/${id}`, { title });
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/reports/${id}`);
    return response.data;
  },
  getDownloadUrl: (id: number) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${host}:8000/api`;
    return `${baseUrl}/reports/download/${id}`;
  }
};

// Dashboard endpoints
export const dashboardService = {
  getData: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  }
};
