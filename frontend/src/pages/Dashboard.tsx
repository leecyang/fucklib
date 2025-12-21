import { useEffect, useState } from 'react';
import api, { libApi } from '../api/client';

export default function Dashboard() {
  const [config, setConfig] = useState<any>(null);
  const [seatInfo, setSeatInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const configRes = await api.get('/library/config');
      setConfig(configRes.data);
      
      if (configRes.data.cookie) {
        const seatRes = await api.get('/library/seat_info');
        setSeatInfo(seatRes.data);
        
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
              <div className="flex justify-between">
                <span className="text-gray-600">性别：</span>
                <span>{userInfo.user_sex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">上次登录：</span>
                <span className="text-sm text-gray-500">{userInfo.user_last_login}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              {config?.cookie ? "获取个人信息失败" : "请先配置微信 Cookie"}
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">状态概览</h2>
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
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">当前常用座位</h2>
          {seatInfo && seatInfo.length > 0 ? (
            <div className="space-y-4">
              {Array.isArray(seatInfo) ? seatInfo.map((seat: any) => (
                <div key={seat.id} className="border-b pb-2 last:border-b-0">
                  <p><span className="font-semibold">座位信息：</span> {seat.info}</p>
                  <p><span className="font-semibold">座位键：</span> {seat.seat_key}</p>
                  <p><span className="font-semibold">图书馆 ID：</span> {seat.lib_id}</p>
                  <p><span className="font-semibold">状态：</span> {seat.status === 1 ? '可用' : '不可用'}</p>
                </div>
              )) : (
                <div className="border-b pb-2 last:border-b-0">
                   <p><span className="font-semibold">座位信息：</span> {seatInfo.info}</p>
                   <p><span className="font-semibold">座位键：</span> {seatInfo.seat_key}</p>
                   <p><span className="font-semibold">图书馆 ID：</span> {seatInfo.lib_id}</p>
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
      </div>
    </div>
  );
}
