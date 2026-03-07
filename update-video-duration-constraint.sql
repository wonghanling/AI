-- 更新 video_generations 表的 duration 约束
-- 支持所有 fal.ai 模型的 duration 值：4, 5, 6, 7, 8, 10

-- 1. 删除旧的 CHECK 约束
ALTER TABLE public.video_generations
DROP CONSTRAINT IF EXISTS video_generations_duration_check;

-- 2. 添加新的 CHECK 约束
ALTER TABLE public.video_generations
ADD CONSTRAINT video_generations_duration_check
CHECK (duration IN (4, 5, 6, 7, 8, 10));

-- 3. 验证约束
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'video_generations'
    AND constraint_name = 'video_generations_duration_check'
  ) THEN
    RAISE NOTICE '✅ duration 约束已更新，支持: 4, 5, 6, 7, 8, 10 秒';
  ELSE
    RAISE NOTICE '❌ duration 约束更新失败';
  END IF;
END $$;
