import { Link, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Settings, LogOut, Map, Calendar } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 flex overflow-hidden">
      <aside className="w-64 bg-white shadow-md flex flex-col flex-shrink-0">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <BookOpen className="w-8 h-8" />
            FuckLib
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            首页概览
          </Link>
          <Link
            to="/reserve"
            className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <Map className="w-5 h-5" />
            预约
          </Link>
          <Link
            to="/tasks"
            className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <Calendar className="w-5 h-5" />
            定时任务
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            设置中心
          </Link>
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
