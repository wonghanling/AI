// ============================================
// 图片生成模型配置（双模型 + 积分系统）
// ============================================

// 宽高比配置
export const ASPECT_RATIOS = {
  '1:1': { width: 1, height: 1, label: '1:1 正方形' },
  '4:3': { width: 4, height: 3, label: '4:3 横图' },
  '3:4': { width: 3, height: 4, label: '3:4 竖图' },
  '16:9': { width: 16, height: 9, label: '16:9 宽屏' },
  '9:16': { width: 9, height: 16, label: '9:16 竖屏' },
  '3:2': { width: 3, height: 2, label: '3:2 横图' },
  '2:3': { width: 2, height: 3, label: '2:3 竖图' },
  '21:9': { width: 21, height: 9, label: '21:9 超宽' },
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;

// 计算实际像素尺寸
export function calculateSize(aspectRatio: AspectRatio, resolution: number): string {
  const ratio = ASPECT_RATIOS[aspectRatio];

  // 计算宽高，使较长边等于 resolution
  const isWider = ratio.width > ratio.height;

  if (isWider) {
    const width = resolution;
    const height = Math.round((resolution * ratio.height) / ratio.width);
    return `${width}x${height}`;
  } else {
    const height = resolution;
    const width = Math.round((resolution * ratio.width) / ratio.height);
    return `${width}x${height}`;
  }
}

// 模型配置
// OpenRouter 支持的 Nano Banana 图片生成模型
export const IMAGE_MODELS = {
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana',
    displayName: 'Nano Banana',
    // OpenRouter 模型：Google Gemini 2.5 Flash Image (Nano Banana)
    openrouterModel: 'google/gemini-2.5-flash-image',
    isPro: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'] as AspectRatio[],
    resolutions: {
      '1K': {
        label: '1K (1024px)',
        size: 1024,
        credits: 5,  // 5 积分 = ¥0.5
        price: 0.5
      },
      '2K': {
        label: '2K (2048px)',
        size: 2048,
        credits: 9,  // 9 积分 = ¥0.9
        price: 0.9
      },
    }
  },
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    displayName: 'Nano Banana Pro',
    // OpenRouter 模型：Google Nano Banana Pro (Gemini 3 Pro Image)
    openrouterModel: 'google/gemini-3-pro-image',
    isPro: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'] as AspectRatio[],
    resolutions: {
      '1K': {
        label: '1K (1024px)',
        size: 1024,
        credits: 9,   // 9 积分 = ¥0.9
        price: 0.9
      },
      '2K': {
        label: '2K (2048px)',
        size: 2048,
        credits: 15,  // 15 积分 = ¥1.5
        price: 1.5
      },
      '4K': {
        label: '4K (4096px)',
        size: 4096,
        credits: 25,  // 25 积分 = ¥2.5
        price: 2.5
      },
    }
  }
} as const;

export type ModelKey = keyof typeof IMAGE_MODELS;
export type ResolutionKey = '1K' | '2K' | '4K';

// 生成数量选项
export const IMAGE_COUNTS = [
  { value: 1, label: '1x', cooldown: 10 },
  { value: 2, label: '2x', cooldown: 20 },
  { value: 4, label: '4x', cooldown: 30 },
];

// 限制配置
export const IMAGE_LIMITS = {
  promptMaxLength: 500,      // Prompt 最大长度
  rateLimitSeconds: 10,      // 基础频率限制：10秒
  maxConcurrent: 1,          // 同时只能1个任务
  maxHistoryPerUser: 200,    // 每个用户最多保留 200 张历史
};

// 积分系统
export const CREDIT_SYSTEM = {
  creditsPerRMB: 10,         // 1 元 = 10 积分
  rechargeOptions: [
    { rmb: 10, credits: 100, bonus: 0 },
    { rmb: 30, credits: 300, bonus: 0 },
    { rmb: 50, credits: 520, bonus: 20 },
    { rmb: 100, credits: 1100, bonus: 100 },
  ],
};

// 获取模型信息
export function getModelInfo(modelKey: ModelKey) {
  return IMAGE_MODELS[modelKey];
}

// 计算总积分消耗
export function calculateTotalCredits(
  modelKey: ModelKey,
  resolution: ResolutionKey,
  count: number
): number {
  const model = IMAGE_MODELS[modelKey];
  const resolutionConfig = model.resolutions[resolution];
  return resolutionConfig.credits * count;
}

// 计算冷却时间
export function calculateCooldown(count: number): number {
  const option = IMAGE_COUNTS.find(opt => opt.value === count);
  return option?.cooldown || 10;
}
