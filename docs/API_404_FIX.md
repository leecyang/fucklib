# Vercel API 404 错误修复说明

## 问题描述

之前部署到Vercel后，访问`/api/auth/token`和`/api/auth/register`等API端点时返回404错误。

## 根本原因

Vercel对于Python FastAPI应用需要特定的目录结构：
1. API函数必须放在项目根目录的`/api`文件夹中
2. 需要正确的`vercel.json`配置来路由请求
3. FastAPI应用需要通过特定方式导出

## 解决方案

### 1. 创建了`/api`目录结构

创建了`/api/index.py`文件作为Vercel无服务器函数的入口点：
- 该文件导入`backend/main.py`中的FastAPI app
- Vercel会自动检测并使用名为`app`的FastAPI实例

### 2. 更新了`vercel.json`配置

新配置包含：
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/index.py": {
      "runtime": "python3.9"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    }
  ]
}
```

主要更改：
- 移除了旧的`builds`和`routes`配置
- 使用`functions`指定Python运行时
- 使用`rewrites`将所有`/api/*`请求重写到`/api`函数

### 3. 创建了`/api/requirements.txt`

Vercel会读取这个文件来安装Python依赖。

### 4. 创建了`.vercelignore`

排除不必要的文件以加快部署速度。

## 部署步骤

### 方式1：使用Vercel CLI

```bash
# 安装Vercel CLI（如果还没安装）
npm i -g vercel

# 登录Vercel
vercel login

# 部署
vercel --prod
```

### 方式2：通过Git推送

如果项目已连接到Vercel：
```bash
git add .
git commit -m "修复Vercel API 404错误"
git push origin main
```

Vercel会自动检测到更改并重新部署。

## 验证部署

部署成功后，访问以下端点验证：

1. 根端点：`https://你的域名.vercel.app/`
   - 应返回：`{"message": "欢迎使用 FuckLib 自助图书馆 API"}`

2. API文档：`https://你的域名.vercel.app/api/docs`
   - 应显示FastAPI自动生成的API文档

3. 注册端点：`https://你的域名.vercel.app/api/auth/register`
   - POST请求应正常工作（不再返回404）

4. Token端点：`https://你的域名.vercel.app/api/auth/token`
   - POST请求应正常工作（不再返回404）

## 注意事项

1. **环境变量**：确保在Vercel项目设置中配置了所有必需的环境变量：
   - `DATABASE_URL`
   - `SUPABASE_URL`（如果使用）
   - `SUPABASE_KEY`（如果使用）
   - 其他应用所需的环境变量

2. **数据库连接**：
   - Vercel函数是无状态的，每次请求可能运行在不同的实例上
   - 确保数据库连接字符串正确且支持连接池

3. **冷启动**：
   - 无服务器函数可能有冷启动延迟
   - 第一次请求可能需要几秒钟

4. **路由问题**：
   - 所有API请求必须以`/api/`开头
   - FastAPI内部路由已配置正确（`/api/auth/*`, `/api/library/*`等）

## 后续优化

1. 考虑使用Vercel Edge Functions以获得更快的响应时间
2. 实现API响应缓存
3. 监控Vercel函数的性能和错误日志
