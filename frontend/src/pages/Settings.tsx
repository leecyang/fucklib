import { useState, useEffect } from 'react';
import api, { libApi, adminApi } from '../api/client';

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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">设置中心</h1>
      
      {msg && <div className="bg-blue-100 text-blue-700 p-3 rounded">{msg}</div>}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">账号限制</h2>
        {config?.cookie ? (
          userInfo?.user_deny?.deny_deadline ? (
            <div className="text-gray-700">
              <span className="font-semibold">禁止预约截止：</span>
              <span className="font-mono">{userInfo.user_deny.deny_deadline}</span>
            </div>
          ) : (
            <div className="text-green-700">当前无预约限制</div>
          )
        ) : (
          <div className="text-gray-500">请先更新微信 Cookie 后查看账号限制信息</div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <h2 className="text-xl font-semibold mb-4">微信授权与扫码链接</h2>

        <div className="flex flex-col items-center gap-2">
          <img
            src="/qr.png"
            alt="请使用微信扫码获取链接"
            className="w-40 h-40 rounded-lg shadow-sm"
          />
          <p className="text-sm text-gray-500">
            请使用微信「扫一扫」或长按识别二维码，按下面步骤获取链接并粘贴。
          </p>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">更新 Cookie（用于自动选座）</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-2 border rounded-lg"
              placeholder="在此粘贴从微信复制的链接..."
              value={authUrl}
              onChange={(e) => setAuthUrl(e.target.value)}
            />
            <button
              onClick={() => updateCookie(authUrl, true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              解析链接并更新
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            第一次使用或 Cookie 失效时，请在「我去图书馆」公众号中长按二维码→识别二维码→进入网页，
            从浏览器复制完整链接粘贴到此处并点击「解析链接并更新」。
          </p>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">更新签到授权链接（远程打卡）</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-2 border rounded-lg"
              placeholder="在此粘贴从微信复制的链接..."
              value={sessUrl}
              onChange={(e) => setSessUrl(e.target.value)}
            />
            <button
              onClick={() => updateCookie(sessUrl, false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              解析链接并更新
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            远程蓝牙打卡同样需要从微信扫码进入签到页面，复制地址栏中的完整链接粘贴到此处。
            若之后提示状态失效，只需重新扫码获取新链接并再次粘贴更新即可。
          </p>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-gray-700 space-y-2">
          <p className="font-semibold text-blue-700">如何正确获取并粘贴链接（新手必读）</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>关注并进入「我去图书馆」公众号，在公众号中先设置好常用座位。</li>
            <li>在公众号中点击「设置座位及时间」或相关菜单，进入二维码页面。</li>
            <li>在微信中长按二维码，选择「识别二维码」，进入打开的网页。</li>
            <li>进入网页后，在右上角菜单选择在浏览器打开或直接复制链接。</li>
            <li>将复制到的完整链接粘贴到上面的输入框中，点击「解析链接并更新」。</li>
            <li>如果以后再次弹出二维码页面，说明状态失效，请按以上步骤重新扫码并更新链接。</li>
          </ol>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
        <h2 className="text-xl font-semibold">管理员设置中心</h2>
        {invites.length === 0 && users.length === 0 ? (
          <p className="text-gray-500 text-sm">非管理员或暂无权限</p>
        ) : (
          <>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">邀请码管理</h3>
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
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  生成邀请码
                </button>
              </div>
              <ul className="text-sm space-y-1">
                {invites.map((i) => (
                  <li key={i.id} className="flex justify-between border-b pb-1 last:border-b-0">
                    <span className="font-mono">{i.code}</span>
                    <span className={i.is_used ? 'text-gray-500' : 'text-green-600'}>
                      {i.is_used ? '已使用' : '未使用'}
                    </span>
                  </li>
                ))}
                {invites.length === 0 && <li className="text-gray-500">暂无邀请码</li>}
              </ul>
            </div>
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">用户管理</h3>
              <ul className="text-sm space-y-1">
                {users.map((u) => (
                  <li key={u.id} className="flex justify-between border-b pb-1 last:border-b-0">
                    <span>{u.username}</span>
                    <span className="text-gray-500">{u.is_admin ? '管理员' : '普通用户'}</span>
                  </li>
                ))}
                {users.length === 0 && <li className="text-gray-500">暂无用户或无权限查看</li>}
              </ul>
            </div>
          </>
        )}
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <h2 className="text-xl font-semibold">蓝牙打卡配置（Major / Minor）</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Major</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg"
              value={config.major || ''}
              onChange={(e) => setConfig({ ...config, major: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Minor</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg"
              value={config.minor || ''}
              onChange={(e) => setConfig({ ...config, minor: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={updateBluetooth}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
        >
          保存蓝牙配置
        </button>

        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-3">
          <p className="font-semibold">如何获取 Major / Minor 数值</p>
          <p>在更新完上面的签到授权链接后，请按以下步骤获取蓝牙打卡所需的 Major 与 Minor：</p>
          <div className="space-y-1">
            <p className="font-semibold">安卓手机：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>使用浏览器打开下载链接：<span className="text-blue-600 break-all">https://wwn.lanzouj.com/iV9mw03eqzsh</span>，安装 nRF Connect。</li>
              <li>打开 nRF Connect，授予蓝牙和定位权限，开启手机定位与蓝牙。</li>
              <li>靠近图书馆的蓝牙打卡机器，在列表中找到类型为 iBeacon、UUID 与学校说明一致的设备。</li>
              <li>进入设备详情页面，记录其中显示的 Major 和 Minor 数值，填入上方输入框后点击「保存蓝牙配置」。</li>
            </ol>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">苹果手机：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>在 App Store 搜索并安装「Beacon服务」应用，授予蓝牙和定位权限。</li>
              <li>打开应用，点击右上角设置→「BEACON约束」→「其他」，名称可随意，UUID 填写：<span className="text-blue-600 break-all">FDA50693-A4E2-4FB1-AFCF-C6EB07647825</span>。</li>
              <li>保存后点击刚新增的项目，将其添加到「Beacon测距」，返回查看设备列表。</li>
              <li>靠近图书馆的蓝牙打卡机器，在列表中找到对应设备，记录其 Major 和 Minor 数值，填入上方输入框后点击「保存蓝牙配置」。</li>
            </ol>
          </div>
          <p>Major / Minor 信息一般只需配置一次，如打卡失败且学校更换了设备，请按照上述步骤重新获取并更新。</p>
        </div>
      </div>
    </div>
  );
}
