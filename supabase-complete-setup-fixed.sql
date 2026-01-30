-- ============================================
-- Supabase 完整配置脚本（修复版）
-- 一次性执行所有必要的数据库配置
-- ============================================
-- 执行此脚本前请备份数据库！
-- 执行时间：约 2-3 分钟

-- ============================================
-- 第一部分：启用扩展
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

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

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 CHECK (credits >= 0),
ADD COLUMN IF NOT EXISTS image_credits INTEGER DEFAULT 0 CHECK (image_credits >= 0),
ADD COLUMN IF NOT EXISTS video_credits INTEGER DEFAULT 0 CHECK (video_credits >= 0);

CREATE INDEX IF NOT EXISTS idx_users_image_credits ON public.users(image_credits);
CREATE INDEX IF NOT EXISTS idx_users_video_credits ON public.users(video_credits);

COMMENT ON COLUMN public.users.credits IS '通用积分余额（保留兼容性）';
COMMENT ON COLUMN public.users.image_credits IS '图片生成积分余额';
COMMENT ON COLUMN public.users.video_credits IS '视频生成积分余额';

DO $$
BEGIN
  RAISE NOTICE '✅ users 表积分字段已添加';
END $$;

-- ============================================
-- 第三部分：更新相关表字段
-- ============================================

ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'image' CHECK (credit_type IN ('image', 'video', 'general'));

ALTER TABLE public.image_generations
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'nano-banana' CHECK (api_source IN ('nano-banana', 'pro'));

DO $$
BEGIN
  RAISE NOTICE '✅ 相关表字段已更新';
END $$;

-- ============================================
-- 第四部分：创建 video_generations 表
-- ============================================

CREATE TABLE IF NOT EXISTS public.video_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5 CHECK (duration IN (3, 5, 10)),
  resolution TEXT NOT NULL DEFAULT '1080p' CHECK (resolution IN ('720p', '1080p', '4k')),
  aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:3', '3:4')),
  style TEXT CHECK (style IN ('realistic', 'anime', '3d', 'cartoon', 'cinematic')),
  input_image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_actual DECIMAL(5, 2),
  file_size_mb DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  cost_credits INTEGER NOT NULL,
  error_message TEXT,
  task_id TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_video_generations_user_status ON public.video_generations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_created ON public.video_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generations_task_id ON public.video_generations(task_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);
CREATE INDEX IF NOT EXISTS idx_video_generations_created_at ON public.video_generations(created_at DESC);

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可以查看自己的视频生成记录" ON public.video_generations;
CREATE POLICY "用户可以查看自己的视频生成记录"
  ON public.video_generations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以插入自己的视频生成记录" ON public.video_generations;
CREATE POLICY "用户可以插入自己的视频生成记录"
  ON public.video_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.video_generations IS '视频生成记录表';
COMMENT ON COLUMN public.video_generations.prompt IS '用户输入的提示词';
COMMENT ON COLUMN public.video_generations.model IS '使用的视频生成模型';
COMMENT ON COLUMN public.video_generations.cost_credits IS '消耗的视频积分';
COMMENT ON COLUMN public.video_generations.task_id IS '云雾 API 任务 ID';
COMMENT ON COLUMN public.video_generations.status IS '生成状态：pending/processing/completed/failed';

DO $$
BEGIN
  RAISE NOTICE '✅ video_generations 表已创建';
END $$;

-- ============================================
-- 第五部分：创建自动清理函数
-- ============================================

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

DO $$
BEGIN
  RAISE NOTICE '✅ 自动清理函数已创建';
END $$;

-- ============================================
-- 第六部分：创建定时任务
-- ============================================

DO $$
BEGIN
  -- 删除旧的定时任务（如果存在）
  PERFORM cron.unschedule('cleanup-old-videos') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-videos'
  );

  PERFORM cron.unschedule('cleanup-old-chat-messages') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-chat-messages'
  );

  -- 创建新的定时任务
  PERFORM cron.schedule(
    'cleanup-old-videos',
    '0 2 * * *',
    'SELECT cleanup_old_videos();'
  );

  PERFORM cron.schedule(
    'cleanup-old-chat-messages',
    '0 3 * * *',
    'SELECT cleanup_old_chat_messages();'
  );

  RAISE NOTICE '✅ 定时任务已创建';
END $$;

-- ============================================
-- 第七部分：验证配置
-- ============================================

DO $$
DECLARE
  v_has_credits BOOLEAN;
  v_has_image_credits BOOLEAN;
  v_has_video_credits BOOLEAN;
  v_has_video_table BOOLEAN;
  v_video_job_count INTEGER;
  v_chat_job_count INTEGER;
BEGIN
  -- 验证 users 表字段
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

  -- 验证 video_generations 表
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_generations'
  ) INTO v_has_video_table;

  -- 验证定时任务
  SELECT COUNT(*) INTO v_video_job_count
  FROM cron.job WHERE jobname = 'cleanup-old-videos';

  SELECT COUNT(*) INTO v_chat_job_count
  FROM cron.job WHERE jobname = 'cleanup-old-chat-messages';

  -- 输出验证结果
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '配置验证结果';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'users.credits: %', CASE WHEN v_has_credits THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'users.image_credits: %', CASE WHEN v_has_image_credits THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'users.video_credits: %', CASE WHEN v_has_video_credits THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'video_generations 表: %', CASE WHEN v_has_video_table THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'cleanup-old-videos 任务: %', CASE WHEN v_video_job_count > 0 THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'cleanup-old-chat-messages 任务: %', CASE WHEN v_chat_job_count > 0 THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 第八部分：显示统计信息
-- ============================================

SELECT
  COUNT(*) as total_users,
  SUM(COALESCE(credits, 0)) as total_credits,
  SUM(COALESCE(image_credits, 0)) as total_image_credits,
  SUM(COALESCE(video_credits, 0)) as total_video_credits
FROM public.users;

SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobid;

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
  RAISE NOTICE '3. 等待 Vercel 部署完成';
  RAISE NOTICE '4. 测试功能';
  RAISE NOTICE '';
END $$;
