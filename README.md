# FuckLib 自助图书馆助手

这是一个专门面向《我去图书馆》小程序的**预约与蓝牙打卡签到辅助系统**。

## 解决痛点

- 热门座位难以预约
- 签到必须到馆进行

## 核心能力

- **可视化选座**：查看座位布局并发起预约/取消
- **定时任务**：每天按时间自动预约、自动蓝牙签到
- **状态看板**：当前预约、常用座位、账号预约限制状态
- **推送提醒**：集成 Bark，关键事件及时通知（预约结果、签到结果、配置异常等）
- **多用户与邀请码**：支持多用户；管理员可生成邀请码

## 工作原理

本项目并非《我去图书馆》官方接口。后端通过对接其 Web/小程序侧的 Traceint 服务完成操作：

- **预约/查询**：使用微信授权后得到的 `Authorization` Cookie，请求 `wechat.v2.traceint.com` 的 GraphQL 接口获取场馆/座位信息并提交预约
- **蓝牙打卡签到**：使用 `wechatSESS_ID` + iBeacon 的 **Major/Minor**，向 `wechat.v2.traceint.com/index.php/wxApp/sign.html` 提交设备信息；其中时间戳参数通过 RSA 公钥加密生成

这意味着：

- 上游接口/风控策略变化会直接影响可用性
- 你的 Cookie、SessID 属于敏感凭证，请妥善保管，避免泄露

## 快速开始

### 直接访问已部署的网站

您可以直接访问我已经部署的网站[FuckLib 自助图书馆系统 ](https://lingxilearn.cn/reserve)。

### Docker Compose（推荐）

仓库自带 `docker-compose.yml`。

```bash
docker-compose up -d
```

注意：

- 当前 compose 假设你已有可用数据库，并通过 `DATABASE_URL` 连接（默认示例为 MySQL）。
- `baota_net` 是一个外部网络；如你的环境没有该网络，请自行调整网络配置或改为默认网络。

### 本地开发

#### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

默认使用 SQLite：`sqlite:///./sql_app.db`。如需 MySQL/PostgreSQL，请设置 `DATABASE_URL` 环境变量。

#### 前端

```bash
cd frontend
npm install
npm run dev
```

## 使用说明

### 1) 启动并打开页面

- 后端默认：`http://localhost:8000`
- 前端容器默认：`http://localhost:18080`

### 2) 注册账号（需要邀请码）

- 注册时必须填写邀请码
- 系统启动时会自动预置一个管理员邀请码：`ADMIN123`（**仅可使用一次**）
- 使用 `ADMIN123` 注册的用户会成为管理员，可在设置页管理用户与生成邀请码

### 3) 绑定微信授权（用于预约）

在「设置」页按界面提示扫码获取链接：

- 将复制的**完整链接**粘贴到「Cookie 链接（用于自动选座）」并解析
- 系统会从链接参数中提取 `code`，并在服务端换取 `Authorization` Cookie 保存到你的账户配置中

### 4) 绑定签到授权（用于远程蓝牙签到）

同样在「设置」页：

- 将复制的**完整链接**粘贴到「签到授权链接（远程蓝牙签到）」并解析
- 系统会换取并保存 `wechatSESS_ID`

### 5) 配置蓝牙 Major / Minor

这是「蓝牙打卡设备」的 iBeacon 参数，用于模拟签到时设备上报。

- **UUID** 固定为：`FDA50693-A4E2-4FB1-AFCF-C6EB07647825`
- Android：使用 nRF Connect 靠近打卡设备扫描 iBeacon，记录 Major/Minor
- iOS：使用「Beacon服务」添加上述 UUID 后读取 Major/Minor

将 Major/Minor 填入设置页并保存即可。

### 6) 创建自动任务

在「定时任务」页可创建：

- **预约座位**：支持默认策略或指定某个座位
- **蓝牙签到**：每天按设置时间自动执行签到请求

## 环境与依赖

| 模块 | 运行时              | 关键依赖                                                 |
| ---- | ------------------- | -------------------------------------------------------- |
| 后端 | Python 3.9+         | FastAPI、SQLAlchemy、APScheduler、requests、pycryptodome |
| 前端 | Node.js（建议 18+） | React、TypeScript、Vite、Tailwind CSS                    |

## 部署与安全提示

- 请在生产环境**修改后端 JWT 密钥**（当前为占位值）：`backend/app/routers/auth.py`
- 不要在日志/截图/Issue 中公开你的 Cookie、SessID、Bark Key、数据库连接串
- 若出现 Cookie 失效或预约限制，请先在小程序内确认账号状态，再重新绑定授权

## 贡献

- 欢迎提交 Issue：描述复现步骤、截图/日志
- 欢迎 PR：保持改动聚焦、附带必要的说明与测试

## Buy Me a Coffee

如果本项目对您有所帮助，您可以请我喝一杯咖啡☕~~~

![Buy Me a Coffee](assets/donate.png)

## 免责声明

1. 本项目仅供学习与技术研究交流使用。
2. 请遵守相关法律法规及图书馆规章制度，合理使用公共资源。
3. 严禁用于任何商业用途或恶意抢座等破坏公平性的行为。
4. 使用本项目产生的任何后果由使用者自行承担，开发者不承担任何责任。
