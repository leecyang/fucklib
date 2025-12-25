import axios from 'axios';
import { alert } from '../components/Dialog';

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
    const detailStr = String(detail);
    const reqUrl = String(error?.config?.url || '');
    
    if (status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    } else if (msg.includes('无法解析学号')) {
      alert('无法解析学号，请前往公众号检查是否已登录“我去图书馆”小程序', '绑定失败');
    } else if (msg.includes('40005') || msg.includes('绑定学号')) {
      alert('请先在微信端绑定学号，并在设置中更新 Cookie', '需要绑定学号');
    } else if (
      reqUrl.includes('/library/reserve') &&
      (
        detailStr.includes('临时限制预约用户') ||
        detailStr.includes('异常预约') ||
        (Array.isArray(error?.response?.data?.errors) && error.response.data.errors.some((e: any) => e.code === 1)) ||
        detailStr.includes('"code": 1') ||
        detailStr.includes("'code': 1")
      )
    ) {
      alert('您的账号当前被限制预约，请在设置页查看解除时间或稍后再试', '限制预约');
    } else if (
      detailStr.includes('预约限制') ||
      detailStr.includes('被限制预约') ||
      msg.includes('临时限制') ||
      msg.includes('40001')
    ) {
      alert('您的账号当前被限制预约，请在设置页查看解除时间或稍后再试', '限制预约');
    } else if (status === 403 || status === 500 || msg.includes('40001') || msg.includes('access denied') || msg.includes('临时限制')) {
      // Handle 500 errors that might contain JSON in detail (Flask behavior)
      let isBan = false;
      const detailStr = String(detail);
      
      if (msg.includes('异常预约') || detailStr.includes('异常预约')) {
          isBan = true;
      } else if (Array.isArray(error?.response?.data?.errors)) {
          isBan = error.response.data.errors.some((e: any) => e.code === 1);
      } else if (detailStr.includes('"code": 1') || detailStr.includes("'code': 1")) {
          // Sometimes 500 error detail is a stringified Python list/dict
          isBan = true;
      }

      if (isBan) {
          alert('您因尝试预约非法座位导致账号被封禁', '账号被封禁');
          // Force refresh user info to show ban status in settings
          libApi.getUserInfo().catch(console.error);
      } else if (status !== 500) {
          alert('会话受限或被拒绝，请刷新 Cookie / SessID 或稍后再试', '会话受限');
      } else {
          // Map common backend errors to Chinese
          let displayMsg = detailStr;
          let title = '系统错误';

          if (detailStr.includes('Reserve Failed') || detailStr.includes('Fatal Reverse') || detailStr.includes('系统未确认座位')) {
              displayMsg = '预约失败：系统未确认座位，请稍后重试。这通常是因为座位已被他人抢占。';
              title = '预约失败';
          } else if (detailStr.includes('Prereserve Failed')) {
              displayMsg = '预选失败，请稍后重试';
              title = '预选失败';
          } else if (detailStr.includes('Cancel Failed')) {
              displayMsg = '取消失败，请刷新页面后重试';
              title = '取消失败';
          } else if (detailStr.includes('Unknown API Error')) {
              displayMsg = '未知 API 错误，请稍后重试';
          }

          // Truncate if still too long
          if (displayMsg.length > 200) {
              displayMsg = displayMsg.substring(0, 200) + '...';
          }

          alert(displayMsg, title);
      }
    } else {
        // Generic errors
        if (detail) {
            let displayMsg = String(detail);
            let title = '请求错误';
            
            // Map generic errors if they appear here
             if (displayMsg.includes('Reserve Failed') || displayMsg.includes('Fatal Reverse')) {
                  displayMsg = '预约失败：系统未确认座位，请稍后重试。';
                  title = '预约失败';
             }

            alert(displayMsg, title);
        }
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
    remark?: string;
    next_run?: string;
}

export interface Lib {
    id: number;
    name: string;
    status: number;
    open_time_str?: string;
    close_time_str?: string;
    advance_booking?: string;
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

export const authApi = {
    getMe: () => api.get<User>('/auth/me'),
};

export const taskApi = {
    getTasks: () => api.get<Task[]>('/tasks/'),
    createTask: (data: any) => api.post<Task>('/tasks/', data),
    updateTask: (id: number, data: any) => api.put<Task>(`/tasks/${id}`, data),
    deleteTask: (id: number) => api.delete(`/tasks/${id}`),
    toggleTask: (id: number) => api.patch<Task>(`/tasks/${id}/toggle`, null),
};

export const libApi = {
    getLibs: () => api.get<Lib[]>('/library/list'),
    getFloors: (libId: number) => api.get<Floor[]>(`/library/${libId}/floors`),
    getLayout: (libId: number) => api.get<any>(`/library/${libId}/layout`),
    getReserveInfo: () => api.get<{ selection_status?: 'reserved'|'checked-in'; status?: number; lib_id?: number; seat_key?: string; seat_name?: string; token?: string; [k: string]: any } | null>('/library/reserve'),
    reserveSeat: (libId: number, seatKey: string) => api.post('/library/reserve', null, { params: { lib_id: libId, seat_key: seatKey } }),
    cancelReserve: () => api.delete('/library/reserve'),
    getFrequentSeats: () => api.get<Array<{ lib_id: number; seat_key: string; info?: string; selection_status?: 'pre-selected'; [k: string]: any }>>('/library/frequent-seats'),
    getUserInfo: () => api.get<any>('/library/user_info'),
    signin: () => api.post<any>('/library/signin'),
};

// Bark配置和通知相关类型
export interface BarkConfig {
    id: number;
    user_id: number;
    device_token: string;
    server_url: string;
    is_enabled: boolean;
    subscriptions: string[];
    created_at: string;
    updated_at: string;
}

export interface BarkNotification {
    id: number;
    user_id: number;
    notification_type: string;
    title: string;
    content: string;
    icon?: string;
    url?: string;
    status: string;
    error_message?: string;
    created_at: string;
}

export interface BarkConfigUpdate {
    device_token?: string;
    server_url?: string;
    is_enabled?: boolean;
    subscriptions?: string[];
}

export const barkApi = {
    getConfig: () => api.get<BarkConfig>('/bark/config'),
    updateConfig: (data: BarkConfigUpdate) => api.put<BarkConfig>('/bark/config', data),
    testPush: () => api.post<{ success: boolean; message: string }>('/bark/test'),
    getNotifications: (page: number = 1, limit: number = 20) => 
        api.get<{ total: number; page: number; limit: number; items: BarkNotification[] }>(
            `/bark/notifications?page=${page}&limit=${limit}`
        ),
};

export default api;
