// ============================================
// 模型配置映射
// ============================================

export const MODEL_MAP = {
  // 高级模型
  'gpt-5.2': {
    openrouterModel: 'openai/gpt-4o',
    displayName: 'GPT-5.2',
    tier: 'advanced',
    maxTokens: 4096,
    costPer1kTokens: 0.005,
  },
  'claude-sonnet-4': {
    openrouterModel: 'anthropic/claude-3.5-sonnet',
    displayName: 'Claude Sonnet 4',
    tier: 'advanced',
    maxTokens: 4096,
    costPer1kTokens: 0.003,
  },
  'gemini-pro': {
    openrouterModel: 'google/gemini-pro-1.5',
    displayName: 'Gemini Pro',
    tier: 'advanced',
    maxTokens: 8192,
    costPer1kTokens: 0.00125,
  },
  'grok': {
    openrouterModel: 'x-ai/grok-beta',
    displayName: 'Grok',
    tier: 'advanced',
    maxTokens: 4096,
    costPer1kTokens: 0.002,
  },

  // 普通模型
  'claude-haiku': {
    openrouterModel: 'anthropic/claude-3-haiku',
    displayName: 'Claude 4.5 Haiku',
    tier: 'basic',
    maxTokens: 4096,
    costPer1kTokens: 0.00025,
  },
  'gemini-flash': {
    openrouterModel: 'google/gemini-flash-1.5',
    displayName: 'Gemini 3 Flash',
    tier: 'basic',
    maxTokens: 8192,
    costPer1kTokens: 0.000075,
  },
  'gpt-4.1-mini': {
    openrouterModel: 'openai/gpt-4o-mini',
    displayName: 'GPT-4.1 Mini',
    tier: 'basic',
    maxTokens: 4096,
    costPer1kTokens: 0.00015,
  },
} as const;

export type ModelKey = keyof typeof MODEL_MAP;

// 降级策略：高级模型 -> 普通模型
export const FALLBACK_MAP: Record<string, ModelKey> = {
  'gpt-5.2': 'gpt-4.1-mini',
  'claude-sonnet-4': 'claude-haiku',
  'gemini-pro': 'gemini-flash',
  'grok': 'gemini-flash',
};

// 配额限制
export const QUOTA_LIMITS = {
  free: {
    advanced_daily: 3,  // 高级模型每日 3 次
    basic_daily: 10,    // 普通模型每日 10 次
  },
  premium: {
    perMinute: 10,      // 每分钟 10 次
    perHour: 100,       // 每小时 100 次
    monthlyMax: 1600,   // 月度软阈值
  },
};

// 成本熔断阈值（美元）
export const COST_CIRCUIT_BREAKER = 12; // 约 ¥80-100
