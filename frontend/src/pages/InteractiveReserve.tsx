import React, { useEffect, useState } from 'react';
import { libApi, type Lib, type Seat } from '../api/client';
import { cn } from '../lib/utils';
import { MapPin, Bluetooth, Check, X, Clock, AlertCircle } from 'lucide-react';

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
  
  const handleReserveSelected = async () => {
    if (!selectedLib || !selectedSeatKey) {
      alert('请先在上方选择座位');
      return;
    }
    await handleReserve(selectedSeatKey);
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
  // ==================================================================================
  // BUSINESS LOGIC END
  // ==================================================================================

  const renderSeats = (seatList: Seat[]) => {
      return (
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {seatList.map(seat => {
                  const isFree = seat.status === 1;
                  const isMine = reserveInfo && (reserveInfo.seat_key ? reserveInfo.seat_key === seat.key : reserveInfo?.seatKey === seat.key);
                  const isSelected = selectedSeatKey === seat.key;

                  // Modern Visual Map Logic
                  return (
                    <div 
                        key={seat.key} 
                        className={cn(
                            "relative aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm",
                            isMine 
                                ? "bg-indigo-600 text-white animate-pulse shadow-indigo-200 ring-2 ring-indigo-200" 
                                : isSelected 
                                    ? "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 z-10 scale-110 shadow-md"
                                    : isFree 
                                        ? "bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5" 
                                        : "bg-slate-100 text-slate-300 border border-transparent cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (!isMine && isFree) {
                            setSelectedSeatKey(seat.key);
                            setSelectedSeatName(seat.name);
                          }
                        }}
                        title={`${seat.name} (${seat.status === 1 ? 'Available' : 'Unavailable'})`}
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
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 -mx-4 md:-mx-8 px-4 md:px-8 py-4 mb-6 flex flex-col md:flex-row gap-4 md:items-center justify-between shadow-sm">
         <div className="flex-1 max-w-md">
             <div className="relative">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <select 
                     className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 shadow-sm transition-all" 
                     value={selectedLib || ''} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLibChange(Number(e.target.value))}
                    disabled={loading}
                 >
                     <option value="">Select Library & Floor...</option>
                    {libs.map((l: Lib) => <option key={l.id} value={l.id}>{l.name} {l.status === 1 ? '' : '(Closed)'}</option>)}
                 </select>
             </div>
             {libsError && <div className="text-rose-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {libsError}</div>}
         </div>
         
         {/* Status Indicators (Legend) */}
         <div className="flex gap-4 text-xs text-slate-500 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300"></span>Available</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>Mine</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>Taken</div>
         </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
          {/* Reservation Status Card */}
          {reserveInfo && (
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <Clock className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-indigo-900">Active Reservation</h3>
                          <div className="text-indigo-700 text-sm mt-1 space-y-0.5">
                              {(() => {
                                const libId = reserveInfo.lib_id || reserveInfo.libId;
                                const seatKey = reserveInfo.seat_key || reserveInfo.seatKey;
                                const lib = libs.find(l => l.id === libId);
                                const floor = lib ? (lib.name.split(' - ')[1] || lib.name) : libId;
                                const seatName = reserveSeatName || (selectedLib === libId && Array.isArray(seats) ? (seats.find(s => s.key === seatKey)?.name || seatKey) : seatKey);
                                const statusText = reserveInfo.status === 3 ? 'Seated' : 'Waiting for Sign-in';
                                return (
                                  <>
                                    <p className="flex items-center gap-2"><span className="opacity-70">Location:</span> <span className="font-medium">{floor}</span></p>
                                    <p className="flex items-center gap-2"><span className="opacity-70">Seat:</span> <span className="font-mono font-bold bg-white/50 px-1.5 rounded">{seatName}</span></p>
                                    <p className="flex items-center gap-2"><span className="opacity-70">Status:</span> <span className="font-medium">{statusText}</span></p>
                                  </>
                                )
                              })()}
                          </div>
                      </div>
                  </div>
                  <button onClick={handleCancel} className="w-full md:w-auto px-6 py-2.5 bg-white text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors font-medium shadow-sm flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Cancel
                  </button>
              </div>
          )}

          {/* Quick Reserve Frequent Seats */}
          {frequent && frequent.length > 0 && (
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Frequent Seats</h4>
                <div className="flex flex-wrap gap-3">
                    {frequent.map((s) => (
                    <button
                        key={s.seat_key}
                        onClick={() => handleReserve(s.seat_key)}
                        className={cn(
                            "group flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all shadow-sm",
                            frequentStatus[`${s.lib_id}:${s.seat_key}`] 
                                ? "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer" 
                                : "bg-slate-50 border-transparent opacity-60 cursor-not-allowed"
                        )}
                        disabled={!frequentStatus[`${s.lib_id}:${s.seat_key}`]}
                    >
                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold font-mono group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            {s.info || s.seat_key}
                        </span>
                        <div className="flex flex-col items-start">
                            <span className="font-medium text-slate-700">Quick Book</span>
                            <span className={cn("text-xs", frequentStatus[`${s.lib_id}:${s.seat_key}`] ? "text-emerald-600" : "text-rose-500")}>
                                {frequentStatus[`${s.lib_id}:${s.seat_key}`] ? 'Available' : 'Taken'}
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
                  <p>Loading layout...</p>
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
                 No seats available to display
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
                   Book {selectedSeatName}
               </button>
           )}

           {/* Bluetooth Sign-in FAB (Always visible) */}
           <button
              onClick={async () => {
                try {
                  const res = await libApi.signin();
                  alert(res.data?.message || '已发起签到');
                } catch (err: any) {
                  alert('签到失败: ' + (err.response?.data?.detail || err.message));
                }
              }}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-indigo-200/50 hover:scale-105 transition-all px-6 py-3 rounded-full flex items-center gap-2 font-bold"
           >
              <Bluetooth className="w-5 h-5" />
              Bluetooth Sign-in
           </button>
      </div>
    </div>
  );
};

export default InteractiveReserve;
