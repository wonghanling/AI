# BoLuoing AI 项目清理总结

## 📋 清理完成时间
2026-01-20

## ✅ 已完成的清理工作

### 1. 移除了不存在的组件引用
- ❌ 删除了 `ProtectedRoute` 组件的所有引用
  - `app/chat/page.tsx`
  - `app/image/page.tsx`
  - `app/orders/page.tsx`
- ❌ 删除了 `UserContext` 的所有引用
  - `app/orders/page.tsx`

### 2. 清理了 localStorage 的使用
根据总纲要求，Supabase 自动管理 session，不需要手动操作 localStorage：
- ✅ `lib/supabase-client.ts` - 移除了 `localStorage.removeItem('supabase_token')`
- ✅ `app/auth/callback/page.tsx` - 移除了 `localStorage.setItem('supabase_token', ...)`
- ✅ `app/payment/page.tsx` - 移除了 `localStorage.getItem('supabase_token')`

### 3. 简化了认证逻辑
所有页面现在直接使用 Supabase 的 `getUser()` 方法检查认证状态：
```typescript
const supabase = getSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  router.push('/auth/login');
}
```

### 4. 创建了符合总纲的 Chat API
**位置**: `app/api/chat/route.ts`

**核心功能**（严格按照总纲要求）：
- ✅ **模型映射**: 只接受 `model_key`，不接受真实模型 ID
- ✅ **扣次逻辑**: 先检查配额，再调用 OpenRouter
- ✅ **限频控制**:
  - 并发限制：同一用户同时只能 1 个请求
  - 频率限制：10 秒窗口内最多 10 次
- ✅ **自动降级**: 遇到错误自动切换到 fallback 模型
- ✅ **Tokens 记录**: 记录到 `usage_stats` 表

**配额规则**：
- 免费用户：高级模型 3 次/天，普通模型 10 次/天
- 付费用户：无限制（后续可添加月度软阈值）

### 5. 数据库结构
使用你提供的 Supabase SQL 脚本，包含以下表：
- `users` - 用户信息
- `subscriptions` - 订阅记录
- `usage_stats` - 使用统计（按天记录）
- `rate_limits` - 速率限制
- `user_credits` - 用户积分
- `credit_transactions` - 积分流水
- `image_generations` - 图片生成记录
- `payment_orders` - 支付订单
- `chat_messages` - 聊天历史

## 📁 当前项目结构

```
ai-mirror-site/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          ✅ 新建（符合总纲）
│   ├── auth/
│   │   ├── callback/page.tsx     ✅ 已清理
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── chat/page.tsx              ✅ 已清理
│   ├── image/page.tsx             ✅ 已清理
│   ├── orders/page.tsx            ✅ 已清理
│   ├── payment/page.tsx           ✅ 已清理
│   ├── layout.tsx
│   └── page.tsx                   (首页)
├── lib/
│   ├── model-config.ts            ✅ 符合总纲
│   ├── supabase-client.ts         ✅ 已清理
│   ├── alipay.ts
│   ├── api-key-pool.ts
│   ├── image-config.ts
│   └── image-models.ts
├── components/                    (空目录)
├── .env.example                   ✅ 已更新
└── package.json
```

## 🔧 需要配置的环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# Site URL
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# 支付宝（可选）
ALIPAY_APP_ID=your_app_id
ALIPAY_PRIVATE_KEY="..."
ALIPAY_PUBLIC_KEY="..."
ALIPAY_NOTIFY_URL=https://yourdomain.com/api/payment/callback
```

## 🚀 下一步工作

### 必须完成（核心功能）
1. **测试 Chat API**
   - 测试模型映射是否正确
   - 测试配额限制是否生效
   - 测试自动降级是否工作
   - 测试 tokens 记录是否正确

2. **更新前端 Chat 页面**
   - 修改 API 调用，传递 `model_key` 而不是真实模型 ID
   - 添加 Authorization header（Bearer token）
   - 处理配额超限的错误提示

3. **创建其他必要的 API 路由**
   - `/api/user/quota` - 查询用户配额
   - `/api/payment/alipay` - 支付宝支付（如果需要）

### 可选完成（增强功能）
4. **图片生成 API**
   - `/api/image` - 图片生成接口
   - 积分扣除逻辑
   - 图片存储到 Supabase Storage

5. **管理后台**
   - 用户管理
   - 用量统计
   - 成本监控

## ⚠️ 重要提醒

### 总纲核心原则（必须遵守）
1. **后端永远不相信前端传来的"真实模型 id"，只接受 model_key**
2. **route.ts 必须有：映射、扣次、限频、降级、tokens 记录**
3. **任何新增表必须带 RLS 策略**
4. **所有 secrets 只放 env，不写死代码**

### 当前已实现
- ✅ 模型映射（model_key → openrouter_model）
- ✅ 扣次逻辑（先检查配额）
- ✅ 限频控制（并发 + 频率）
- ✅ 自动降级（fallback 机制）
- ✅ Tokens 记录（usage_stats 表）

### 待测试
- ⏳ 实际调用 OpenRouter API
- ⏳ 配额限制是否正确
- ⏳ 降级是否正常工作
- ⏳ 前端与后端的集成

## 📝 代码示例

### 前端调用 Chat API
```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    model_key: 'gpt-5.2',  // 使用 model_key，不是真实模型 ID
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    stream: true,
  }),
});
```

### 处理流式响应
```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const json = JSON.parse(data);
      console.log(json.content); // 显示内容
      console.log(json.used_model); // 显示使用的模型
    }
  }
}
```

## 🎉 总结

项目已经按照总纲要求完成了基础清理和重构：
- 移除了所有不符合总纲的代码（ProtectedRoute、UserContext、localStorage）
- 创建了符合总纲的 Chat API（映射、扣次、限频、降级、记录）
- 简化了认证逻辑（直接使用 Supabase Auth）
- 数据库结构已就绪（使用你提供的 SQL）

现在可以开始测试和完善功能了！
