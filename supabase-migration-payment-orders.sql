-- 为 payment_orders 表添加 credit_type 字段
-- 用于区分充值的是图片积分还是视频积分

-- 1. 添加 credit_type 字段
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS credit_type VARCHAR(20) DEFAULT 'image';

-- 2. 添加注释
COMMENT ON COLUMN payment_orders.credit_type IS '积分类型：image(图片积分) 或 video(视频积分)';

-- 3. 为现有记录设置默认值（如果是积分充值订单，默认为图片积分）
UPDATE payment_orders
SET credit_type = 'image'
WHERE order_type = 'credits' AND credit_type IS NULL;

-- 4. 验证数据
SELECT
  order_no,
  order_type,
  credits_amount,
  credit_type,
  status,
  created_at
FROM payment_orders
WHERE order_type = 'credits'
ORDER BY created_at DESC
LIMIT 10;
