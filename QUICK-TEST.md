# 快速测试清单

## 🚀 立即测试（环境已配置）

### 1. 访问你的网站
打开浏览器访问你的 Vercel 域名

### 2. 注册/登录
- 如果还没账号：访问 `/auth/register` 注册
- 如果有账号：访问 `/auth/login` 登录

### 3. 测试 Chat 功能
1. 登录后应该自动跳转到 `/chat`
2. 选择一个模型（建议先选 Gemini 3 Flash - 便宜）
3. 输入："你好，请介绍一下你自己"
4. 点击发送

### 预期结果
- ✅ 消息发送成功
- ✅ 看到流式响应（逐字显示）
- ✅ 配额数字减少
- ✅ 无错误提示

### 4. 如果出现错误

#### 错误："无效的认证令牌"
- 重新登录

#### 错误："今日配额已用完"
- 去 Supabase Dashboard → Table Editor → usage_stats
- 删除今天的记录

#### 错误：OpenRouter 相关
- 检查 Vercel 环境变量中的 `OPENROUTER_API_KEY`
- 检查 OpenRouter 账户余额

#### 错误：Supabase 相关
- 检查 Vercel 环境变量中的 Supabase 密钥
- 确认数据库 SQL 脚本已执行

### 5. 查看数据库记录

在 Supabase Dashboard：
1. Table Editor → `usage_stats`
2. 应该看到新的记录，包含：
   - user_id
   - model_name
   - tokens_used
   - cost_usd
   - date（今天）

## 🎯 关键测试点

- [ ] 用户可以登录
- [ ] Chat 页面加载正常
- [ ] 可以发送消息
- [ ] 收到 AI 回复
- [ ] 配额正确扣除
- [ ] 数据库有记录

## 📝 测试完成后

如果一切正常，你的项目就可以使用了！

如果有问题，告诉我具体的错误信息，我会帮你解决。
