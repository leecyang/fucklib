import React, { useEffect, useState } from 'react';
import { libApi, type Lib, type Seat } from '../api/client';

const InteractiveReserve: React.FC = () => {
  const [libs, setLibs] = useState<Lib[]>([]);
  const [selectedLib, setSelectedLib] = useState<number | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reserveInfo, setReserveInfo] = useState<any>(null);
  const [libsError, setLibsError] = useState<string | null>(null);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [frequentStatus, setFrequentStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLibs();
    fetchReserveInfo();
    fetchFrequent();
  }, []);

  const fetchLibs = async () => {
    try {
      const res = await libApi.getLibs();
      const data = res.data || [];
      setLibs(data);
      setLibsError(data.length === 0 ? '未获取到场馆数据，请检查授权或稍后重试' : null);
      if (data.length > 0) {
        const firstOpen = data.find((l) => l.status === 1) || data[0];
        handleLibChange(firstOpen.id);
      }
    } catch (err) {
      console.error(err);
      setLibsError('场馆列表获取失败，请先登录并在设置页绑定微信 Cookie');
    }
  };
  
  const fetchReserveInfo = async () => {
      try {
          const res = await libApi.getReserveInfo();
          setReserveInfo(res.data);
      } catch (err) {
          console.error(err);
      }
  }
  
  const fetchFrequent = async () => {
    try {
      const res = await libApi.getFrequentSeats();
      const list = Array.isArray(res.data) ? res.data.slice(0, 2) : [];
      setFrequent(list);
      const statusMap: Record<string, boolean> = {};
      for (const s of list) {
        try {
          const layout = await libApi.getLayout(s.lib_id);
          const seatList = layout.data?.lib_layout?.seats || [];
          const found = seatList.find((st: any) => st.key === s.seat_key);
          statusMap[`${s.lib_id}:${s.seat_key}`] = found ? found.status === 1 : false;
        } catch (e) {
          statusMap[`${s.lib_id}:${s.seat_key}`] = false;
        }
      }
      setFrequentStatus(statusMap);
    } catch (e) {
      console.error(e);
    }
  }

  const handleLibChange = async (libId: number) => {
    setSelectedLib(libId);
    setSeats(null);
    setLoading(true);
    setSeatsError(null);
    try {
      const res = await libApi.getLayout(libId);
      if (!res.data || !res.data.lib_layout || !Array.isArray(res.data.lib_layout.seats)) {
        setSeatsError('未获取到座位数据，可能是 Cookie 失效或场馆暂不可用');
        setSeats([]);
        return;
      }
      const seatList = res.data.lib_layout.seats || [];
      setSeats(seatList);
    } catch (err) {
      console.error(err);
      setSeatsError('座位数据获取失败，请稍后重试');
    } finally {
        setLoading(false);
    }
  };

  const handleReserve = async (seatKey: string) => {
    if (!selectedLib) return;
    if (!confirm(`确认预约座位 ${seatKey} 吗？`)) return;
    try {
      await libApi.reserveSeat(selectedLib, seatKey);
      alert('预约成功');
      fetchReserveInfo();
      handleLibChange(selectedLib);
    } catch (err: any) {
      alert('预约失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCancel = async () => {
      if(!confirm('确认取消预约吗？')) return;
      try {
          await libApi.cancelReserve();
          alert('取消成功');
          setReserveInfo(null);
          if (selectedLib) handleLibChange(selectedLib);
      } catch (err: any) {
          alert('取消失败: ' + (err.response?.data?.detail || err.message));
      }
  }

  const renderSeats = (seatList: Seat[]) => {
      return (
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {seatList.map(seat => {
                  const isFree = seat.status === 1;
                  const isMine = reserveInfo && (reserveInfo.seat_key ? reserveInfo.seat_key === seat.key : reserveInfo?.seatKey === seat.key);
                  const statusCode = reserveInfo?.status;
                  const isSeated = statusCode === 3;
                  const isNotSigned = isMine && !isSeated;
                  return (
                    <div 
                        key={seat.key} 
                        className={`
                            p-2 text-center border rounded text-sm transition-colors
                            ${isMine && isSeated ? 'bg-blue-200 border-blue-400 text-blue-900'
                              : isNotSigned ? 'bg-green-200 border-green-400 text-green-900'
                              : isFree ? 'bg-white hover:bg-gray-50 border-gray-300 cursor-pointer text-gray-800'
                              : 'bg-red-50 border-red-200 text-gray-400'}
                        `}
                        onClick={() => isFree && !isMine && handleReserve(seat.key)}
                        title={`Status: ${seat.status}, Type: ${seat.type}`}
                    >
                        {seat.name}
                    </div>
                  )
              })}
          </div>
      )
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">预约</h1>
      
      {/* Reserve Info Card */}
      {reserveInfo && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
              <div>
                  <h3 className="font-bold text-blue-800">当前已有预约</h3>
                  <div className="text-blue-600 text-sm mt-1">
                      {(() => {
                        const libId = reserveInfo.lib_id || reserveInfo.libId;
                        const seatKey = reserveInfo.seat_key || reserveInfo.seatKey;
                        const lib = libs.find(l => l.id === libId);
                        const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : libId;
                        const fetchSeatFromLayout = (sid: number, skey: string): { name?: string, status?: number } => {
                          // Prefer current seats if same lib
                          if (selectedLib === sid && Array.isArray(seats)) {
                            const found = seats.find(s => s.key === skey);
                            if (found) return { name: found.name, status: found.status };
                          }
                          return {};
                        };
                        const info = fetchSeatFromLayout(libId, seatKey);
                        const seatName = info.name || seatKey;
                        const statusText = reserveInfo.status === 3 ? '已入座' : '未签到';
                        return (
                          <>
                            <p>楼层: <span className="font-bold">{floor}</span></p>
                            <p>座位: <span className="font-mono font-bold">{seatName}</span></p>
                            <p>状态: {statusText}</p>
                          </>
                        )
                      })()}
                  </div>
              </div>
              <button onClick={handleCancel} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors shadow">
                  取消预约
              </button>
          </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
                 <label className="block text-sm font-medium text-gray-700 mb-1">选择场馆 (图书馆 - 楼层)</label>
                 <select 
                     className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                     value={selectedLib || ''} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLibChange(Number(e.target.value))}
                    disabled={loading}
                 >
                     <option value="">请选择...</option>
                    {libs.map((l: Lib) => <option key={l.id} value={l.id}>{l.name} {l.status === 1 ? '' : '(闭馆)'}</option>)}
                 </select>
                {libsError && <div className="text-red-600 text-sm mt-2">{libsError}</div>}
             </div>
         </div>
       </div>

      {loading && <div className="text-center py-8 text-gray-500">正在加载座位信息...</div>}

      {seatsError && !loading && <div className="text-center py-6 text-red-600">{seatsError}</div>}

      {seats && seats.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h4 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
                   <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                   座位分布
              </h4>
              {renderSeats(seats)}
          </div>
      )}
      {!loading && seats && seats.length === 0 && (
        <div className="text-center py-6 text-gray-500">暂无座位数据</div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h4 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
          <span className="w-2 h-6 bg-green-500 rounded-full"></span>
          常用座位快捷预约
        </h4>
        {frequent && frequent.length > 0 ? (
          <div className="flex gap-2">
            {frequent.map((s) => (
              <button
                key={s.seat_key}
                onClick={() => handleReserve(s.seat_key)}
                className={`px-3 py-2 rounded border text-sm ${frequentStatus[`${s.lib_id}:${s.seat_key}`] ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                title={`Lib: ${s.lib_id}`}
                disabled={!frequentStatus[`${s.lib_id}:${s.seat_key}`]}
              >
                <span className="mr-2">{s.info || s.seat_key}</span>
                <span className={`text-xs ${frequentStatus[`${s.lib_id}:${s.seat_key}`] ? 'text-green-600' : 'text-red-600'}`}>
                  {frequentStatus[`${s.lib_id}:${s.seat_key}`] ? '可预约' : '不可预约'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">未配置常用座位或无法获取</div>
        )}
        <div className="mt-4">
          <button
            onClick={async () => {
              try {
                const res = await libApi.signin();
                alert(res.data?.message || '已发起签到');
              } catch (err: any) {
                alert('签到失败: ' + (err.response?.data?.detail || err.message));
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow"
          >
            蓝牙签到
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractiveReserve;
