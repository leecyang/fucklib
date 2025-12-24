# Vercel 部署前检查清单

在部署到Vercel之前，请确保完成以下检查：

## ✅ 代码修改检查

- [x] 创建了 `/api/index.py` 文件
- [x] 更新了 `vercel.json` 配置
- [x] 创建了 `api/requirements.txt`
- [x] 创建了 `.vercelignore` 文件
- [x] 提交了所有更改到Git

## ✅ Vercel项目设置检查

### 环境变量（重要！）

登录 [Vercel Dashboard](https://vercel.com/dashboard) → 选择你的项目 → Settings → Environment Variables

确保配置了以下环境变量：

1. **DATABASE_URL** (必需)
   - 值：你的PostgreSQL/Supabase数据库连接字符串
   - 示例：`postgresql://user:pass@host:5432/dbname`
   - ⚠️ 如果使用Supabase，确保使用的是 **Transaction** 或 **Session** pooler URL
   - ⚠️ 检查URL中是否有IPv6相关参数，如有请移除

2. **VERCEL** (自动设置)
   - Vercel会自动将此设置为 "1"
   - 无需手动配置

3. **其他自定义变量**（如果你的应用需要）
   - SUPABASE_URL
   - SUPABASE_KEY
   - SECRET_KEY (建议在生产环境设置)

### 检查方法

```bash
# 在Vercel Dashboard中检查环境变量
1. 打开项目设置
2. 点击 "Environment Variables"
3. 确认所有必需变量已设置
4. 确认变量适用于 "Production" 环境
```

## ✅ 前端配置检查

- [x] `frontend/src/api/client.ts` 使用 `/api` 作为baseURL
- [x] 前端构建命令正确：`npm install && npm run build`
- [x] 输出目录正确：`frontend/dist`

## ✅ 后端配置检查

- [x] `backend/main.py` 中所有路由使用 `/api` 前缀
- [x] FastAPI app 正确导出
- [x] 数据库初始化代码存在且正确

## ✅ Git 检查

```bash
# 检查当前分支
git branch

# 检查待推送的提交
git log origin/deploy/vercel-supabase..HEAD

# 检查未提交的更改
git status
```

确认：
- [ ] 所有更改已提交
- [ ] 没有未追踪的重要文件
- [ ] .env.local 等敏感文件已被 .gitignore 忽略

## ✅ 部署步骤

### 方法1：通过Git推送（推荐）

```bash
# 推送到GitHub
git push origin deploy/vercel-supabase

# 或推送到主分支（如果你的Vercel连接的是main分支）
git push origin main
```

### 方法2：使用Vercel CLI

```bash
# 安装Vercel CLI（如果尚未安装）
npm install -g vercel

# 登录
vercel login

# 部署到生产环境
vercel --prod
```

## ✅ 部署后验证

等待3-5分钟让部署完成，然后执行以下测试：

### 1. 测试根端点

```bash
curl https://你的域名.vercel.app/
```

**预期结果：**
```json
{"message":"欢迎使用 FuckLib 自助图书馆 API"}
```

### 2. 测试API文档

在浏览器中访问：
```
https://你的域名.vercel.app/api/docs
```

**预期结果：** 显示FastAPI的Swagger文档页面

### 3. 测试注册端点

```bash
curl -X POST "https://你的域名.vercel.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123",
    "invite_code": "ADMIN123"
  }'
```

**预期结果：** 
- 返回200状态码和用户信息（如果是新用户）
- 或返回400和"用户名已注册"错误（如果用户已存在）
- **不应该**返回404错误

### 4. 检查Vercel部署日志

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 点击 "Deployments"
4. 点击最新的部署
5. 查看 "Build Logs" 和 "Function Logs"

**检查要点：**
- ✅ 构建成功完成
- ✅ 没有Python导入错误
- ✅ 数据库连接成功
- ✅ "Seeded Invite Code: ADMIN123" 或 "Invite Code ADMIN123 already exists"

### 5. 测试前端应用

在浏览器中访问：
```
https://你的域名.vercel.app/
```

**检查要点：**
- ✅ 页面正常加载
- ✅ 可以访问登录页面
- ✅ 可以访问注册页面
- ✅ API调用正常工作（检查浏览器开发者工具的Network标签）

## 🐛 故障排除

### 问题：仍然显示404错误

**解决方案：**
1. 检查 `vercel.json` 中的配置是否正确
2. 确认 `/api/index.py` 文件存在
3. 清除浏览器缓存
4. 等待5分钟让部署完全生效
5. 查看Vercel的Function Logs获取详细错误信息

### 问题：数据库连接错误

**解决方案：**
1. 检查 `DATABASE_URL` 环境变量是否正确设置
2. 如果使用Supabase，确保使用的是正确的pooler URL
3. 检查数据库是否允许来自Vercel的连接（通常Supabase默认允许）
4. 查看Vercel Function Logs中的详细错误信息

### 问题：函数超时

**解决方案：**
1. Vercel免费计划函数超时限制为10秒
2. 优化数据库查询
3. 考虑升级到Pro计划（60秒超时）

### 问题：环境变量未生效

**解决方案：**
1. 确认环境变量已在Vercel项目设置中配置
2. 确认环境变量应用于"Production"环境
3. 重新部署项目以使环境变量生效

## 📝 部署完成后的操作

- [ ] 记录部署URL
- [ ] 测试所有主要功能
- [ ] 更新README.md中的部署URL（如果需要）
- [ ] 通知团队成员部署已完成
- [ ] 监控Vercel Dashboard中的错误日志

## 📚 相关文档

- [DEPLOY_NOW.md](./DEPLOY_NOW.md) - 快速部署指南
- [docs/API_404_FIX.md](./docs/API_404_FIX.md) - API 404错误修复详细说明
- [docs/DEPLOYMENT_SETUP.md](./docs/DEPLOYMENT_SETUP.md) - 部署设置文档

---

**准备好了吗？** 如果所有检查项都已完成，执行部署命令！

```bash
git push origin deploy/vercel-supabase
```

或

```bash
vercel --prod
```
