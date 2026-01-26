-- 分离图片积分和视频积分
-- 执行此脚本前请备份数据库！

-- 1. 添加新的积分字段
ALTER TABLE users
ADD COLUMN IF NOT EXISTS image_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_credits INTEGER DEFAULT 0;

-- 2. 将现有的 credits 迁移到 image_credits
UPDATE users
SET image_credits = COALESCE(credits, 0)
WHERE image_credits = 0;

-- 3. 可选：如果不再需要旧的 credits 字段，可以删除（建议先保留一段时间）
-- ALTER TABLE users DROP COLUMN credits;

-- 4. 为新字段添加注释
COMMENT ON COLUMN users.image_credits IS '图片生成积分余额';
COMMENT ON COLUMN users.video_credits IS '视频生成积分余额';

-- 5. 验证数据
SELECT
  id,
  email,
  credits as old_credits,
  image_credits,
  video_credits
FROM users
LIMIT 10;
