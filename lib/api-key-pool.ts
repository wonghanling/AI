// ============================================
// API Key 池管理系统
// 路径：lib/api-key-pool.ts
// ============================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// API 限流配置（根据各平台实际限制调整）
const RATE_LIMITS = {
  openai: {
    requestsPerMinute: 500,
    requestsPerDay: 10000,
  },
  anthropic: {
    requestsPerMinute: 50,
    requestsPerDay: 5000,
  },
  google: {
    requestsPerMinute: 60,
    requestsPerDay: 1500,
  },
  xai: {
    requestsPerMinute: 60,
    requestsPerDay: 5000,
  },
};

// ============================================
// 1. 获取可用的 API Key（智能轮询）
// ============================================
export async function getAvailableApiKey(provider: string): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 查询所有可用的 Key
  const { data: keys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('provider', provider)
    .in('status', ['active', 'rate_limited'])
    .order('last_used_at', { ascending: true, nullsFirst: true });

  if (!keys || keys.length === 0) {
    console.error(`没有可用的 ${provider} API Key`);
    return null;
  }

  // 过滤掉被限流的 Key
  const now = new Date();
  const availableKeys = keys.filter(key => {
    // 如果有限流重置时间，检查是否已过期
    if (key.rate_limit_reset_at) {
      const resetTime = new Date(key.rate_limit_reset_at);
      if (now < resetTime) {
        return false; // 还在限流中
      }
    }

    // 检查今日请求数是否超限
    const limit = RATE_LIMITS[provider]?.requestsPerDay || 10000;
    if (key.requests_today >= limit) {
      return false;
    }

    return true;
  });

  if (availableKeys.length === 0) {
    console.error(`所有 ${provider} API Key 都被限流`);
    return null;
  }

  // 选择使用次数最少的 Key（负载均衡）
  const selectedKey = availableKeys.reduce((prev, curr) =>
    (prev.requests_today < curr.requests_today) ? prev : curr
  );

  // 更新使用记录
  await supabase
    .from('api_keys')
    .update({
      last_used_at: now.toISOString(),
      requests_today: selectedKey.requests_today + 1,
      status: 'active', // 重置状态
    })
    .eq('id', selectedKey.id);

  return selectedKey.api_key;
}

// ============================================
// 2. 标记 Key 为限流状态
// ============================================
export async function markKeyAsRateLimited(
  apiKey: string,
  resetAfterMinutes: number = 60
) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const resetTime = new Date();
  resetTime.setMinutes(resetTime.getMinutes() + resetAfterMinutes);

  await supabase
    .from('api_keys')
    .update({
      status: 'rate_limited',
      rate_limit_reset_at: resetTime.toISOString(),
    })
    .eq('api_key', apiKey);

  console.log(`API Key 已标记为限流，重置时间: ${resetTime.toISOString()}`);
}

// ============================================
// 3. 重置每日请求计数（定时任务）
// ============================================
export async function resetDailyRequestCounts() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('api_keys')
    .update({
      requests_today: 0,
      status: 'active',
      rate_limit_reset_at: null,
    })
    .neq('status', 'disabled');

  if (error) {
    console.error('重置每日请求计数失败:', error);
  } else {
    console.log('每日请求计数已重置');
  }
}

// ============================================
// 4. 添加新的 API Key
// ============================================
export async function addApiKey(
  provider: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 检查是否已存在
  const { data: existing } = await supabase
    .from('api_keys')
    .select('id')
    .eq('api_key', apiKey)
    .single();

  if (existing) {
    return { success: false, error: 'API Key 已存在' };
  }

  // 插入新 Key
  const { error } = await supabase.from('api_keys').insert({
    provider,
    api_key: apiKey,
    status: 'active',
    requests_today: 0,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// 5. 禁用 API Key
// ============================================
export async function disableApiKey(apiKey: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  await supabase
    .from('api_keys')
    .update({ status: 'disabled' })
    .eq('api_key', apiKey);

  console.log(`API Key 已禁用: ${apiKey.slice(0, 10)}...`);
}

// ============================================
// 6. 获取 Key 池状态（管理后台用）
// ============================================
export async function getKeyPoolStatus(provider?: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let query = supabase
    .from('api_keys')
    .select('*')
    .order('provider')
    .order('requests_today', { ascending: false });

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data: keys } = await query;

  if (!keys) {
    return [];
  }

  // 统计信息
  const stats = keys.reduce((acc, key) => {
    if (!acc[key.provider]) {
      acc[key.provider] = {
        total: 0,
        active: 0,
        rateLimited: 0,
        disabled: 0,
        totalRequests: 0,
      };
    }

    acc[key.provider].total++;
    acc[key.provider].totalRequests += key.requests_today;

    if (key.status === 'active') acc[key.provider].active++;
    if (key.status === 'rate_limited') acc[key.provider].rateLimited++;
    if (key.status === 'disabled') acc[key.provider].disabled++;

    return acc;
  }, {} as Record<string, any>);

  return {
    keys,
    stats,
  };
}

// ============================================
// 7. 智能错误处理（根据错误类型自动处理）
// ============================================
export async function handleApiError(
  apiKey: string,
  error: any
): Promise<void> {
  const errorMessage = error?.message || error?.toString() || '';

  // OpenAI 限流错误
  if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
    await markKeyAsRateLimited(apiKey, 60); // 1小时后重试
    return;
  }

  // API Key 无效
  if (
    errorMessage.includes('Invalid API key') ||
    errorMessage.includes('401') ||
    errorMessage.includes('Unauthorized')
  ) {
    await disableApiKey(apiKey);
    console.error(`API Key 无效，已禁用: ${apiKey.slice(0, 10)}...`);
    return;
  }

  // 配额用尽
  if (
    errorMessage.includes('quota') ||
    errorMessage.includes('insufficient_quota')
  ) {
    await disableApiKey(apiKey);
    console.error(`API Key 配额用尽，已禁用: ${apiKey.slice(0, 10)}...`);
    return;
  }

  // 其他错误，暂时标记为限流
  console.warn(`API 调用失败，暂时限流: ${errorMessage}`);
  await markKeyAsRateLimited(apiKey, 10); // 10分钟后重试
}

// ============================================
// 8. 定时任务：每日重置（使用 Vercel Cron）
// ============================================
// 在 vercel.json 中配置：
// {
//   "crons": [{
//     "path": "/api/cron/reset-keys",
//     "schedule": "0 0 * * *"
//   }]
// }

// 路径：app/api/cron/reset-keys/route.ts
export async function GET_ResetKeys(req: Request) {
  // 验证 Cron Secret（防止被滥用）
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await resetDailyRequestCounts();

  return new Response('OK');
}
