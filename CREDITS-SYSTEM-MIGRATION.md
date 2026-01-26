# 积分系统分离实施指南

## 概述
将原有的单一积分系统分离为图片积分和视频积分两个独立的积分类型。

## 数据库迁移步骤

### 1. 在图片聊天网站的 Supabase 中执行以下 SQL

#### 步骤 1：更新 users 表
```bash
执行文件：supabase-migration-split-credits.sql
```

这将：
- 添加 `image_credits` 和 `video_credits` 字段
- 将现有的 `credits` 迁移到 `image_credits`
- 保留原有的 `credits` 字段（用于兼容性）

#### 步骤 2：更新 payment_orders 表
```bash
执行文件：supabase-migration-payment-orders.sql
```

这将：
- 添加 `credit_type` 字段（用于区分充值类型）
- 为现有订单设置默认值为 'image'

### 2. 验证迁移结果

在 Supabase SQL Editor 中执行：

```sql
-- 检查 users 表
SELECT id, email, credits, image_credits, video_credits
FROM users
LIMIT 10;

-- 检查 payment_orders 表
SELECT order_no, order_type, credits_amount, credit_type, status
FROM payment_orders
WHERE order_type = 'credits'
ORDER BY created_at DESC
LIMIT 10;
```

## API 更新说明

### 1. 积分查询 API (`/api/user/credits`)
**返回数据新增字段：**
```json
{
  "userType": "free",
  "credits": 100,        // 保留旧字段（兼容性）
  "balance": 100,        // 保留旧字段（兼容性）
  "imageCredits": 100,   // 新增：图片积分
  "videoCredits": 50,    // 新增：视频积分
  "usage": { ... }
}
```

### 2. 充值 API (`/api/payment/alipay`)
**请求参数新增：**
```json
{
  "plan": "credits",
  "amount": 50,
  "credits": 500,
  "creditType": "video"  // 新增：积分类型（image/video）
}
```

### 3. 图片生成 API (`/api/image/generate`)
- 现在使用 `image_credits` 字段
- 扣费时只扣除图片积分

### 4. 支付回调 API (`/api/payment/alipay/notify`)
- 根据 `credit_type` 更新对应的积分字段
- `image` → 更新 `image_credits`
- `video` → 更新 `video_credits`

## 前端更新说明

### 充值页面 (`/app/credits/recharge/page.tsx`)
- 显示两个独立的积分余额
- 支持切换充值类型（图片/视频）
- 充值时传递 `creditType` 参数

## 视频网站集成方案

### 方案 A：API 调用（推荐）

视频网站通过 API 调用图片网站的积分系统：

```typescript
// 查询视频积分
const response = await fetch('https://图片网站域名/api/user/credits', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const data = await response.json();
const videoCredits = data.videoCredits;

// 扣除视频积分（需要在图片网站创建对应的 API）
```

### 方案 B：共享数据库连接

视频网站直接连接到图片网站的 Supabase：

```typescript
// 在视频网站的 .env 中配置
NEXT_PUBLIC_SUPABASE_URL=图片网站的Supabase URL
SUPABASE_SERVICE_ROLE_KEY=图片网站的Service Role Key

// 查询和更新 video_credits
const { data } = await supabase
  .from('users')
  .select('video_credits')
  .eq('id', userId)
  .single();
```

## 注意事项

1. **数据备份**：执行 SQL 迁移前务必备份数据库
2. **兼容性**：保留了 `credits` 字段，确保旧代码不会立即失效
3. **测试**：在生产环境执行前，先在开发环境测试
4. **监控**：迁移后监控充值和扣费是否正常

## 回滚方案

如果需要回滚：

```sql
-- 将 image_credits 合并回 credits
UPDATE users
SET credits = COALESCE(image_credits, 0) + COALESCE(video_credits, 0);

-- 删除新字段（可选）
ALTER TABLE users DROP COLUMN image_credits;
ALTER TABLE users DROP COLUMN video_credits;
ALTER TABLE payment_orders DROP COLUMN credit_type;
```

## 后续优化建议

1. 创建积分变更历史表，记录每次充值和扣费
2. 添加积分转换功能（图片积分 ↔ 视频积分）
3. 为视频网站创建专用的积分 API 端点
4. 实施积分使用统计和分析
