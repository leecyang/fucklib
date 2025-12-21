import React, { useEffect, useState } from 'react';
import { libApi, type Lib, type Floor, type Seat } from '../api/client';

const InteractiveReserve: React.FC = () => {
  const [libs, setLibs] = useState<Lib[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedLib, setSelectedLib] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [seats, setSeats] = useState<{regular: Seat[], monitor: Seat[]} | null>(null);
  const [loading, setLoading] = useState(false);
  const [reserveInfo, setReserveInfo] = useState<any>(null);

  useEffect(() => {
    fetchLibs();
    fetchReserveInfo();
  }, []);

  const fetchLibs = async () => {
    try {
      const res = await libApi.getLibs();
      setLibs(res.data);
    } catch (err) {
      console.error(err);
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

  const handleLibChange = async (libId: number) => {
    setSelectedLib(libId);
    setSelectedFloor(null);
    setSeats(null);
    try {
      const res = await libApi.getFloors(libId);
      setFloors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFloorChange = async (floorId: number) => {
    setSelectedFloor(floorId);
    setLoading(true);
    try {
      const res = await libApi.getLayout(floorId);
      const regular = res.data.seats_regular || [];
      const monitor = res.data.seats_monitor || [];
      setSeats({ regular, monitor });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (seatKey: string) => {
    if (!selectedFloor) return;
    if (!confirm(`确认预约座位 ${seatKey} 吗？`)) return;
    try {
      await libApi.reserveSeat(selectedFloor, seatKey);
      alert('预约成功');
      fetchReserveInfo();
      handleFloorChange(selectedFloor);
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
          if (selectedFloor) handleFloorChange(selectedFloor);
      } catch (err: any) {
          alert('取消失败: ' + (err.response?.data?.detail || err.message));
      }
  }

  const renderSeats = (seatList: Seat[]) => {
      return (
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {seatList.map(seat => {
                  const isFree = seat.status === 1; // Assuming 1 is free
                  return (
                    <div 
                        key={seat.key} 
                        className={`
                            p-2 text-center border rounded text-sm transition-colors
                            ${isFree 
                                ? 'bg-green-100 hover:bg-green-200 border-green-300 cursor-pointer text-green-800' 
                                : 'bg-red-50 border-red-200 text-gray-400 cursor-not-allowed'}
                        `}
                        onClick={() => isFree && handleReserve(seat.key)}
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
      <h1 className="text-2xl font-bold text-gray-800">交互式预约</h1>
      
      {/* Reserve Info Card */}
      {reserveInfo && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
              <div>
                  <h3 className="font-bold text-blue-800">当前已有预约</h3>
                  <div className="text-blue-600 text-sm mt-1">
                      <p>座位号: <span className="font-mono font-bold">{reserveInfo.seatKey}</span></p>
                      <p>Lib ID: {reserveInfo.libId}</p>
                      <p>状态码: {reserveInfo.status}</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">选择图书馆</label>
                <select 
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={selectedLib || ''} 
                    onChange={(e) => handleLibChange(Number(e.target.value))}
                >
                    <option value="">请选择...</option>
                    {libs.map(l => <option key={l.id} value={l.id}>{l.name} {l.status === 1 ? '' : '(闭馆)'}</option>)}
                </select>
            </div>

            {floors.length > 0 && (
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">选择楼层</label>
                    <select 
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={selectedFloor || ''} 
                        onChange={(e) => handleFloorChange(Number(e.target.value))}
                    >
                        <option value="">请选择...</option>
                        {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
            )}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">正在加载座位信息...</div>}

      {seats && (
          <div className="space-y-8 bg-white p-6 rounded-lg shadow-sm border">
              {seats.monitor.length > 0 && (
                  <div>
                      <h4 className="font-bold mb-4 text-purple-700 flex items-center gap-2">
                          <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                          显示器座位 (Y区)
                      </h4>
                      {renderSeats(seats.monitor)}
                  </div>
              )}

              <div>
                  <h4 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
                       <span className="w-2 h-6 bg-gray-500 rounded-full"></span>
                       普通座位
                  </h4>
                  {renderSeats(seats.regular)}
              </div>
          </div>
      )}
    </div>
  );
};

export default InteractiveReserve;
