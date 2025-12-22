import { useEffect, useState } from 'react';
import api, { libApi, taskApi, type Task, type Lib } from '../api/client';
import { User, CreditCard, School, CheckCircle, XCircle, Clock, MapPin, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [config, setConfig] = useState<any>(null);
  const [seatInfo, setSeatInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [libs, setLibs] = useState<Lib[]>([]);
  const [layoutCache, setLayoutCache] = useState<Record<number, Record<string, any>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const configRes = await api.get('/library/config');
      setConfig(configRes.data);
      try {
        const libsRes = await libApi.getLibs();
        setLibs(libsRes.data || []);
      } catch (e) {
        console.error('场馆列表获取失败', e);
      }
      try {
        const resTasks = await taskApi.getTasks();
        setTasks(resTasks.data || []);
      } catch (e) {
        console.error('任务列表获取失败', e);
      }
      
      if (configRes.data.cookie) {
        const seatRes = await api.get('/library/seat_info');
        setSeatInfo(seatRes.data);
        // Preload layouts for involved libs
        const seatsArr = Array.isArray(seatRes.data) ? seatRes.data : seatRes.data ? [seatRes.data] : [];
        const libIds = Array.from(new Set(seatsArr.map((s: any) => s.lib_id)));
        const cache: Record<number, Record<string, any>> = {};
        for (const id of libIds) {
          try {
            const layoutRes = await libApi.getLayout(id);
            const seatList = layoutRes.data?.lib_layout?.seats || [];
            cache[id] = {};
            seatList.forEach((st: any) => { cache[id][st.key] = st; });
          } catch (e) {
            console.error('座位布局获取失败', e);
          }
        }
        setLayoutCache(cache);
        
        try {
            const userRes = await libApi.getUserInfo();
            setUserInfo(userRes.data.currentUser);
        } catch (e) {
            console.error("Failed to fetch user info", e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, check your library status.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: User Status (Wide on large screens if possible, currently standard grid) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all duration-200 lg:col-span-1">
          <div>
            <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <User className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{userInfo?.user_student_name || '未登录'}</h2>
                    <p className="text-slate-500 font-mono text-sm">{userInfo?.user_student_no || 'No ID'}</p>
                </div>
            </div>
            
            <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <School className="w-4 h-4" />
                        <span>School</span>
                    </div>
                    <span className="font-medium text-slate-900 text-sm">{userInfo?.user_sch || '-'}</span>
                 </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <div className={cn("px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1", config?.cookie ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                {config?.cookie ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                Cookie
            </div>
            <div className={cn("px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1", config?.sess_id ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {config?.sess_id ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                Session
            </div>
            <div className={cn("px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1", config?.major && config?.minor ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                <Zap className="w-3 h-3"/>
                Bluetooth
            </div>
          </div>
        </div>

        {/* Card 2: Quick Seat (Current Seat) */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-xl shadow-lg text-white transform transition-all duration-200 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group lg:col-span-1">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl group-hover:scale-110 transition-transform"></div>
             
             <h2 className="text-lg font-semibold text-indigo-100 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Current Seat
             </h2>

             {seatInfo && (Array.isArray(seatInfo) ? seatInfo.length > 0 : seatInfo) ? (
                <div className="space-y-4 relative z-10">
                   {(() => {
                      const seats = Array.isArray(seatInfo) ? seatInfo : [seatInfo];
                      const seat = seats[0]; // Display first seat for now
                      const lib = libs.find(l => l.id === seat.lib_id);
                      const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : seat.lib_id;
                      const seatObj = layoutCache[seat.lib_id]?.[seat.seat_key];
                      const seatName = seatObj?.name || seat.info || seat.seat_key;
                      
                      return (
                          <>
                            <div className="text-4xl font-bold font-mono tracking-tight">{seatName}</div>
                            <div className="text-indigo-200 font-medium">{floor}</div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs backdrop-blur-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Active
                            </div>
                          </>
                      )
                   })()}
                </div>
             ) : (
                <div className="h-full flex flex-col justify-center items-center text-indigo-200 gap-3">
                    <p>No active reservation</p>
                    <Link to="/reserve" className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors">
                        Book Now
                    </Link>
                </div>
             )}
        </div>
        
        {/* Card 3: Task Radar */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Task Radar
            </h2>
            
            <div className="flex-1 space-y-4">
                {tasks && tasks.length > 0 ? tasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-slate-700">
                                {t.task_type === 'signin' ? 'Auto Sign-in' : 'Reservation'}
                            </span>
                            <span className="font-mono text-xs text-slate-400">{t.cron_expression}</span>
                        </div>
                        {/* Progress Bar Simulation */}
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={cn("h-full rounded-full transition-all duration-1000", t.is_enabled ? "bg-indigo-500 w-3/4 animate-pulse" : "bg-slate-300 w-full")}
                                style={{ width: t.is_enabled ? '75%' : '100%' }} // Static width for now as "radar"
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>{t.is_enabled ? 'Active' : 'Paused'}</span>
                            <span className={t.last_status === 'success' ? 'text-emerald-500' : 'text-slate-400'}>
                                {t.last_status || 'Pending'}
                            </span>
                        </div>
                    </div>
                )) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                        No scheduled tasks
                    </div>
                )}
            </div>
            
            <Link to="/tasks" className="mt-4 text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View All Tasks &rarr;
            </Link>
        </div>
      </div>
    </div>
  );
}
