import { useState, useEffect } from 'react';
import api, { libApi, adminApi } from '../api/client';
import { cn } from '../lib/utils';
import { Shield, Smartphone, Link as LinkIcon, User, Ticket, Save, RefreshCw, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const [config, setConfig] = useState<any>({ major: '', minor: '' });
  const [authUrl, setAuthUrl] = useState('');
  const [sessUrl, setSessUrl] = useState('');
  const [dialog, setDialog] = useState<{ title: string; body: string; variant: 'success' | 'error' | 'info' } | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const navigate = useNavigate();

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
      setDialog({ title: '解析成功', body: '链接解析成功，配置已更新', variant: 'success' });
      loadConfig();
    } catch (err: any) {
      setDialog({ title: '解析失败', body: err.response?.data?.detail || '解析链接失败，请稍后重试', variant: 'error' });
    }
  };

  const updateBluetooth = async () => {
    try {
      await api.post('/library/config', {
        major: config.major,
        minor: config.minor
      });
      setDialog({ title: '保存成功', body: '蓝牙配置已保存', variant: 'success' });
    } catch (err: any) {
      setDialog({ title: '保存失败', body: err.response?.data?.detail || '保存蓝牙配置失败，请稍后重试', variant: 'error' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
          <h1 className="text-3xl font-bold text-slate-900">设置中心</h1>
          <p className="text-slate-500 mt-1">配置账户与图书馆相关偏好。</p>
      </header>
      
      {/* Dialog Modal */}
      {dialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              {dialog.variant === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {dialog.variant === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
              <h3 className="text-lg font-bold text-slate-900">{dialog.title}</h3>
            </div>
            <p className="text-sm text-slate-600">{dialog.body}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 账号限制 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            账号状态
        </h2>
        {config?.cookie ? (
          userInfo?.user_deny?.deny_deadline ? (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg text-rose-700">
              <span className="font-semibold block mb-1">当前账号存在预约限制</span>
              <span className="text-sm">解除时间：<span className="font-mono font-bold">{userInfo.user_deny.deny_deadline}</span></span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg text-emerald-700 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>当前无预约限制</span>
            </div>
          )
        ) : (
            <div className="text-slate-500 italic">请先配置微信 Cookie 后查看账号状态。</div>
        )}
      </div>

      {/* 微信授权与扫码链接 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            微信授权
        </h2>

        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                <img src="/qr.png" alt="QR Code" className="w-32 h-32 rounded" />
              </div>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1"><QrCode className="w-3 h-3"/> 使用微信扫码</span>
          </div>
          <div className="text-sm text-slate-600 space-y-2 flex-1">
            <p className="font-medium text-slate-900">如何获取链接：</p>
            <ol className="list-decimal list-inside space-y-1 ml-1 text-slate-500">
                <li>使用微信扫描二维码。</li>
                <li>等待页面加载完成。</li>
                <li>从地址栏复制完整链接。</li>
                <li>粘贴到下方输入框。</li>
            </ol>
          </div>
        </div>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cookie 链接（用于自动选座）</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="在此粘贴从微信复制的链接..."
                        value={authUrl}
                        onChange={(e) => setAuthUrl(e.target.value)}
                    />
                    <button
                        onClick={() => updateCookie(authUrl, true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        解析并更新
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  提示：请执行两次获取链接操作。第一次粘贴到上面的「Cookie 链接（自动选座）」，
                  第二次粘贴到下方的「签到授权链接（远程蓝牙签到）」。
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">签到授权链接（远程蓝牙签到）</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="在此粘贴从微信复制的链接..."
                        value={sessUrl}
                        onChange={(e) => setSessUrl(e.target.value)}
                    />
                    <button
                        onClick={() => updateCookie(sessUrl, false)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        解析并更新
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* 蓝牙打卡配置 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            蓝牙打卡配置
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
          <Save className="w-4 h-4" /> 保存配置
        </button>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          提示：<br />
          安卓可安装 nRF Connect（下载链接：<span className="break-all">https://wwn.lanzouj.com/iV9mw03eqzsh</span>），靠近图书馆打卡设备，在列表找到 iBeacon 项查看其 UUID、Major、Minor。<br />
          苹果可在 App Store 安装「Beacon服务」应用，设置 UUID 为
          <span className="break-all"> FDA50693-A4E2-4FB1-AFCF-C6EB07647825 </span>
          后在设备列表查看对应的 Major / Minor 数值并填入上方。
        </p>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">账户操作</h2>
        <button
          onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
          className="w-full px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-bold"
        >
          退出登录
        </button>
      </div>
      
      {/* 管理员区域 */}
      {(invites.length > 0 || users.length > 0) && (
          <div className="border border-rose-200 bg-rose-50/30 p-6 rounded-xl space-y-6">
            <h2 className="text-lg font-bold text-rose-700 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                管理员设置中心
            </h2>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-rose-900 flex items-center gap-2"><Ticket className="w-4 h-4"/> 邀请码管理</h3>
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.generateInvite();
                          const inv = await adminApi.getInvites();
                          setInvites(inv.data || []);
                        } catch (e) {
                          alert('生成邀请码失败');
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs rounded-lg hover:bg-rose-700 font-medium transition-colors shadow-sm flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3"/> 生成新的邀请码
                    </button>
                </div>
                <div className="bg-white rounded-lg border border-rose-100 overflow-hidden">
                    {invites.map((i) => (
                      <div key={i.id} className="flex justify-between px-4 py-3 border-b border-rose-50 last:border-b-0 text-sm">
                        <span className="font-mono text-slate-700">{i.code}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded", i.is_used ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")}>
                          {i.is_used ? '已使用' : '未使用'}
                        </span>
                      </div>
                    ))}
                    {invites.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">暂无邀请码</div>}
                </div>
            </div>

            <div className="pt-4 border-t border-rose-200/50">
                 <h3 className="font-semibold text-rose-900 mb-3 flex items-center gap-2"><User className="w-4 h-4"/> 用户管理</h3>
                 <div className="bg-white rounded-lg border border-rose-100 overflow-hidden">
                    {users.map((u) => (
                      <div key={u.id} className="flex justify-between px-4 py-3 border-b border-rose-50 last:border-b-0 text-sm">
                        <span className="font-medium text-slate-700">{u.username}</span>
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{u.is_admin ? '管理员' : '普通用户'}</span>
                      </div>
                    ))}
                 </div>
            </div>
          </div>
      )}
    </div>
  );
}
