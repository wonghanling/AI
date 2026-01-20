# BoLuoing AI - 部署和测试指南

## 📋 前置准备

### 1. Supabase 设置

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 创建新项目或选择现有项目
3. 在 SQL Editor 中执行数据库初始化脚本（你已经完成）
4. 获取以下密钥：
   - Project URL: `Settings` → `API` → `Project URL`
   - Anon Key: `Settings` → `API` → `anon public`
   - Service Role Key: `Settings` → `API` → `service_role` (⚠️ 保密)

### 2. OpenRouter 设置

1. 访问 [OpenRouter](https://openrouter.ai)
2. 注册账号并充值
3. 创建 API Key: `Keys` → `Create Key`
4. 复制 API Key（格式：`sk-or-v1-...`）

### 3. 环境变量配置

在项目根目录创建 `.env.local` 文件：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 支付宝（可选，暂时不需要）
# ALIPAY_APP_ID=
# ALIPAY_PRIVATE_KEY=
# ALIPAY_PUBLIC_KEY=
# ALIPAY_NOTIFY_URL=
```

## 🚀 本地开发

### 1. 安装依赖

```bash
cd ai-mirror-site
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 3. 测试流程

#### 步骤 1: 注册账号

1. 访问 http://localhost:3000/auth/register
2. 输入邮箱和密码注册
3. 检查邮箱验证链接（Supabase 会发送）
4. 点击验证链接

#### 步骤 2: 登录

1. 访问 http://localhost:3000/auth/login
2. 输入邮箱和密码登录
3. 应该自动跳转到 `/chat` 页面

#### 步骤 3: 测试 Chat 功能

1. 在 Chat 页面选择模型（例如：Gemini 3 Flash）
2. 输入消息："你好，请介绍一下你自己"
3. 点击发送

**预期结果**：
- ✅ 消息发送成功
- ✅ 收到流式响应（逐字显示）
- ✅ 配额减少（免费用户：普通模型 10→9）
- ✅ 控制台无错误

#### 步骤 4: 测试配额限制

1. 连续发送 10 条消息（普通模型）
2. 第 11 条消息应该提示："今日普通模型配额已用完"

#### 步骤 5: 测试高级模型

1. 切换到高级模型（例如：GPT-5.2）
2. 发送消息
3. 检查配额（免费用户：高级模型 3→2）

#### 步骤 6: 测试自动降级

1. 在 OpenRouter 中暂停某个模型（或者修改 model-config.ts 使用不存在的模型）
2. 发送消息
3. 应该自动降级到 fallback 模型
4. 控制台显示："模型已自动降级到: XXX"

## 🔍 调试技巧

### 查看 API 日志

在浏览器开发者工具中：
1. 打开 `Network` 标签
2. 筛选 `Fetch/XHR`
3. 查看 `/api/chat` 请求
4. 检查 Request Headers、Request Payload、Response

### 查看数据库数据

在 Supabase Dashboard：
1. 进入 `Table Editor`
2. 查看 `usage_stats` 表 - 应该有新记录
3. 查看 `users` 表 - 确认 user_type
4. 查看 `rate_limits` 表 - 检查限频记录

### 常见问题

#### 问题 1: "无效的认证令牌"

**原因**: Session 过期或未登录

**解决**:
```bash
# 清除浏览器缓存
# 重新登录
```

#### 问题 2: "今日配额已用完"

**原因**: 已达到每日限制

**解决**:
```sql
-- 在 Supabase SQL Editor 中执行
DELETE FROM usage_stats WHERE user_id = 'your-user-id' AND date = CURRENT_DATE;
```

#### 问题 3: OpenRouter API 错误

**原因**: API Key 无效或余额不足

**解决**:
1. 检查 `.env.local` 中的 `OPENROUTER_API_KEY`
2. 访问 OpenRouter Dashboard 检查余额
3. 查看 OpenRouter 的 API 日志

#### 问题 4: 流式响应不工作

**原因**: 响应格式不匹配

**解决**:
1. 检查 `/api/chat/route.ts` 的响应格式
2. 检查前端 `chat/page.tsx` 的解析逻辑
3. 查看浏览器控制台的错误信息

## 📊 监控和统计

### 查看用户使用情况

```sql
-- 今日使用统计
SELECT
  u.email,
  u.user_type,
  COUNT(*) as total_requests,
  SUM(CASE WHEN us.model_tier = 'advanced' THEN 1 ELSE 0 END) as advanced_count,
  SUM(CASE WHEN us.model_tier = 'basic' THEN 1 ELSE 0 END) as basic_count,
  SUM(us.tokens_used) as total_tokens,
  SUM(us.cost_usd) as total_cost
FROM users u
LEFT JOIN usage_stats us ON u.id = us.user_id AND us.date = CURRENT_DATE
GROUP BY u.id, u.email, u.user_type
ORDER BY total_cost DESC;
```

### 查看模型使用分布

```sql
-- 模型使用统计
SELECT
  model_name,
  model_tier,
  COUNT(*) as request_count,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost
FROM usage_stats
WHERE date = CURRENT_DATE
GROUP BY model_name, model_tier
ORDER BY request_count DESC;
```

## 🌐 部署到 Vercel

### 1. 推送代码到 GitHub

```bash
cd ai-mirror-site
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/boluoing-ai.git
git push -u origin main
```

### 2. 连接 Vercel

1. 访问 [Vercel Dashboard](https://vercel.com)
2. 点击 `New Project`
3. 导入 GitHub 仓库
4. 配置环境变量（与 `.env.local` 相同）
5. 点击 `Deploy`

### 3. 更新环境变量

部署后，更新以下环境变量：
```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
ALIPAY_NOTIFY_URL=https://your-domain.vercel.app/api/payment/callback
```

### 4. 配置自定义域名（可选）

1. 在 Vercel 项目设置中添加域名
2. 在域名提供商处添加 DNS 记录
3. 等待 SSL 证书生成

## ✅ 测试清单

在部署到生产环境前，确保以下功能正常：

### 认证功能
- [ ] 用户注册
- [ ] 邮箱验证
- [ ] 用户登录
- [ ] 用户登出
- [ ] Session 持久化

### Chat 功能
- [ ] 发送消息
- [ ] 接收流式响应
- [ ] 模型切换
- [ ] 配额显示
- [ ] 配额限制
- [ ] 错误提示

### 配额系统
- [ ] 免费用户：普通模型 10 次/天
- [ ] 免费用户：高级模型 3 次/天
- [ ] 付费用户：无限制（或月度软阈值）
- [ ] 配额重置（每日 00:00）

### 降级机制
- [ ] 模型不可用时自动降级
- [ ] 降级提示显示
- [ ] 降级后正常响应

### 数据记录
- [ ] usage_stats 表记录正确
- [ ] tokens 统计准确
- [ ] cost 计算正确
- [ ] 日期和月份字段正确

### 性能
- [ ] 首次响应 < 2 秒
- [ ] 流式响应流畅
- [ ] 并发请求正常
- [ ] 无内存泄漏

## 🔐 安全检查

- [ ] Service Role Key 未泄露
- [ ] OpenRouter API Key 未泄露
- [ ] RLS 策略正确配置
- [ ] API 路由有认证保护
- [ ] 前端不信任用户输入
- [ ] SQL 注入防护
- [ ] XSS 防护

## 📈 下一步优化

1. **添加缓存**
   - 用户配额信息缓存 60 秒
   - 减少数据库查询

2. **优化数据库查询**
   - 使用 Supabase 的 RPC 函数
   - 批量查询减少往返

3. **添加监控**
   - Sentry 错误追踪
   - Vercel Analytics 性能监控
   - 自定义日志系统

4. **完善功能**
   - 对话历史保存
   - 图片生成功能
   - 支付集成
   - 管理后台

## 🎉 完成！

如果所有测试通过，恭喜你！项目已经可以正常运行了。

有问题请查看：
- `CLEANUP-SUMMARY.md` - 项目清理总结
- 项目总纲文档 - 核心设计原则
- Supabase 文档 - 数据库和认证
- OpenRouter 文档 - AI 模型调用
