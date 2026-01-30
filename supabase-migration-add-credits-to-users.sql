-- ============================================
-- 数据库迁移脚本：为 users 表添加积分字段
-- ============================================
-- 执行此脚本前请备份数据库！
-- 此脚本用于将积分字段直接添加到 users 表中

-- 1. 添加积分字段到 users 表
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 CHECK (credits >= 0),
ADD COLUMN IF NOT EXISTS image_credits INTEGER DEFAULT 0 CHECK (image_credits >= 0),
ADD COLUMN IF NOT EXISTS video_credits INTEGER DEFAULT 0 CHECK (video_credits >= 0);

-- 2. 为新字段添加索引
CREATE INDEX IF NOT EXISTS idx_users_image_credits ON public.users(image_credits);
CREATE INDEX IF NOT EXISTS idx_users_video_credits ON public.users(video_credits);

-- 3. 为新字段添加注释
COMMENT ON COLUMN public.users.credits IS '通用积分余额（保留兼容性）';
COMMENT ON COLUMN public.users.image_credits IS '图片生成积分余额';
COMMENT ON COLUMN public.users.video_credits IS '视频生成积分余额';

-- 4. 如果存在 user_credits 表，迁移数据到 users 表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_credits') THEN
    -- 将 user_credits.balance 迁移到 users.credits
    UPDATE public.users u
    SET credits = COALESCE(uc.balance, 0)
    FROM public.user_credits uc
    WHERE u.id = uc.user_id AND u.credits = 0;

    RAISE NOTICE '已从 user_credits 表迁移数据到 users 表';
  END IF;
END $$;

-- 5. 为 credit_transactions 表添加 credit_type 字段（如果不存在）
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

-- 6. 为 payment_orders 表添加 credit_type 字段（如果不存在）
ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

-- 7. 为 image_generations 表添加 api_source 字段（如果不存在）
ALTER TABLE public.image_generations
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'nano-banana' CHECK (api_source IN ('nano-banana', 'pro'));

-- 8. 验证数据
SELECT
  id,
  email,
  user_type,
  credits,
  image_credits,
  video_credits,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- 9. 显示统计信息
SELECT
  COUNT(*) as total_users,
  SUM(credits) as total_credits,
  SUM(image_credits) as total_image_credits,
  SUM(video_credits) as total_video_credits,
  COUNT(CASE WHEN user_type = 'free' THEN 1 END) as free_users,
  COUNT(CASE WHEN user_type = 'premium' THEN 1 END) as premium_users
FROM public.users;

-- 10. 显示完成消息
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库迁移完成！';
  RAISE NOTICE '请检查上面的验证数据是否正确';
END $$;
