import { useEffect, useState } from 'react';
import api, { libApi, taskApi, type Task, type Lib } from '../api/client';

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

  if (loading) return <div className="text-center text-gray-500">数据加载中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">首页概览</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">个人信息</h2>
          {userInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">姓名：</span>
                <span className="font-bold">{userInfo.user_student_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">学号：</span>
                <span className="font-mono">{userInfo.user_student_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">学校：</span>
                <span>{userInfo.user_sch}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              {config?.cookie ? "获取个人信息失败" : "请先配置微信 Cookie"}
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">状态概览</h2>
            <a
              href="/settings"
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              去设置
            </a>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">微信 Cookie：</span>
              <span className={config?.cookie ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {config?.cookie ? "已连接" : "未连接"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">签到授权链接：</span>
              <span className={config?.sess_id ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {config?.sess_id ? "已配置" : "未配置"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">蓝牙配置 (Major/Minor)：</span>
              <span className={config?.major && config?.minor ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {config?.major && config?.minor ? `${config.major} / ${config.minor}` : "未配置"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">当前常用座位</h2>
          {seatInfo && seatInfo.length > 0 ? (
            <div className="space-y-4">
              {Array.isArray(seatInfo) ? seatInfo.map((seat: any) => (
                <div key={seat.id} className="border-b pb-2 last:border-b-0">
                  {(() => {
                    const lib = libs.find(l => l.id === seat.lib_id);
                    const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : seat.lib_id;
                    const seatObj = layoutCache[seat.lib_id]?.[seat.seat_key];
                    const seatName = seatObj?.name || seat.info || seat.seat_key;
                    const isFree = (seatObj?.status ?? seat.status) === 1;
                    return (
                      <>
                        <p><span className="font-semibold">楼层：</span> {floor}</p>
                        <p><span className="font-semibold">座位：</span> {seatName}</p>
                        <p><span className="font-semibold">状态：</span> {isFree ? '可预约' : '不可预约'}</p>
                      </>
                    )
                  })()}
                </div>
              )) : (
                <div className="border-b pb-2 last:border-b-0">
                   {(() => {
                      const lib = libs.find(l => l.id === seatInfo.lib_id);
                      const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : seatInfo.lib_id;
                      const seatObj = layoutCache[seatInfo.lib_id]?.[seatInfo.seat_key];
                      const seatName = seatObj?.name || seatInfo.info || seatInfo.seat_key;
                      const isFree = (seatObj?.status ?? seatInfo.status) === 1;
                      return (
                        <>
                          <p><span className="font-semibold">楼层：</span> {floor}</p>
                          <p><span className="font-semibold">座位：</span> {seatName}</p>
                          <p><span className="font-semibold">状态：</span> {isFree ? '可预约' : '不可预约'}</p>
                        </>
                      )
                   })()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">
              未获取到常用座位信息，请先在「我去图书馆」公众号中设置常用座位，
              并在本系统设置页面更新微信 Cookie 后再查看。
            </p>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">定时任务概览</h2>
          {tasks && tasks.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-5 text-xs text-gray-500 pb-2 border-b">
                <div>任务类型</div>
                <div>Cron</div>
                <div>启用</div>
                <div>上次运行</div>
                <div>上次状态</div>
              </div>
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="grid grid-cols-5 text-sm border-b py-1 last:border-b-0">
                  <div>
                    {t.task_type === 'signin' ? '蓝牙签到' : t.task_type === 'reserve' ? '预约' : t.task_type}
                  </div>
                  <div className="font-mono">{t.cron_expression}</div>
                  <div>{t.is_enabled ? '是' : '否'}</div>
                  <div>{t.last_run ? new Date(t.last_run).toLocaleString() : '从未'}</div>
                  <div className={t.last_status === 'success' ? 'text-green-600' : 'text-red-600'}>
                    {t.last_status || '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">暂无任务，前往“定时任务”页面创建</p>
          )}
        </div>
      </div>
    </div>
  );
}
