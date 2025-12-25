import { useState, useEffect } from 'react';
import api, { libApi, adminApi, barkApi, type BarkConfig } from '../api/client';
import { cn } from '../lib/utils';
import { Shield, Smartphone, Link as LinkIcon, User, Ticket, Save, RefreshCw, QrCode, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { alert } from '../components/Dialog';

export default function Settings() {
  const [config, setConfig] = useState<any>({ major: '', minor: '' });
  const [authUrl, setAuthUrl] = useState('');
  const [sessUrl, setSessUrl] = useState('');
  const [dialog, setDialog] = useState<{ title: string; body: string; variant: 'success' | 'error' | 'info' } | null>(null);
  const [wechatUserInfo, setWechatUserInfo] = useState<any>(null);
  const [userInfoError, setUserInfoError] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const navigate = useNavigate();

  // Bark配置state
  const [barkConfig, setBarkConfig] = useState<Partial<BarkConfig>>({
    bark_key: '',
    server_url: 'https://api.day.app',
    is_enabled: true,
    subscriptions: ['reserve', 'signin', 'task', 'config']
  });
  const [barkConfigExists, setBarkConfigExists] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // 1. Get Library/Wechat Config
      const res = await api.get('/library/config');
      setConfig(res.data);

      // 2. Get Wechat User Info if cookie exists
      if (res.data?.cookie) {
        setLoadingUser(true);
        setUserInfoError(false);
        try {
          const userRes = await libApi.getUserInfo();
          setWechatUserInfo(userRes.data.currentUser);
        } catch (e) {
          console.error('获取用户信息失败', e);
          setWechatUserInfo(null);
          setUserInfoError(true);
        } finally {
          setLoadingUser(false);
        }
      } else {
        setWechatUserInfo(null);
      }

      // 3. Get Current User Info (Check Admin)
      try {
        // Use authApi.getMe() to check current user role
        // Need to import authApi first or use api.get('/auth/me')
        const meRes = await api.get('/auth/me');
        const me = meRes.data;

        if (me.is_admin) {
          const inv = await adminApi.getInvites();
          setInvites(inv.data || []);
          const usr = await adminApi.getUsers();
          setUsers(usr.data || []);
        } else {
          setInvites([]);
          setUsers([]);
        }
      } catch (e) {
        console.error('获取当前用户失败', e);
        setInvites([]);
        setUsers([]);
      }

      // 4. Load Bark Config
      try {
        const barkRes = await barkApi.getConfig();
        setBarkConfig(barkRes.data);
        setBarkConfigExists(true);
      } catch (e: any) {
        // 404表示未配置，其他错误也静默处理
        if (e.response?.status === 404) {
          setBarkConfigExists(false);
        }
        console.log('Bark配置未找到或加载失败', e);
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
      const detail = err.response?.data?.detail || '';
      if (detail.includes('无法解析学号')) {
        setDialog({
          title: '无法解析学号',
          body: '请前往公众号检查是否已登录“我去图书馆”小程序，登录后重新获取链接。',
          variant: 'error'
        });
      } else {
        setDialog({ title: '解析失败', body: detail || '解析链接失败，请稍后重试', variant: 'error' });
      }
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

  const saveBarkConfig = async () => {
    try {
      if (!barkConfig.bark_key || barkConfig.bark_key.trim() === '') {
        setDialog({ title: '保存失败', body: '请先填写Bark Key', variant: 'error' });
        return;
      }

      await barkApi.updateConfig({
        bark_key: barkConfig.bark_key,
        server_url: barkConfig.server_url || 'https://api.day.app',
        is_enabled: barkConfig.is_enabled !== false,
        subscriptions: barkConfig.subscriptions || ['reserve', 'signin', 'task', 'config']
      });

      setDialog({ title: '保存成功', body: 'Bark推送配置已保存', variant: 'success' });
      setBarkConfigExists(true);
      loadConfig();
    } catch (err: any) {
      setDialog({
        title: '保存失败',
        body: err.response?.data?.detail || '保存Bark配置失败，请稍后重试',
        variant: 'error'
      });
    }
  };

  const testBarkPush = async () => {
    if (!barkConfigExists && (!barkConfig.bark_key || barkConfig.bark_key.trim() === '')) {
      setDialog({ title: '无法测试', body: '请先保存Bark配置', variant: 'error' });
      return;
    }

    setTestingPush(true);
    try {
      const result = await barkApi.testPush();
      setDialog({
        title: '测试推送已发送',
        body: result.data.message || '请查看Bark应用确认是否收到通知',
        variant: 'success'
      });
    } catch (err: any) {
      setDialog({
        title: '测试失败',
        body: err.response?.data?.detail || '推送发送失败，请检查Device Token和网络连接',
        variant: 'error'
      });
    } finally {
      setTestingPush(false);
    }
  };

  const toggleSubscription = (type: string) => {
    const subs = barkConfig.subscriptions || [];
    if (subs.includes(type)) {
      setBarkConfig({ ...barkConfig, subscriptions: subs.filter(s => s !== type) });
    } else {
      setBarkConfig({ ...barkConfig, subscriptions: [...subs, type] });
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
          loadingUser ? (
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg text-slate-500 flex items-center gap-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>正在获取账号状态...</span>
            </div>
          ) : userInfoError ? (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>无法获取账号状态，Cookie 可能已失效或被封禁，请重新配置。</span>
            </div>
          ) : (wechatUserInfo?.currentUser?.user_deny) ? (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg text-rose-700 animate-pulse">
              <span className="font-semibold block mb-1">⚠️ 当前账号存在预约限制</span>
              <span className="text-sm">解除时间：<span className="font-mono font-bold text-lg">{wechatUserInfo.currentUser.user_deny.deny_deadline || '无法获取/未知'}</span></span>
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
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1"><QrCode className="w-3 h-3" /> 使用微信扫码</span>
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

      {/* Bark消息推送配置 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          Bark消息推送（iOS）
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Bark Key（推送密钥）
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
              placeholder="从推送URL中复制Key部分..."
              value={barkConfig.bark_key || ''}
              onChange={(e) => setBarkConfig({ ...barkConfig, bark_key: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              打开Bark应用，复制推送URL，提取其中的Key部分（如：dCbMxKjM9iV7mKAGuGUsuf）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              服务器地址（可选）
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
              placeholder="https://api.day.app"
              value={barkConfig.server_url || ''}
              onChange={(e) => setBarkConfig({ ...barkConfig, server_url: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-sm font-medium text-slate-700">启用Bark推送</span>
            <button
              onClick={() => setBarkConfig({ ...barkConfig, is_enabled: !barkConfig.is_enabled })}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                barkConfig.is_enabled ? "bg-indigo-600" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  barkConfig.is_enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              订阅通知类型
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'reserve', label: '座位预约通知', icon: '🪑' },
                { key: 'signin', label: '签到相关通知', icon: '📚' },
                { key: 'task', label: '任务状态通知', icon: '⏰' },
                { key: 'config', label: '配置异常通知', icon: '⚠️' }
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => toggleSubscription(key)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    (barkConfig.subscriptions || []).includes(key)
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <span className="mr-1">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 重要：Cookie失效和监督举报通知为关键通知，将强制发送
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={testBarkPush}
              disabled={testingPush}
              className="flex-1 bg-slate-600 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testingPush ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  测试推送
                </>
              )}
            </button>
            <button
              onClick={saveBarkConfig}
              className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存配置
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>📌 配置步骤：</strong><br />
              1. 从App Store下载Bark应用<br />
              2. 打开应用，复制推送URL（如：https://api.day.app/xxx/推送内容）<br />
              3. 提取URL中的Key部分（xxx）并粘贴到上方<br />
              4. 选择想要订阅的通知类型<br />
              5. 点击"测试推送"验证配置<br />
              6. 点击"保存配置"完成设置
            </p>
          </div>
        </div>
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
              <h3 className="font-semibold text-rose-900 flex items-center gap-2"><Ticket className="w-4 h-4" /> 邀请码管理</h3>
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
                <RefreshCw className="w-3 h-3" /> 生成新的邀请码
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
            <h3 className="font-semibold text-rose-900 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> 用户管理</h3>
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
