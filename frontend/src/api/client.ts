import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Skip global error handling if configured
    if (error.config?.skipErrorHandler) {
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || '';
    const msg = String(detail).toLowerCase();
    
    if (status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    } else if (msg.includes('40005') || msg.includes('绑定学号')) {
      alert('请先在微信端绑定学号，并在设置中更新 Cookie');
    } else if (status === 403 || msg.includes('40001') || msg.includes('access denied') || msg.includes('临时限制')) {
      alert('会话受限或被拒绝，请刷新 Cookie / SessID 或稍后再试');
    }
    return Promise.reject(error);
  }
);
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
}

export interface InviteCode {
    id: number;
    code: string;
    is_used: boolean;
}

export interface Task {
    id: number;
    user_id: number;
    task_type: string;
    cron_expression: string;
    config: any;
    is_enabled: boolean;
    last_status?: string;
    last_message?: string;
    last_run?: string;
}

export interface Lib {
    id: number;
    name: string;
    status: number;
}

export interface Floor {
    id: number;
    name: string;
}

export interface Seat {
    x: number;
    y: number;
    key: string;
    name: string;
    status: number;
    type: number;
}

export const adminApi = {
    getUsers: (config?: any) => api.get<User[]>('/admin/users', config),
    deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
    getInvites: (config?: any) => api.get<InviteCode[]>('/admin/invite-codes', config),
    generateInvite: () => api.post<InviteCode>('/admin/invite-codes'),
};

export const taskApi = {
    getTasks: () => api.get<Task[]>('/tasks/'),
    createTask: (data: any) => api.post<Task>('/tasks/', data),
    updateTask: (id: number, data: any) => api.put<Task>(`/tasks/${id}`, data),
    deleteTask: (id: number) => api.delete(`/tasks/${id}`),
};

export const libApi = {
    getLibs: () => api.get<Lib[]>('/library/list'),
    getFloors: (libId: number) => api.get<Floor[]>(`/library/${libId}/floors`),
    getLayout: (libId: number) => api.get<any>(`/library/${libId}/layout`),
    getReserveInfo: () => api.get<any>('/library/reserve'),
    reserveSeat: (libId: number, seatKey: string) => api.post('/library/reserve', null, { params: { lib_id: libId, seat_key: seatKey } }),
    cancelReserve: () => api.delete('/library/reserve'),
    getFrequentSeats: () => api.get<any[]>('/library/frequent-seats'),
    getUserInfo: () => api.get<any>('/library/user_info'),
    signin: () => api.post<any>('/library/signin'),
};

export default api;
