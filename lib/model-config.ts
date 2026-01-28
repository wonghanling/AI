// ============================================
// 模型配置映射 - 云雾API
// ============================================

// 模型能力标签
export type ModelCapability = 'dialogue' | 'vision' | 'thinking' | 'search' | 'internet' | 'multimodal' | 'coding' | 'tools';

// 禁用的分组列表
export const BANNED_GROUPS = [
  '官转分组',
  '官转OpenAI分组',
  '优质官转OpenAI分组',
  '官转克劳德3分组',
  'official_Claude分组',
  '直连克劳德分组',
];

export const MODEL_MAP = {
  // 高级模型 - 免费用户每天3次，会员无限使用（月度1600次软限制）
  'gpt-5.2': {
    yunwuModel: 'gpt-5.2',
    displayName: 'GPT-5.2',
    description: '适用于各行各业的编码和智能任务的最佳模型',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision', 'coding'] as ModelCapability[],
    // 使用最便宜的可用分组价格估算（限时特价分组）
    costPer1kTokens: { prompt: 0.00105, completion: 0.0084 },
  },
  'gpt-5.1-2025-11-13': {
    yunwuModel: 'gpt-5.1-2025-11-13',
    displayName: 'GPT-5.1-2025-11-13',
    description: '更智能、更具对话性的聊天GPT，最常用的型号',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision'] as ModelCapability[],
    // 使用Codex专属分组价格
    costPer1kTokens: { prompt: 0.001, completion: 0.008 },
  },
  'gpt-5.1-thinking-all': {
    yunwuModel: 'gpt-5.1-thinking-all',
    displayName: 'GPT-5.1-thinking-all',
    description: '先进的推理模型，处理简单任务速度更快，处理复杂任务更持久',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision', 'internet', 'thinking'] as ModelCapability[],
    // 使用default分组价格
    costPer1kTokens: { prompt: 0.00125, completion: 0.01 },
  },
  'gemini-3-pro-preview': {
    yunwuModel: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro Preview',
    description: 'Gemini 3 是谷歌迄今为止最智能的模型系列，适合复杂的多模态任务',
    tier: 'advanced',
    maxTokens: 8192,
    capabilities: ['dialogue', 'thinking', 'multimodal'] as ModelCapability[],
    // 使用限时特价分组价格
    costPer1kTokens: { prompt: 0.0012, completion: 0.0072 },
  },
  'gemini-3-flash-preview': {
    yunwuModel: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    description: '最智能的模型，兼具速度和前沿智能，并具备出色的搜索和逻辑能力',
    tier: 'advanced',
    maxTokens: 8192,
    capabilities: ['dialogue', 'vision', 'tools'] as ModelCapability[],
    // 使用限时特价分组价格（非常便宜）
    costPer1kTokens: { prompt: 0.0003, completion: 0.0018 },
  },
  'gemini-2.5-flash-all': {
    yunwuModel: 'gemini-2.5-flash-all',
    displayName: 'Gemini 2.5 Flash All',
    description: '多模态版本的 gemini 模型，支持文件、视频、图片等分析，支持画图，支持实时联网',
    tier: 'advanced',
    maxTokens: 8192,
    capabilities: ['internet', 'multimodal', 'dialogue'] as ModelCapability[],
    // 使用逆向分组价格
    costPer1kTokens: { prompt: 0.00042, completion: 0.00336 },
  },
  'gemini-2.5-pro-all': {
    yunwuModel: 'gemini-2.5-pro-all',
    displayName: 'Gemini 2.5 Pro All',
    description: '多模态版本的 gemini 模型，支持文件、视频、图片等分析，支持画图，支持实时联网',
    tier: 'advanced',
    maxTokens: 8192,
    capabilities: ['internet', 'multimodal', 'dialogue'] as ModelCapability[],
    // 使用逆向分组价格
    costPer1kTokens: { prompt: 0.0035, completion: 0.028 },
  },
  'claude-3-5-haiku-20241022': {
    yunwuModel: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    description: 'Claude模型的最新版本，具有最先进的语言处理技术，支持200K上下文',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue'] as ModelCapability[],
    // 使用default分组价格
    costPer1kTokens: { prompt: 0.0008, completion: 0.004 },
  },
  'claude-3-sonnet-all': {
    yunwuModel: 'claude-3-sonnet-all',
    displayName: 'Claude 3 Sonnet All',
    description: 'Claude Sonnet 3 是由 anthropic 提供的人工智能模型',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision'] as ModelCapability[],
    // 使用default分组价格
    costPer1kTokens: { prompt: 0.003, completion: 0.0045 },
  },
  'grok-4.1': {
    yunwuModel: 'grok-4.1',
    displayName: 'Grok 4.1',
    description: 'Grok 4.1 在创造性、情感化和协作式交互方面表现卓越',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision', 'internet'] as ModelCapability[],
    // 使用default分组价格
    costPer1kTokens: { prompt: 0.002, completion: 0.01 },
  },
  'grok-4': {
    yunwuModel: 'grok-4',
    displayName: 'Grok 4',
    description: 'Grok 4 模型具备深度推理能力，xAI声称是全球最强 AI 模型',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue', 'vision'] as ModelCapability[],
    // 使用限时特价分组价格
    costPer1kTokens: { prompt: 0.0018, completion: 0.009 },
  },
  'gpt-5.1-chat': {
    yunwuModel: 'gpt-5.1-chat',
    displayName: 'GPT-5.1 Chat',
    description: 'GPT-5.1-chat 适用于自然语言交互和即时通讯场景的流畅对话与辅助创作的通用模型',
    tier: 'advanced',
    maxTokens: 4096,
    capabilities: ['dialogue'] as ModelCapability[],
    // 使用限时特价分组价格
    costPer1kTokens: { prompt: 0.00075, completion: 0.006 },
  },

  // 普通模型 - 待用户提供
  // 'claude-haiku': {
  //   yunwuModel: 'anthropic/claude-3-haiku',
  //   displayName: 'Claude 4.5 Haiku',
  //   tier: 'basic',
  //   maxTokens: 4096,
  //   capabilities: ['dialogue'] as ModelCapability[],
  //   costPer1kTokens: { prompt: 0.00025, completion: 0.00125 },
  // },
} as const;

export type ModelKey = keyof typeof MODEL_MAP;

// 降级策略：高级模型 -> 普通模型（待普通模型配置后更新）
export const FALLBACK_MAP: Record<string, ModelKey> = {
  // 'gpt-5.2': 'gpt-4.1-mini',
  // 'claude-3-5-haiku-20241022': 'claude-haiku',
  // 'gemini-3-pro-preview': 'gemini-flash',
  // 'grok-4': 'gemini-flash',
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
