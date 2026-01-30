-- ============================================
-- 视频生成记录表 (video_generations)
-- ============================================
-- 用于记录用户的视频生成历史和状态

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
  duration_actual DECIMAL(5, 2), -- 实际生成的视频时长（秒）
  file_size_mb DECIMAL(10, 2),   -- 文件大小（MB）

  -- 状态和成本
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  cost_credits INTEGER NOT NULL,
  error_message TEXT,

  -- 任务信息（用于轮询）
  task_id TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 元数据（JSON 格式，用于存储额外信息）
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_video_generations_user_status ON public.video_generations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_created ON public.video_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generations_task_id ON public.video_generations(task_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);
CREATE INDEX IF NOT EXISTS idx_video_generations_created_at ON public.video_generations(created_at DESC);

-- RLS 策略（行级安全）
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的视频生成记录
CREATE POLICY "用户可以查看自己的视频生成记录"
  ON public.video_generations FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以插入自己的视频生成记录
CREATE POLICY "用户可以插入自己的视频生成记录"
  ON public.video_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 字段注释
COMMENT ON TABLE public.video_generations IS '视频生成记录表';
COMMENT ON COLUMN public.video_generations.prompt IS '用户输入的提示词';
COMMENT ON COLUMN public.video_generations.model IS '使用的视频生成模型';
COMMENT ON COLUMN public.video_generations.duration IS '视频时长（秒）：3/5/10';
COMMENT ON COLUMN public.video_generations.resolution IS '视频分辨率：720p/1080p/4k';
COMMENT ON COLUMN public.video_generations.aspect_ratio IS '视频宽高比：16:9/9:16/1:1/4:3/3:4';
COMMENT ON COLUMN public.video_generations.style IS '视频风格：realistic/anime/3d/cartoon/cinematic';
COMMENT ON COLUMN public.video_generations.input_image_url IS '图生视频的输入图片 URL（可选）';
COMMENT ON COLUMN public.video_generations.video_url IS '生成的视频 URL';
COMMENT ON COLUMN public.video_generations.thumbnail_url IS '视频缩略图 URL';
COMMENT ON COLUMN public.video_generations.cost_credits IS '消耗的视频积分';
COMMENT ON COLUMN public.video_generations.task_id IS '云雾 API 任务 ID（用于轮询状态）';
COMMENT ON COLUMN public.video_generations.progress IS '生成进度（0-100）';
COMMENT ON COLUMN public.video_generations.status IS '生成状态：pending/processing/completed/failed';
COMMENT ON COLUMN public.video_generations.metadata IS '额外的元数据（JSON 格式）';

-- 验证表是否创建成功
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'video_generations'
ORDER BY ordinal_position;

-- 显示完成消息
DO $$
BEGIN
  RAISE NOTICE '✅ video_generations 表创建完成！';
  RAISE NOTICE '表结构已显示在上方查询结果中';
END $$;
