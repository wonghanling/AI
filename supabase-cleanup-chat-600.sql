-- ============================================
-- 聊天记录自动清理脚本
-- 每个用户保留最近 600 条聊天记录
-- ============================================

-- 创建清理函数
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除每个用户超过 600 条的旧记录
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

  -- 获取删除的记录数
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE '✅ 已清理 % 条旧的聊天记录（每用户保留最近 600 条）', deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（每天凌晨 3 点执行）
SELECT cron.schedule(
  'cleanup-old-chat-messages',
  '0 3 * * *',  -- 每天凌晨 3 点
  'SELECT cleanup_old_chat_messages();'
);

-- 立即执行一次（测试）
SELECT cleanup_old_chat_messages();

-- 查看当前聊天记录统计
SELECT
  COUNT(*) as total_messages,
  COUNT(DISTINCT user_id) as total_users,
  ROUND(AVG(message_count)) as avg_messages_per_user,
  MAX(message_count) as max_messages_per_user,
  MIN(message_count) as min_messages_per_user
FROM (
  SELECT
    user_id,
    COUNT(*) as message_count
  FROM chat_messages
  GROUP BY user_id
) user_stats;

-- 查看存储占用（估算）
SELECT
  pg_size_pretty(pg_total_relation_size('chat_messages')) as table_size,
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('chat_messages')::bigint / NULLIF(COUNT(*), 0)) as avg_record_size
FROM chat_messages;

-- 查看即将被清理的记录数（预览）
SELECT
  user_id,
  COUNT(*) as total_messages,
  COUNT(*) - 600 as will_be_deleted
FROM chat_messages
GROUP BY user_id
HAVING COUNT(*) > 600
ORDER BY total_messages DESC
LIMIT 10;
