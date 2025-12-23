import React, { useEffect, useState } from 'react';
import { libApi, type Lib, type Seat } from '../api/client';

interface SeatPickerProps {
  onClose: () => void;
  onPick: (data: { libId: number, libName: string, seatKey: string, seatName: string }) => void;
  ignoreTimeCheck?: boolean;
  ignoreSeatStatus?: boolean;
}

const SeatPicker: React.FC<SeatPickerProps> = ({ onClose, onPick, ignoreTimeCheck = false, ignoreSeatStatus = false }) => {
  const [libs, setLibs] = useState<Lib[]>([]);
  const [selectedLib, setSelectedLib] = useState<number | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await libApi.getLibs();
        const data = res.data || [];
        setLibs(data);
        if (data.length > 0) {
          const firstOpen = data.find(l => l.status === 1) || data[0];
          handleLibChange(firstOpen.id);
        }
      } catch (e) {
        setError('场馆列表获取失败，请检查授权或稍后重试');
      }
    })();
  }, []);

  const handleLibChange = async (libId: number) => {
    setSelectedLib(libId);
    setLoading(true);
    setError(null);
    try {
      const res = await libApi.getLayout(libId);
      const seatList = res.data?.lib_layout?.seats || [];
      setSeats(seatList);
    } catch (e) {
      setError('座位数据获取失败，请稍后重试');
      setSeats([]);
    } finally {
      setLoading(false);
    }
  };

  const pickSeat = (seat: Seat) => {
    if (!selectedLib) return;
    const libName = libs.find(l => l.id === selectedLib)?.name || String(selectedLib);
    onPick({ libId: selectedLib, libName, seatKey: seat.key, seatName: seat.name });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-xl shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">选择座位</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">选择场馆 (图书馆 - 楼层)</label>
          <select
            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedLib || ''}
            onChange={(e) => handleLibChange(Number(e.target.value))}
          >
            <option value="">请选择...</option>
            {libs.map(l => <option key={l.id} value={l.id}>{l.name} {l.status === 1 ? '' : '(闭馆)'}</option>)}
          </select>
        </div>
        <div className="max-h-[60vh] overflow-auto border rounded p-3">
          {loading && <div className="text-center py-6 text-gray-500">正在加载座位...</div>}
          {error && !loading && <div className="text-red-600 text-sm mb-2">{error}</div>}
          {!loading && seats.length > 0 && (
            <div className="grid grid-cols-5 sm:grid-cols-8 xl:grid-cols-10 gap-2">
              {seats.map(seat => {
                const libObj = selectedLib ? libs.find(l => l.id === selectedLib) : null;
                const openStr = libObj?.open_time_str;
                const closeStr = libObj?.close_time_str;
                const toMin = (s: string) => {
                  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
                  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                };
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const o = openStr ? toMin(openStr) : undefined;
                const c = closeStr ? toMin(closeStr) : undefined;
                const within = ignoreTimeCheck ? true : ((o === undefined || c === undefined) ? true : (c >= o ? (nowMin >= o && nowMin <= c) : (nowMin >= o || nowMin <= c)));
                const statusFree = (seat as any).seat_status === 1 || seat.status === 1;
                const canPick = ignoreSeatStatus ? true : (statusFree && within);
                return (
                  <button
                    key={seat.key}
                    className={`py-1 px-2 text-center border rounded text-xs transition-colors
                      ${canPick ? 'bg-white hover:bg-gray-50 border-gray-300 text-gray-800'
                      : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                    onClick={() => canPick && pickSeat(seat)}
                    title={`状态: ${canPick ? '可选择(定时任务)' : (within ? '不可选择' : `闭馆 (${openStr || '-'} - ${closeStr || '-'})`)}`}
                  >
                    {seat.name}
                  </button>
                )
              })}
            </div>
          )}
          {!loading && seats.length === 0 && <div className="text-center py-6 text-gray-500">暂无座位数据</div>}
        </div>
      </div>
    </div>
  );
};

export default SeatPicker;
