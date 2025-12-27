import React, { useEffect, useState } from 'react';
import { libApi, type Lib, type Seat } from '../api/client';
import { cn } from '../lib/utils';
import { MapPin, Bluetooth, Check, X, Clock, AlertCircle } from 'lucide-react';
import { confirm as customConfirm, alert as customAlert } from '../components/Dialog';

const InteractiveReserve: React.FC = () => {
  // ==================================================================================
  // BUSINESS LOGIC START - DO NOT MODIFY WITHOUT VERIFICATION
  // ==================================================================================
  const [libs, setLibs] = useState<Lib[]>([]);
  const [selectedLib, setSelectedLib] = useState<number | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reserveInfo, setReserveInfo] = useState<any>(null);
  const [libsError, setLibsError] = useState<string | null>(null);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [selectedSeatKey, setSelectedSeatKey] = useState<string | null>(null);
  const [selectedSeatName, setSelectedSeatName] = useState<string | null>(null);
  const [frequentStatus, setFrequentStatus] = useState<Record<string, boolean>>({});
  const [reserveSeatName, setReserveSeatName] = useState<string | null>(null);
  const [frequentNames, setFrequentNames] = useState<Record<string, string>>({});

  const checkLibOpen = (l: Lib) => {
    if (l.status !== 1) return false;
    if (!l.open_time_str || !l.close_time_str) return true;
    const toMin = (s: string) => {
      const [h, m] = s.split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const o = toMin(l.open_time_str);
    const c = toMin(l.close_time_str);
    if (c >= o) return nowMin >= o && nowMin <= c;
    return nowMin >= o || nowMin <= c;
  };

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
          console.log('DEBUG: fetchReserveInfo response:', res.data);
          setReserveInfo(res.data);
          
          // Check for supervision status (5)
          if (res.data?.status === 5) {
             console.log('Detected supervision status. Auto-signin scheduled in 3 seconds.');
             // Schedule auto-signin in 3 seconds (3000 ms)
             setTimeout(async () => {
                 try {
                     console.log('Triggering auto-signin for supervision...');
                     const signRes = await libApi.signin();
                     console.log('Auto-signin triggered successfully:', signRes);
                     await customAlert('检测到监督状态，系统已自动尝试签到。结果：' + (signRes.data?.message || '请求已发送'), '自动签到');
                     // Refresh info to update status
                     fetchReserveInfo();
                 } catch (e: any) {
                     console.error('Auto-signin failed:', e);
                     // Optional: notify user of failure
                     // await customAlert('自动签到失败: ' + (e.response?.data?.detail || e.message), '签到失败');
                 }
             }, 3 * 1000); 
          }

          try {
            const libId = res.data?.lib_id || res.data?.libId;
            const seatKey = res.data?.seat_key || res.data?.seatKey;
            if (libId && seatKey) {
              const layout = await libApi.getLayout(libId);
              const seatList = layout.data?.lib_layout?.seats || [];
              const found = seatList.find((s: any) => s.key === seatKey);
              setReserveSeatName(found?.name || seatKey || null);
            } else {
              setReserveSeatName(null);
            }
          } catch {
            setReserveSeatName(null);
          }
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
      const nameMap: Record<string, string> = {};
      for (const s of list) {
        try {
          const layout = await libApi.getLayout(s.lib_id);
          const seatList = layout.data?.lib_layout?.seats || [];
          const found = seatList.find((st: any) => st.key === s.seat_key);
          statusMap[`${s.lib_id}:${s.seat_key}`] = found ? (found.seat_status === 1 || found.status === 1) : false;
          if (found?.name) nameMap[`${s.lib_id}:${s.seat_key}`] = found.name;
        } catch (e) {
          statusMap[`${s.lib_id}:${s.seat_key}`] = false;
        }
      }
      setFrequentStatus(statusMap);
      setFrequentNames(nameMap);
    } catch (e) {
      console.error(e);
    }
  }

  const handleLibChange = async (libId: number) => {
    setSelectedLib(libId);
    setSeats(null);
    setLoading(true);
    setSeatsError(null);
    setSelectedSeatKey(null);
    setSelectedSeatName(null);
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
    const libObj = libs.find(l => l.id === selectedLib);
    const openStr = libObj?.open_time_str;
    const closeStr = libObj?.close_time_str;
    const toMin = (s: string) => {
      const [h, m] = s.split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    if (openStr && closeStr) {
      const now = new Date();
      const o = toMin(openStr);
      const c = toMin(closeStr);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const within = c >= o ? (nowMin >= o && nowMin <= c) : (nowMin >= o || nowMin <= c);
      if (!within) {
        customAlert(`当前楼层不在可预约时间段（${openStr} - ${closeStr}）`, '非开放时间');
        return;
      }
    }
    
    // Parse seat key to seat number if possible (Format usually 'X,Y' or similar, but we want the logical name)
    // Actually seatKey is the ID. We try to find the name.
    let displayName = seatKey;
    if (selectedLib && seats) {
        const found = seats.find(s => s.key === seatKey);
        if (found) displayName = found.name;
    }
    
    // Fallback if seat name is not found in current loaded seats (e.g. quick reserve)
    if (displayName === seatKey && frequentNames[selectedLib + ':' + seatKey]) {
        displayName = frequentNames[selectedLib + ':' + seatKey];
    }

    const confirmed = await customConfirm(
        <div className="space-y-2">
            <p>您即将预约：</p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium text-slate-700">
                 {libs.find(l => l.id === selectedLib)?.name} <br/>
                 <span className="text-indigo-600 font-bold text-lg">{displayName} 号座</span>
            </div>
            <p className="text-xs text-slate-400">请确保您能按时签到，违约将影响账号信用。或者使用远程蓝牙签到。</p>
        </div>,
        '确认预约'
    );
    
    if (!confirmed) return;

    try {
      const res = await libApi.reserveSeat(selectedLib, seatKey);
      if (res?.data && (res.data as any).status === 'restricted') {
        await customAlert((res.data as any).message || '您的账号当前被限制预约，请稍后再试', '限制预约');
        return;
      }
      await customAlert('预约成功！请在规定时间内前往签到。', '预约成功');
      fetchReserveInfo();
      handleLibChange(selectedLib);
    } catch (err: any) {
      // Error handling is delegated to client.ts interceptor for global errors,
      // but if it slips through or is a specific logic error:
      console.error(err);
      // Don't alert here if client.ts already did it. 
      // However, client.ts throws error, so we might catch it here.
      // We can check if it was handled? No easy way. 
      // But we can let client.ts handle the UI and just log here.
      // Or we can rely on our new alert.
      // Let's rely on interceptor for standard errors, but if we want specific UI:
      // Actually, standardizing on client.ts interceptor using our new Dialog is better.
    }
  };
  
  const handleReserveSelected = async () => {
    if (!selectedLib || !selectedSeatKey) {
      customAlert('请先在上方选择座位', '未选择座位');
      return;
    }
    await handleReserve(selectedSeatKey);
  };

  const handleCancel = async () => {
      if(!await customConfirm('确定要取消当前的座位预约吗？取消后座位将被释放。', '取消预约')) return;
      try {
          const res = await libApi.cancelReserve();
          const msg = res.data?.message || '';
          if (msg && msg.includes('退预选座位成功')) {
              await customAlert('退预选座位成功', '操作成功');
          } else {
              await customAlert('预约已取消', '取消成功');
          }
          setReserveInfo(null);
          if (selectedLib) handleLibChange(selectedLib);
      } catch (err: any) {
         // Interceptor handles
      }
  }
  // ==================================================================================
  // BUSINESS LOGIC END
  // ==================================================================================

  const renderSeats = (seatList: Seat[]) => {
      const libObj = selectedLib ? libs.find(l => l.id === selectedLib) : null;
      const isWithinWindow = libObj ? checkLibOpen(libObj) : true;
      // Check if user has an active reservation (Status > 0)
      const hasReservation = !!(reserveInfo && reserveInfo.status && reserveInfo.status > 0);

      return (
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {seatList.map(seat => {
                  // Normalize status: seat_status or status. 1 means Available.
                  const rawStatus = (seat as any).seat_status !== undefined ? (seat as any).seat_status : seat.status;
                  const isFree = rawStatus === 1;
                  
                  const isMine = reserveInfo && (reserveInfo.seat_key ? reserveInfo.seat_key === seat.key : reserveInfo?.seatKey === seat.key);
                  const isSelected = selectedSeatKey === seat.key;
                  
                  // Interaction Logic: Clickable only if window open, seat is free, and user has no reservation
                  const canBook = isWithinWindow && isFree && !hasReservation;
                  
                  // Visual Logic & Tooltip
                  let seatColorClass = "";
                  let tooltipStatus = "";

                  if (isMine) {
                      seatColorClass = "bg-indigo-600 text-white animate-pulse shadow-indigo-200 ring-2 ring-indigo-200 cursor-default";
                      tooltipStatus = "我的座位";
                  } else if (isSelected) {
                      seatColorClass = "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 z-10 scale-110 shadow-md cursor-pointer";
                      tooltipStatus = "已选中";
                  } else if (rawStatus === 1) {
                      // Status 1: Available
                      if (canBook) {
                          seatColorClass = "bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer";
                          tooltipStatus = "可预约";
                      } else {
                          // Available but Locked (Closed or User has reservation)
                          seatColorClass = "bg-white border-slate-200 text-slate-400 cursor-not-allowed"; 
                          if (!isWithinWindow) tooltipStatus = "已关闭";
                          else if (hasReservation) tooltipStatus = "不可预约 (已有预约)";
                          else tooltipStatus = "不可预约";
                      }
                  } else {
                      // Status != 1: Occupied / Special Statuses
                      // Mapping based on common backend status codes
                      switch (rawStatus) {
                          case 2: // Checked In
                          case 3: // Seated
                              seatColorClass = "bg-emerald-50 border border-emerald-100 text-emerald-600 cursor-not-allowed";
                              tooltipStatus = "使用中";
                              break;
                          case 4: // Away
                              seatColorClass = "bg-amber-50 border border-amber-100 text-amber-600 cursor-not-allowed";
                              tooltipStatus = "暂离";
                              break;
                          case 5: // Supervised
                              seatColorClass = "bg-rose-50 border border-rose-100 text-rose-600 cursor-not-allowed";
                              tooltipStatus = "被监督";
                              break;
                          default: // 0 or others
                              seatColorClass = "bg-slate-100 text-slate-300 border border-transparent cursor-not-allowed";
                              tooltipStatus = "不可预约";
                      }
                  }

                  return (
                    <div 
                        key={seat.key} 
                        className={cn(
                            "relative aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 shadow-sm",
                            seatColorClass
                        )}
                        onClick={() => {
                          if (!isMine && canBook) {
                            setSelectedSeatKey(seat.key);
                            setSelectedSeatName(seat.name);
                          }
                        }}
                        title={`${seat.name} (${tooltipStatus})`}
                    >
                        {seat.name}
                        {isMine && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
                        )}
                    </div>
                  )
              })}
          </div>
      )
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Sticky Header */}
      <div className="sticky top-[53px] md:top-0 z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 -mx-4 md:-mx-8 px-4 md:px-8 py-4 mb-6 flex flex-col md:flex-row gap-4 md:items-center justify-between shadow-sm">
         <div className="flex-1 max-w-md">
             <div className="relative">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <select 
                     className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 shadow-sm transition-all" 
                     value={selectedLib || ''} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLibChange(Number(e.target.value))}
                    disabled={loading}
                 >
                    <option value="">选择图书馆与楼层...</option>
                    {libs.map((l: Lib) => <option key={l.id} value={l.id}>{l.name} {checkLibOpen(l) ? '' : '(已关闭)'}</option>)}
                 </select>
             </div>
             {libsError && <div className="text-rose-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {libsError}</div>}
         </div>
         
         {/* Status Indicators (Legend) */}
         <div className="flex flex-wrap gap-3 text-xs text-slate-500 pb-1 md:pb-0 items-center">
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shadow-sm"></span>可预约</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse ring-1 ring-indigo-200"></span>我的</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-300"></span>使用中</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-300"></span>暂离</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-300"></span>被监督</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>不可用</div>
         </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
          {/* Reservation Status Card */}
          {reserveInfo && (
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <Clock className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-indigo-900">当前有效预约</h3>
                          <div className="text-indigo-700 text-sm mt-1 space-y-0.5">
                              {(() => {
                                const libId = reserveInfo.lib_id || reserveInfo.libId;
                                const seatKey = reserveInfo.seat_key || reserveInfo.seatKey;
                                const lib = libs.find(l => l.id === libId);
                                const libName = lib ? (lib.name.split(' - ')[0] || lib.name) : (reserveInfo.lib_name || '');
                                const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : (reserveInfo.lib_floor || libId);
                                const seatName = reserveSeatName || (selectedLib === libId && Array.isArray(seats) ? (seats.find(s => s.key === seatKey)?.name || seatKey) : seatKey);
                                const status = reserveInfo.status;
                                const statusText = reserveInfo.selection_status === 'reserved'
                                  ? '未签到'
                                  : status === 2
                                    ? '已签到'
                                    : status === 3
                                      ? '已入座'
                                      : status === 4
                                        ? '暂离'
                                        : status === 5
                                          ? '被监督(请尽快签到)'
                                          : '未知';
                                return (
                                  <>
                                    <p className="flex items-center gap-2"><span className="opacity-70">位置：</span> <span className="font-medium">{libName}</span>（<span className="font-medium">{floor}</span>）</p>
                                    <p className="flex items-center gap-2"><span className="opacity-70">座位：</span> <span className="font-mono font-bold bg-white/50 px-1.5 rounded">{seatName}</span></p>
                                    <p className="flex items-center gap-2"><span className="opacity-70">状态：</span> <span className={cn("font-medium", status === 5 ? "text-rose-600 font-bold animate-pulse" : "")}>{statusText}</span></p>
                                  </>
                                )
                              })()}
                          </div>
                      </div>
                  </div>
                  <button onClick={handleCancel} className="w-full md:w-auto px-6 py-2.5 bg-white text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors font-medium shadow-sm flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> 取消预约
                  </button>
              </div>
          )}

          {/* Quick Reserve Frequent Seats */}
          {frequent && frequent.length > 0 && (
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">我的备选</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
                    {frequent.map((s) => (
                    <button
                        key={s.seat_key}
                        onClick={() => handleReserve(s.seat_key)}
                        className={cn(
                            "group w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all shadow-sm",
                            frequentStatus[`${s.lib_id}:${s.seat_key}`] 
                                ? "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer" 
                                : "bg-slate-50 border-transparent opacity-60 cursor-not-allowed"
                        )}
                        disabled={!frequentStatus[`${s.lib_id}:${s.seat_key}`]}
                    >
                        <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold font-mono group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            {frequentNames[`${s.lib_id}:${s.seat_key}`] || s.seat_key}
                        </span>
                        <div className="flex flex-col items-start min-w-0">
                            <span className="font-medium text-slate-700 whitespace-nowrap truncate max-w-[16rem] sm:max-w-[12rem]">{s.info || '快捷预约'}</span>
                            <span className={cn("text-xs", frequentStatus[`${s.lib_id}:${s.seat_key}`] ? "text-emerald-600" : "text-rose-500")}>
                                {frequentStatus[`${s.lib_id}:${s.seat_key}`] ? '可预约' : '不可预约'}
                            </span>
                        </div>
                    </button>
                    ))}
                </div>
            </div>
          )}

          {/* Seat Map */}
          {loading && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                  <p>正在加载座位布局...</p>
              </div>
          )}

          {seatsError && !loading && (
              <div className="py-12 text-center bg-rose-50 rounded-xl border border-rose-100 text-rose-600 flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 opacity-50" />
                  {seatsError}
              </div>
          )}

          {seats && seats.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  {renderSeats(seats)}
              </div>
          )}
          
          {!loading && seats && seats.length === 0 && !seatsError && (
             <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                 暂无座位数据
             </div>
          )}
      </div>

      {/* Floating Action Bar (Bottom Right) */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 flex flex-col gap-3 items-end z-30">
           {/* Confirm Selection FAB (Only shows when seat selected) */}
           {selectedSeatKey && (
               <button
                  onClick={handleReserveSelected}
                  className="bg-slate-900 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all px-6 py-3 rounded-full flex items-center gap-2 font-medium"
               >
                   <Check className="w-5 h-5" />
                   预约 {selectedSeatName}
               </button>
           )}

           {/* Bluetooth Sign-in FAB (Always visible) */}
           <button
              onClick={async () => {
                try {
                  if (!reserveInfo) {
                    await customAlert('请您先预约座位再进行蓝牙签到。', '蓝牙签到');
                    return;
                  }
                  const res = await libApi.signin();
                  await customAlert(res.data?.message || '已发起签到', '蓝牙签到');
                } catch (err: any) {
                  await customAlert('签到失败: ' + (err.response?.data?.detail || err.message), '签到失败');
                }
              }}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-indigo-200/50 hover:scale-105 transition-all px-6 py-3 rounded-full flex items-center gap-2 font-bold"
           >
              <Bluetooth className="w-5 h-5" />
              蓝牙签到
           </button>
      </div>
    </div>
  );
};

export default InteractiveReserve;
