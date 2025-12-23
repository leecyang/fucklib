# 🚀 Vercel + Supabase 自动部署设置指南

本文档说明如何配置 GitHub Actions 工作流，实现 `deploy/vercel-supabase` 分支的自动部署。

## 📋 前提条件

- GitHub 仓库已创建
- Vercel 账户已创建并关联项目
- Supabase 账户已创建并有项目

---

## 🔐 GitHub Secrets 配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 secrets：

### Vercel 相关

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `VERCEL_TOKEN` | Vercel API Token | [Vercel Dashboard](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Vercel 组织/用户 ID | 在 `.vercel/project.json` 中或运行 `vercel link` 后获取 |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID | 在 `.vercel/project.json` 中或运行 `vercel link` 后获取 |
| `PRODUCTION_URL` | 生产环境 URL | 例如: `https://fucklib.vercel.app` |

### Supabase 相关

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `SUPABASE_ACCESS_TOKEN` | Supabase 个人访问令牌 | [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | Supabase 项目 Reference ID | 在 Supabase 项目设置中，格式如 `abcdefghijklmnop` |
| `SUPABASE_DB_PASSWORD` | 数据库密码 | 在创建项目时设置的密码 |

### 可选配置

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `VITE_API_URL` | 前端 API 地址 | 通常为 `/api` 或完整 URL |

---

## 🌿 分支策略

### 工作流触发规则

| 分支 | 行为 |
|-----|------|
| `deploy/vercel-supabase` | ✅ 触发自动部署到 Vercel + Supabase |
| `main` | ❌ 不触发此工作流 |
| `release/*` | ❌ 不触发此工作流 |
| 其他分支 | ❌ 不触发此工作流 |

### 推荐工作流程

```
feature/* ──→ main ──→ deploy/vercel-supabase ──→ 自动部署
                           ↑
                       手动合并或 cherry-pick
```

1. **开发**: 在 `feature/*` 分支开发新功能
2. **合并**: 将功能合并到 `main` 分支
3. **部署**: 将 `main` 合并到 `deploy/vercel-supabase` 触发自动部署

---

## 📁 项目结构

```
fucklib/
├── .github/
│   └── workflows/
│       └── deploy-vercel-supabase.yml  # 部署工作流
├── supabase/
│   ├── config.toml                      # Supabase 配置
│   └── migrations/                       # 数据库迁移文件
│       └── 20231223000000_initial_schema.sql
├── backend/                              # Python FastAPI 后端
├── frontend/                             # React Vite 前端
└── vercel.json                           # Vercel 配置
```

---

## 🔧 本地开发配置

### 1. 安装 Supabase CLI

```bash
npm install -g supabase
```

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 链接项目

```bash
supabase link --project-ref <your-project-ref>
```

### 4. 创建新迁移

```bash
# 创建迁移文件
supabase migration new <migration_name>

# 推送迁移到远程
supabase db push
```

---

## 🏃 手动触发部署

如需手动触发部署，可以：

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 选择 **Deploy to Vercel & Supabase** 工作流
3. 点击 **Run workflow** 按钮
4. 选择 `deploy/vercel-supabase` 分支
5. 点击 **Run workflow**

---

## 🔍 故障排除

### 常见问题

#### 1. Vercel 部署失败
- 检查 `VERCEL_TOKEN` 是否有效
- 确认 `VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID` 正确
- 查看 GitHub Actions 日志获取详细错误

#### 2. Supabase 迁移失败
- 确认 `SUPABASE_ACCESS_TOKEN` 有效
- 检查 `SUPABASE_PROJECT_REF` 是否正确
- 确保迁移 SQL 语法正确

#### 3. 健康检查失败
- 部署后可能需要 30-60 秒才能完全启动
- 检查 `PRODUCTION_URL` 是否正确
- 如果 API 没有 `/api/health` 端点，可以修改工作流

---

## 📋 清单

部署前确认以下事项：

- [ ] 已在 GitHub 配置所有必需的 Secrets
- [ ] 已更新 `supabase/config.toml` 中的 `project.id`
- [ ] 已创建 `deploy/vercel-supabase` 分支
- [ ] 数据库迁移文件已准备就绪
- [ ] 前端环境变量已配置

---

## 🔗 相关链接

- [Vercel CLI 文档](https://vercel.com/docs/cli)
- [Supabase CLI 文档](https://supabase.com/docs/guides/cli)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
