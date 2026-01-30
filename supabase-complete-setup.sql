-- ============================================
-- Supabase 完整配置脚本
-- 一次性执行所有必要的数据库配置
-- ============================================
-- 执行此脚本前请备份数据库！
-- 执行时间：约 2-3 分钟

-- ============================================
-- 第一部分：启用扩展
-- ============================================

-- 启用 pg_cron 扩展（用于定时任务）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 验证扩展
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '✅ pg_cron 扩展已启用';
  ELSE
    RAISE NOTICE '❌ pg_cron 扩展启用失败';
  END IF;
END $$;

-- ============================================
-- 第二部分：添加积分字段到 users 表
-- ============================================

-- 添加积分字段
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 CHECK (credits >= 0),
ADD COLUMN IF NOT EXISTS image_credits INTEGER DEFAULT 0 CHECK (image_credits >= 0),
ADD COLUMN IF NOT EXISTS video_credits INTEGER DEFAULT 0 CHECK (video_credits >= 0);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_image_credits ON public.users(image_credits);
CREATE INDEX IF NOT EXISTS idx_users_video_credits ON public.users(video_credits);

-- 添加注释
COMMENT ON COLUMN public.users.credits IS '通用积分余额（保留兼容性）';
COMMENT ON COLUMN public.users.image_credits IS '图片生成积分余额';
COMMENT ON COLUMN public.users.video_credits IS '视频生成积分余额';

RAISE NOTICE '✅ users 表积分字段已添加';

-- ============================================
-- 第三部分：更新相关表字段
-- ============================================

-- 为 credit_transactions 表添加 credit_type 字段
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

-- 为 payment_orders 表添加 credit_type 字段
ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

-- 为 image_generations 表添加 api_source 字段
ALTER TABLE public.image_generations
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'nano-banana' CHECK (api_source IN ('nano-banana', 'pro'));

RAISE NOTICE '✅ 相关表字段已更新';

-- ============================================
-- 第四部分：创建 video_generations 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.video_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 生成参数
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5 CHECK (duration IN (3, 5, 10)),
  resolution TEXT NOT NULL DEFAULT '1080p' CHECK (resolution IN ('720p', '1080p', '4k')),
  aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:3', '3:4')),
  style TEXT CHECK (style IN ('realistic', 'anime', '3d', 'cartoon', 'cinematic')),

  -- 图生视频（可选）
  input_image_url TEXT,

  -- 生成结果
  video_url TEXT,
  thumbnail_url TEXT,
  duration_actual DECIMAL(5, 2),
  file_size_mb DECIMAL(10, 2),

  -- 状态和成本
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  cost_credits INTEGER NOT NULL,
  error_message TEXT,

  -- 任务信息
  task_id TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 元数据
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_generations_user_status ON public.video_generations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_created ON public.video_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generations_task_id ON public.video_generations(task_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);
CREATE INDEX IF NOT EXISTS idx_video_generations_created_at ON public.video_generations(created_at DESC);

-- RLS 策略
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的视频生成记录"
  ON public.video_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以插入自己的视频生成记录"
  ON public.video_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 字段注释
COMMENT ON TABLE public.video_generations IS '视频生成记录表';
COMMENT ON COLUMN public.video_generations.prompt IS '用户输入的提示词';
COMMENT ON COLUMN public.video_generations.model IS '使用的视频生成模型';
COMMENT ON COLUMN public.video_generations.cost_credits IS '消耗的视频积分';
COMMENT ON COLUMN public.video_generations.task_id IS '云雾 API 任务 ID';
COMMENT ON COLUMN public.video_generations.status IS '生成状态：pending/processing/completed/failed';

RAISE NOTICE '✅ video_generations 表已创建';

-- ============================================
-- 第五部分：创建自动清理函数
-- ============================================

-- 1. 视频记录清理函数（每用户保留 25 个）
CREATE OR REPLACE FUNCTION cleanup_old_videos()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked_videos AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY created_at DESC
      ) as rn
    FROM video_generations
  )
  DELETE FROM video_generations
  WHERE id IN (
    SELECT id FROM ranked_videos WHERE rn > 25
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ 已清理 % 条旧的视频记录（每用户保留最近 25 个）', deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 聊天记录清理函数（每用户保留 600 条）
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked_messages AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY created_at DESC
      ) as rn
    FROM chat_messages
  )
  DELETE FROM chat_messages
  WHERE id IN (
    SELECT id FROM ranked_messages WHERE rn > 600
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ 已清理 % 条旧的聊天记录（每用户保留最近 600 条）', deleted_count;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✅ 自动清理函数已创建';

-- ============================================
-- 第六部分：创建定时任务
-- ============================================

-- 删除旧的定时任务（如果存在）
SELECT cron.unschedule('cleanup-old-videos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-videos'
);

SELECT cron.unschedule('cleanup-old-chat-messages') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-chat-messages'
);

-- 创建新的定时任务
SELECT cron.schedule(
  'cleanup-old-videos',
  '0 2 * * *',  -- 每天凌晨 2 点
  'SELECT cleanup_old_videos();'
);

SELECT cron.schedule(
  'cleanup-old-chat-messages',
  '0 3 * * *',  -- 每天凌晨 3 点
  'SELECT cleanup_old_chat_messages();'
);

RAISE NOTICE '✅ 定时任务已创建';

-- ============================================
-- 第七部分：验证配置
-- ============================================

-- 验证 users 表字段
DO $$
DECLARE
  v_has_credits BOOLEAN;
  v_has_image_credits BOOLEAN;
  v_has_video_credits BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'credits'
  ) INTO v_has_credits;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image_credits'
  ) INTO v_has_image_credits;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'video_credits'
  ) INTO v_has_video_credits;

  RAISE NOTICE '========================================';
  RAISE NOTICE '配置验证结果';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'users.credits: %', CASE WHEN v_has_credits THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'users.image_credits: %', CASE WHEN v_has_image_credits THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'users.video_credits: %', CASE WHEN v_has_video_credits THEN '✅' ELSE '❌' END;
END $$;

-- 验证 video_generations 表
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_generations'
  ) THEN
    RAISE NOTICE 'video_generations 表: ✅';
  ELSE
    RAISE NOTICE 'video_generations 表: ❌';
  END IF;
END $$;

-- 验证定时任务
DO $$
DECLARE
  v_video_job_count INTEGER;
  v_chat_job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_video_job_count
  FROM cron.job WHERE jobname = 'cleanup-old-videos';

  SELECT COUNT(*) INTO v_chat_job_count
  FROM cron.job WHERE jobname = 'cleanup-old-chat-messages';

  RAISE NOTICE 'cleanup-old-videos 任务: %', CASE WHEN v_video_job_count > 0 THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'cleanup-old-chat-messages 任务: %', CASE WHEN v_chat_job_count > 0 THEN '✅' ELSE '❌' END;
END $$;

-- ============================================
-- 第八部分：显示统计信息
-- ============================================

-- 用户积分统计
SELECT
  '用户积分统计' as info,
  COUNT(*) as total_users,
  SUM(credits) as total_credits,
  SUM(image_credits) as total_image_credits,
  SUM(video_credits) as total_video_credits
FROM public.users;

-- 定时任务列表
SELECT
  '定时任务列表' as info,
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobid;

-- 表大小统计
SELECT
  '表大小统计' as info,
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM (
  VALUES
    ('users'),
    ('chat_messages'),
    ('image_generations'),
    ('video_generations'),
    ('usage_stats')
) AS t(table_name)
ORDER BY pg_total_relation_size(table_name::regclass) DESC;

-- ============================================
-- 配置完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 所有配置已完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 检查上面的验证结果';
  RAISE NOTICE '2. 确认所有项都显示 ✅';
  RAISE NOTICE '3. 部署前端代码';
  RAISE NOTICE '4. 测试功能';
  RAISE NOTICE '';
END $$;
