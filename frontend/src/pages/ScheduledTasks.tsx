import React, { useEffect, useState } from 'react';
import { taskApi, type Task } from '../api/client';

const ScheduledTasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showModal, setShowModal] = useState(false);
    
    // Form State
    const [type, setType] = useState('seat_today'); // seat_today, seat_tomorrow, signin
    const [time, setTime] = useState('08:00');
    const [strategy, setStrategy] = useState('default_all'); // default_all, custom
    const [libId, setLibId] = useState('');
    const [seatKey, setSeatKey] = useState('');
    
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await taskApi.getTasks();
            setTasks(res.data);
        } catch (err) {
            console.error(err);
        }
    }

    const handleDelete = async (id: number) => {
        if(!confirm('确定删除?')) return;
        try {
            await taskApi.deleteTask(id);
            fetchTasks();
        } catch(err) {
            alert('删除失败');
        }
    }

    const formatCron = (cron: string) => {
        try {
            const parts = cron.split(' ');
            if (parts.length >= 2) {
                const minute = parts[0].padStart(2, '0');
                const hour = parts[1].padStart(2, '0');
                return `${hour}:${minute}`;
            }
            return cron;
        } catch (e) {
            return cron;
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Convert time to cron: "0 8 * * *"
        const [hour, minute] = time.split(':');
        // Note: Server timezone is Asia/Shanghai.
        const cron = `${Number(minute)} ${Number(hour)} * * *`;
        
        const payload: any = {
            task_type: type,
            cron_expression: cron,
            is_enabled: true,
            config: {}
        };
        
        if (type.startsWith('seat')) {
            payload.config.strategy = strategy;
            if (strategy === 'custom') {
                payload.config.lib_id = Number(libId);
                payload.config.seat_key = seatKey;
            }
        }
        
        try {
            await taskApi.createTask(payload);
            setShowModal(false);
            fetchTasks();
        } catch(err) {
            alert('创建失败');
        }
    }

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">定时任务管理</h1>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow"
                >
                    + 新建任务
                </button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map(task => (
                    <div key={task.id} className="bg-white p-4 rounded-lg shadow border relative">
                        <button 
                            onClick={() => handleDelete(task.id)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        >
                            ×
                        </button>
                        <h3 className="font-bold text-lg mb-2">
                            {task.task_type === 'signin' && '✨ 自动签到'}
                            {task.task_type === 'seat_today' && '🪑 今日预约'}
                            {task.task_type === 'seat_tomorrow' && '🌙 明日抢座'}
                        </h3>
                        <p className="text-gray-600 mb-2">
                            时间: <span className="font-mono font-bold bg-gray-100 px-1 rounded">{formatCron(task.cron_expression)}</span>
                        </p>
                        
                        {task.task_type.startsWith('seat') && (
                            <div className="text-sm text-gray-500 mb-2">
                                策略: {task.config.strategy === 'default_all' ? '尝试所有预选座位' : `指定座位 (${task.config.lib_id}, ${task.config.seat_key})`}
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t text-sm">
                            <p className="flex justify-between">
                                <span>上次运行:</span>
                                <span>{task.last_run ? new Date(task.last_run).toLocaleString() : '从未'}</span>
                            </p>
                            <p className="flex justify-between mt-1">
                                <span>状态:</span>
                                <span className={task.last_status === 'success' ? 'text-green-600' : 'text-red-600'}>
                                    {task.last_status || '-'}
                                </span>
                            </p>
                            {task.last_message && (
                                <p className="mt-1 text-xs text-gray-400 truncate" title={task.last_message}>
                                    {task.last_message}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4">新建定时任务</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">任务类型</label>
                                <select 
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                >
                                    <option value="seat_today">今日预约 (Reserve)</option>
                                    <option value="seat_tomorrow">明日抢座 (Pre-reserve)</option>
                                    <option value="signin">蓝牙签到</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">执行时间 (每天)</label>
                                <input 
                                    type="time" 
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    required
                                />
                            </div>
                            
                            {type.startsWith('seat') && (
                                <div className="space-y-4 border-t pt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">选座策略</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    checked={strategy === 'default_all'} 
                                                    onChange={() => setStrategy('default_all')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>尝试所有预选座位 (推荐)</span>
                                            </label>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    checked={strategy === 'custom'} 
                                                    onChange={() => setStrategy('custom')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>指定特定座位</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {strategy === 'custom' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                placeholder="Lib ID" 
                                                className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={libId}
                                                onChange={e => setLibId(e.target.value)}
                                                required
                                            />
                                            <input 
                                                placeholder="Seat Key" 
                                                className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={seatKey}
                                                onChange={e => setSeatKey(e.target.value)}
                                                required
                                            />
                                            <p className="text-xs text-gray-500 col-span-2">
                                                提示：请在“交互式预约”页面查看 Lib ID 和 Seat Key
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200 transition-colors"
                                >
                                    取消
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
                                >
                                    创建
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduledTasks;
