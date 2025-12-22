import { useState, useEffect } from 'react';
import api, { libApi, adminApi } from '../api/client';
import { cn } from '../lib/utils';
import { Shield, Smartphone, Link as LinkIcon, AlertTriangle, User, Ticket, Save, RefreshCw, QrCode } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState<any>({ major: '', minor: '' });
  const [authUrl, setAuthUrl] = useState('');
  const [sessUrl, setSessUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/library/config');
      setConfig(res.data);
      if (res.data?.cookie) {
        try {
          const userRes = await libApi.getUserInfo();
          setUserInfo(userRes.data.currentUser);
        } catch (e) {
          console.error('获取用户信息失败', e);
          setUserInfo(null);
        }
      } else {
        setUserInfo(null);
      }
      try {
        const inv = await adminApi.getInvites();
        setInvites(inv.data || []);
        const usr = await adminApi.getUsers();
        setUsers(usr.data || []);
      } catch (e) {
        setInvites([]);
        setUsers([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateCookie = async (url: string, isAuth: boolean) => {
    try {
      await api.post('/library/get_cookie_from_url', null, {
        params: { url, is_auth_url: isAuth }
      });
      setMsg('链接解析成功，配置已更新');
      loadConfig();
    } catch (err: any) {
      setMsg('错误：' + (err.response?.data?.detail || '解析链接失败，请稍后重试'));
    }
  };

  const updateBluetooth = async () => {
    try {
      await api.post('/library/config', {
        major: config.major,
        minor: config.minor
      });
      setMsg('蓝牙配置已保存');
    } catch (err: any) {
      setMsg('错误：' + (err.response?.data?.detail || '保存蓝牙配置失败，请稍后重试'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your account and library preferences.</p>
      </header>
      
      {msg && (
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{msg}</div>
        </div>
      )}

      {/* Account Limits */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Account Status
        </h2>
        {config?.cookie ? (
          userInfo?.user_deny?.deny_deadline ? (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg text-rose-700">
              <span className="font-semibold block mb-1">Reservation Ban Active</span>
              <span className="text-sm">Lifted on: <span className="font-mono font-bold">{userInfo.user_deny.deny_deadline}</span></span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg text-emerald-700 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>No account restrictions detected.</span>
            </div>
          )
        ) : (
            <div className="text-slate-500 italic">Please configure WeChat Cookie to view account status.</div>
        )}
      </div>

      {/* WeChat Auth */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            WeChat Authorization
        </h2>

        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                <img src="/qr.png" alt="QR Code" className="w-32 h-32 rounded" />
              </div>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1"><QrCode className="w-3 h-3"/> Scan via WeChat</span>
          </div>
          <div className="text-sm text-slate-600 space-y-2 flex-1">
            <p className="font-medium text-slate-900">How to get the link:</p>
            <ol className="list-decimal list-inside space-y-1 ml-1 text-slate-500">
                <li>Scan QR code with WeChat.</li>
                <li>Wait for the page to load.</li>
                <li>Copy the full URL from the top bar.</li>
                <li>Paste it below.</li>
            </ol>
          </div>
        </div>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cookie URL (Auto-Seat)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Paste URL here..."
                        value={authUrl}
                        onChange={(e) => setAuthUrl(e.target.value)}
                    />
                    <button
                        onClick={() => updateCookie(authUrl, true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        Update
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Session URL (Remote Sign-in)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Paste URL here..."
                        value={sessUrl}
                        onChange={(e) => setSessUrl(e.target.value)}
                    />
                    <button
                        onClick={() => updateCookie(sessUrl, false)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        Update
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Bluetooth Config */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            Bluetooth Configuration
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Major</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              value={config.major || ''}
              onChange={(e) => setConfig({ ...config, major: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Minor</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              value={config.minor || ''}
              onChange={(e) => setConfig({ ...config, minor: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={updateBluetooth}
          className="w-full bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </div>
      
      {/* Admin Zone */}
      {(invites.length > 0 || users.length > 0) && (
          <div className="border border-rose-200 bg-rose-50/30 p-6 rounded-xl space-y-6">
            <h2 className="text-lg font-bold text-rose-700 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Admin Zone
            </h2>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-rose-900 flex items-center gap-2"><Ticket className="w-4 h-4"/> Invite Codes</h3>
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.generateInvite();
                          const inv = await adminApi.getInvites();
                          setInvites(inv.data || []);
                        } catch (e) {
                          alert('Failed to generate invite');
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs rounded-lg hover:bg-rose-700 font-medium transition-colors shadow-sm flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3"/> Generate New
                    </button>
                </div>
                <div className="bg-white rounded-lg border border-rose-100 overflow-hidden">
                    {invites.map((i) => (
                      <div key={i.id} className="flex justify-between px-4 py-3 border-b border-rose-50 last:border-b-0 text-sm">
                        <span className="font-mono text-slate-700">{i.code}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded", i.is_used ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")}>
                          {i.is_used ? 'USED' : 'ACTIVE'}
                        </span>
                      </div>
                    ))}
                    {invites.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">No invite codes generated</div>}
                </div>
            </div>

            <div className="pt-4 border-t border-rose-200/50">
                 <h3 className="font-semibold text-rose-900 mb-3 flex items-center gap-2"><User className="w-4 h-4"/> User Management</h3>
                 <div className="bg-white rounded-lg border border-rose-100 overflow-hidden">
                    {users.map((u) => (
                      <div key={u.id} className="flex justify-between px-4 py-3 border-b border-rose-50 last:border-b-0 text-sm">
                        <span className="font-medium text-slate-700">{u.username}</span>
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{u.is_admin ? 'Admin' : 'User'}</span>
                      </div>
                    ))}
                 </div>
            </div>
          </div>
      )}
    </div>
  );
}
