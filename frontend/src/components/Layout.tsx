import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Settings, LogOut, Map, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '首页概览', icon: BookOpen },
    { path: '/reserve', label: '预约', icon: Map },
    { path: '/tasks', label: '定时任务', icon: Calendar },
    { path: '/settings', label: '设置中心', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shadow-sm z-20">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
            <BookOpen className="w-8 h-8" />
            <span>FuckLib</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-slate-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-lg w-full transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto w-full">
        {/* Mobile Header (Fixed) */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-indigo-600 flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                FuckLib
            </h1>
            <div />
        </div>

        {/* Content Container - Added pt-20 for mobile header and pb-24 for bottom nav */}
        <div className="p-4 pt-20 md:pt-8 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full space-y-1",
                            isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <item.icon className={cn("w-6 h-6 transition-transform", isActive && "scale-110")} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                )
            })}
        </div>
      </nav>
    </div>
  );
}
