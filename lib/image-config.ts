// ============================================
// 图片生成配置
// ============================================

export const IMAGE_CONFIG = {
  model: 'google/nano-banana-pro', // OpenRouter 模型名称
  basePrice: 0.9, // 基础价格 ¥0.9/张

  // 尺寸配置
  sizes: {
    '1024x1024': {
      label: '标准尺寸',
      description: '性价比最高',
      costUnits: 1, // 消耗 1 次生成额度
      price: 0.9,
    },
    '1536x1024': {
      label: '横图',
      description: '适合横屏展示',
      costUnits: 2,
      price: 1.8,
    },
    '1024x1536': {
      label: '竖图',
      description: '适合竖屏展示',
      costUnits: 2,
      price: 1.8,
    },
    '1536x1536': {
      label: '高清大图',
      description: '更高分辨率',
      costUnits: 2,
      price: 1.8,
    },
  },

  // 限制
  limits: {
    promptMaxLength: 500, // Prompt 最大长度
    rateLimitSeconds: 10, // 频率限制：10秒1次
    maxConcurrent: 1, // 同时只能1个任务
  },
} as const;

export type ImageSize = keyof typeof IMAGE_CONFIG.sizes;
