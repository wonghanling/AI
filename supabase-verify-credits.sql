-- ============================================
-- 积分系统验证脚本
-- ============================================
-- 用于验证积分字段是否正确配置

-- 1. 检查 users 表结构
SELECT
  '1. users 表结构检查' as check_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('credits', 'image_credits', 'video_credits')
ORDER BY ordinal_position;

-- 2. 检查索引是否存在
SELECT
  '2. 索引检查' as check_name,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexname LIKE '%credits%';

-- 3. 检查用户积分数据
SELECT
  '3. 用户积分数据' as check_name,
  COUNT(*) as total_users,
  COUNT(CASE WHEN credits > 0 THEN 1 END) as users_with_credits,
  COUNT(CASE WHEN image_credits > 0 THEN 1 END) as users_with_image_credits,
  COUNT(CASE WHEN video_credits > 0 THEN 1 END) as users_with_video_credits,
  SUM(credits) as total_credits,
  SUM(image_credits) as total_image_credits,
  SUM(video_credits) as total_video_credits,
  AVG(image_credits)::INTEGER as avg_image_credits
FROM users;

-- 4. 检查最近的积分变动（通过 payment_orders）
SELECT
  '4. 最近的充值记录' as check_name,
  po.order_no,
  po.user_id,
  u.email,
  po.order_type,
  po.credits_amount,
  po.credit_type,
  po.status,
  po.created_at,
  u.image_credits as current_image_credits
FROM payment_orders po
JOIN users u ON po.user_id = u.id
WHERE po.order_type = 'credits'
ORDER BY po.created_at DESC
LIMIT 10;

-- 5. 检查最近的图片生成记录
SELECT
  '5. 最近的图片生成记录' as check_name,
  ig.id,
  ig.user_id,
  u.email,
  ig.model,
  ig.cost_credits,
  ig.api_source,
  ig.status,
  ig.created_at,
  u.image_credits as current_image_credits
FROM image_generations ig
JOIN users u ON ig.user_id = u.id
ORDER BY ig.created_at DESC
LIMIT 10;

-- 6. 检查 credit_transactions 表是否有 credit_type 字段
SELECT
  '6. credit_transactions 表结构' as check_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'credit_transactions'
  AND column_name = 'credit_type';

-- 7. 检查 payment_orders 表是否有 credit_type 字段
SELECT
  '7. payment_orders 表结构' as check_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_orders'
  AND column_name = 'credit_type';

-- 8. 检查 image_generations 表是否有 api_source 字段
SELECT
  '8. image_generations 表结构' as check_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'image_generations'
  AND column_name = 'api_source';

-- 9. 统计各个来源的图片生成数量
SELECT
  '9. 图片生成来源统计' as check_name,
  COALESCE(api_source, 'unknown') as api_source,
  COUNT(*) as count,
  SUM(cost_credits) as total_credits_used
FROM image_generations
GROUP BY api_source
ORDER BY count DESC;

-- 10. 检查是否有积分为负数的用户（数据异常）
SELECT
  '10. 积分异常检查' as check_name,
  id,
  email,
  credits,
  image_credits,
  video_credits
FROM users
WHERE credits < 0 OR image_credits < 0 OR video_credits < 0;

-- 11. 显示总结信息
DO $$
DECLARE
  v_users_count INTEGER;
  v_total_image_credits INTEGER;
  v_has_credits_field BOOLEAN;
  v_has_image_credits_field BOOLEAN;
  v_has_credit_type_field BOOLEAN;
BEGIN
  -- 检查字段是否存在
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'credits'
  ) INTO v_has_credits_field;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'image_credits'
  ) INTO v_has_image_credits_field;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'credit_type'
  ) INTO v_has_credit_type_field;

  -- 统计数据
  SELECT COUNT(*), COALESCE(SUM(image_credits), 0)
  INTO v_users_count, v_total_image_credits
  FROM users;

  -- 输出结果
  RAISE NOTICE '========================================';
  RAISE NOTICE '积分系统验证结果';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'users.credits 字段: %', CASE WHEN v_has_credits_field THEN '✅ 存在' ELSE '❌ 不存在' END;
  RAISE NOTICE 'users.image_credits 字段: %', CASE WHEN v_has_image_credits_field THEN '✅ 存在' ELSE '❌ 不存在' END;
  RAISE NOTICE 'payment_orders.credit_type 字段: %', CASE WHEN v_has_credit_type_field THEN '✅ 存在' ELSE '❌ 不存在' END;
  RAISE NOTICE '总用户数: %', v_users_count;
  RAISE NOTICE '总图片积分: %', v_total_image_credits;
  RAISE NOTICE '========================================';

  IF v_has_image_credits_field THEN
    RAISE NOTICE '✅ 积分系统配置正确！';
  ELSE
    RAISE NOTICE '❌ 请执行迁移脚本: supabase-migration-add-credits-to-users.sql';
  END IF;
END $$;
