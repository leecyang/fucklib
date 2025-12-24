# 快速部署到Vercel

## 修复内容总结

✅ 创建了 `/api` 目录结构用于Vercel无服务器函数  
✅ 更新了 `vercel.json` 配置文件  
✅ 添加了 `.vercelignore` 文件  
✅ 创建了 `api/requirements.txt` Python依赖文件  

## 立即部署

### 选项1：推送到GitHub（推荐）

如果你的Vercel项目已连接到GitHub仓库：

```bash
git push origin deploy/vercel-supabase
```

Vercel会自动检测并部署。

### 选项2：使用Vercel CLI

```bash
# 如果还没安装Vercel CLI
npm install -g vercel

# 部署到生产环境
vercel --prod
```

## 部署后验证

等待部署完成（通常1-3分钟），然后测试：

### 1. 测试根端点
```bash
curl https://你的域名.vercel.app/
```
预期响应： `{"message":"欢迎使用 FuckLib 自助图书馆 API"}`

### 2. 测试API文档
浏览器访问： `https://你的域名.vercel.app/api/docs`

### 3. 测试注册端点
```bash
curl -X POST https://你的域名.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123","invite_code":"ADMIN123"}'
```

### 4. 检查Vercel日志
访问 Vercel Dashboard → 你的项目 → Deployments → 最新部署 → Function Logs

查看是否有错误信息。

## 常见问题

### Q: 仍然显示404错误？
A: 
1. 检查Vercel Dashboard中的部署日志
2. 确认环境变量已正确设置
3. 等待部署全部完成（可能需要几分钟）
4. 清除浏览器缓存

### Q: 数据库连接错误？
A: 检查Vercel项目设置中的环境变量：
- `DATABASE_URL` 必须正确设置
- 确保数据库允许来自Vercel的连接

### Q: 函数超时？
A: 
- 免费版Vercel函数有10秒超时限制
- 考虑优化数据库查询
- 或升级到Pro计划（60秒超时）

## 环境变量检查清单

确保在Vercel项目设置中配置了以下环境变量：

- [ ] `DATABASE_URL` - PostgreSQL连接字符串
- [ ] `VERCEL` - 自动设置为"1"（Vercel自动添加）
- [ ] 其他应用所需的自定义环境变量

## 需要帮助？

查看详细文档：`docs/API_404_FIX.md`
