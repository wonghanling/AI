-- ============================================
-- 视频记录自动清理脚本
-- 每个用户保留最近 25 个视频记录
-- ============================================

-- 创建清理函数
CREATE OR REPLACE FUNCTION cleanup_old_videos()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除每个用户超过 25 个的旧视频记录
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

  -- 获取删除的记录数
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE '✅ 已清理 % 条旧的视频记录（每用户保留最近 25 个）', deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（每天凌晨 2 点执行）
SELECT cron.schedule(
  'cleanup-old-videos',
  '0 2 * * *',  -- 每天凌晨 2 点
  'SELECT cleanup_old_videos();'
);

-- 立即执行一次（测试）
SELECT cleanup_old_videos();

-- 查看当前视频记录统计
SELECT
  COUNT(*) as total_videos,
  COUNT(DISTINCT user_id) as total_users,
  ROUND(AVG(video_count)) as avg_videos_per_user,
  MAX(video_count) as max_videos_per_user
FROM (
  SELECT
    user_id,
    COUNT(*) as video_count
  FROM video_generations
  GROUP BY user_id
) user_stats;

-- 查看存储占用（估算）
SELECT
  pg_size_pretty(pg_total_relation_size('video_generations')) as table_size,
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('video_generations')::bigint / NULLIF(COUNT(*), 0)) as avg_record_size
FROM video_generations;

-- 查看即将被清理的记录数（预览）
SELECT
  user_id,
  COUNT(*) as total_videos,
  COUNT(*) - 25 as will_be_deleted
FROM video_generations
GROUP BY user_id
HAVING COUNT(*) > 25
ORDER BY total_videos DESC
LIMIT 10;
