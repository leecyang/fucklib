import React, { useEffect, useState } from 'react';
import { taskApi, type Task } from '../api/client';
import SeatPicker from '../components/SeatPicker';
import { cn } from '../lib/utils';
import { Plus, Trash2, Clock, CheckCircle2, AlertCircle, Calendar, Bluetooth } from 'lucide-react';

const ScheduledTasks: React.FC = () => {
    // ==================================================================================
    // BUSINESS LOGIC START
    // ==================================================================================
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [showSeatPicker, setShowSeatPicker] = useState(false);
    
    // Form State
    const [type, setType] = useState('reserve'); // reserve, signin
    const [time, setTime] = useState('08:00');
    const [strategy, setStrategy] = useState('default_all'); // default_all, custom
    const [libId, setLibId] = useState('');
    const [seatKey, setSeatKey] = useState('');
    const [pickedSeat, setPickedSeat] = useState<{ libId: number, libName: string, seatKey: string, seatName: string } | null>(null);
    
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
        
        if (type === 'reserve') {
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
    // ==================================================================================
    // BUSINESS LOGIC END
    // ==================================================================================

    const ToggleSwitch = ({ enabled }: { enabled: boolean }) => (
        <div className={cn("w-11 h-6 bg-slate-200 rounded-full relative transition-colors duration-200 ease-in-out", enabled && "bg-indigo-600")}>
            <span className={cn("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 shadow-sm", enabled && "translate-x-5")} />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Scheduled Tasks</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage automated reservations and sign-ins.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">New Task</span>
                </button>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Time (Cron)</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Last Run</th>
                            <th className="px-6 py-4">Result</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tasks.map(task => (
                            <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", task.task_type === 'signin' ? 'bg-indigo-500' : 'bg-violet-500')}></div>
                                        <span className="font-medium text-slate-700">
                                            {task.task_type === 'signin' ? 'Auto Sign-in' : 'Reservation'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                                        {formatCron(task.cron_expression)}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <ToggleSwitch enabled={task.is_enabled} />
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {task.last_run ? new Date(task.last_run).toLocaleString() : '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", 
                                        task.last_status === 'success' ? "bg-emerald-50 text-emerald-700" : 
                                        task.last_status ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {task.last_status === 'success' ? <CheckCircle2 className="w-3 h-3"/> : task.last_status ? <AlertCircle className="w-3 h-3"/> : null}
                                        {task.last_status || 'Pending'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleDelete(task.id)}
                                        className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tasks.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    No tasks found. Create one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden grid gap-4">
                {tasks.map(task => (
                    <div key={task.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", task.task_type === 'signin' ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600')}>
                                    {task.task_type === 'signin' ? <Bluetooth className="w-5 h-5"/> : <Calendar className="w-5 h-5"/>}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        {task.task_type === 'signin' ? 'Auto Sign-in' : 'Reservation'}
                                    </h3>
                                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-mono">{formatCron(task.cron_expression)}</span>
                                    </div>
                                </div>
                            </div>
                            <ToggleSwitch enabled={task.is_enabled} />
                        </div>
                        
                        <div className="space-y-2 text-sm border-t border-slate-100 pt-3 mt-3">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Last Run</span>
                                <span className="text-slate-900">{task.last_run ? new Date(task.last_run).toLocaleTimeString() : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Result</span>
                                <span className={cn("font-medium", task.last_status === 'success' ? "text-emerald-600" : "text-rose-600")}>
                                    {task.last_status || 'Pending'}
                                </span>
                            </div>
                            {task.last_message && (
                                <div className="text-xs text-slate-400 mt-1 truncate bg-slate-50 p-2 rounded">
                                    {task.last_message}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => handleDelete(task.id)}
                            className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 p-1"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold mb-6 text-slate-900">New Task</h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Task Type</label>
                                <select 
                                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                >
                                    <option value="reserve">Seat Reservation</option>
                                    <option value="signin">Bluetooth Sign-in</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Execution Time (Daily)</label>
                                <input 
                                    type="time" 
                                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    required
                                />
                            </div>
                            
                            {type === 'reserve' && (
                                <div className="space-y-5 border-t border-slate-100 pt-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Strategy</label>
                                        <div className="space-y-3">
                                            <label className="flex items-center space-x-3 cursor-pointer group">
                                                <input 
                                                    type="radio" 
                                                    checked={strategy === 'default_all'} 
                                                    onChange={() => setStrategy('default_all')}
                                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                                />
                                                <span className="text-slate-700 group-hover:text-indigo-600 transition-colors">Try all frequent seats (Recommended)</span>
                                            </label>
                                            <label className="flex items-center space-x-3 cursor-pointer group">
                                                <input 
                                                    type="radio" 
                                                    checked={strategy === 'custom'} 
                                                    onChange={() => setStrategy('custom')}
                                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                                />
                                                <span className="text-slate-700 group-hover:text-indigo-600 transition-colors">Pick specific seat</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {strategy === 'custom' && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setShowSeatPicker(true)}
                                                className="w-full bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all text-sm font-medium"
                                            >
                                                Select Seat
                                            </button>
                                            {pickedSeat && (
                                                <div className="mt-2 text-xs text-indigo-600 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Selected: {pickedSeat.libName} - {pickedSeat.seatName}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showSeatPicker && (
                <SeatPicker
                    onClose={() => setShowSeatPicker(false)}
                    onPick={(data) => {
                        setPickedSeat(data);
                        setLibId(String(data.libId));
                        setSeatKey(data.seatKey);
                        setShowSeatPicker(false);
                    }}
                />
            )}
        </div>
    );
};

export default ScheduledTasks;
