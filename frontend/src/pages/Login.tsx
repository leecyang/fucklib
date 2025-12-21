import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const res = await api.post('/auth/token', formData);
      localStorage.setItem('token', res.data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请检查账号密码或稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100">
      <div className="bg-white/90 backdrop-blur p-10 rounded-2xl shadow-xl w-full max-w-md border border-blue-50">
        <h2 className="text-3xl font-bold mb-2 text-center text-gray-900">登录 FuckLib 管理后台</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">使用管理员邀请注册的账号密码登录系统</p>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">密码</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            登录
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/register" className="text-blue-600 hover:underline">
            还没有账号？去注册
          </Link>
        </div>
      </div>
    </div>
  );
}
