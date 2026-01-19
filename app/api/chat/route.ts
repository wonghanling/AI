// ============================================
// Chat API 接口 - OpenRouter 版本
// 路径：app/api/chat/route.ts
// ============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { MODEL_MAP, FALLBACK_MAP, QUOTA_LIMITS, COST_CIRCUIT_BREAKER, ModelKey } from '@/lib/model-config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// 主处理函数
// ============================================
export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求
    const { messages, model_key } = await req.json();

    if (!model_key || !MODEL_MAP[model_key as ModelKey]) {
      return new Response(
        JSON.stringify({ error: '无效的模型' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // 3. 获取用户信息
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    const isPremium = userData?.user_type === 'premium';

    // 4. 检查配额并自动降级
    const { allowed, finalModel, reason } = await checkQuotaWithFallback(
      supabaseAdmin,
      user.id,
      model_key as ModelKey,
      isPremium
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: reason }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. 检查成本熔断
    if (isPremium) {
      const monthlyCost = await getMonthlyCost(supabaseAdmin, user.id);
      if (monthlyCost >= COST_CIRCUIT_BREAKER) {
        return new Response(
          JSON.stringify({
            error: '本月成本已达上限，请下月再试',
            monthlyCost: monthlyCost.toFixed(2),
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. 获取模型配置
    const modelConfig = MODEL_MAP[finalModel];

    // 7. 初始化 OpenRouter 客户端
    const openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // 8. 调用 OpenRouter API（流式输出）
    const stream = await openrouter.chat.completions.create({
      model: modelConfig.openrouterModel,
      messages: messages,
      max_tokens: modelConfig.maxTokens,
      stream: true,
    });

    // 8. 记录使用情况（异步）
    recordUsage(supabaseAdmin, user.id, finalModel, modelConfig).catch(console.error);

    // 9. 构建响应流
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 先发送元数据
          const metadata = {
            used_model: finalModel,
            display_name: modelConfig.displayName,
            tier: modelConfig.tier,
            max_tokens: modelConfig.maxTokens,
            fallback: finalModel !== model_key,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));

          // 流式输出内容
          let totalTokens = 0;
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`));
              totalTokens += content.length / 4; // 粗略估算 token 数
            }
          }

          // 发送使用统计
          const usage = {
            tokens: Math.ceil(totalTokens),
            cost: (totalTokens / 1000) * modelConfig.costPer1kTokens,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'usage', data: usage })}\n\n`));

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================
// 配额检查 + 自动降级
// ============================================
async function checkQuotaWithFallback(
  supabase: any,
  userId: string,
  requestedModel: ModelKey,
  isPremium: boolean
): Promise<{ allowed: boolean; finalModel: ModelKey; reason?: string }> {
  const modelConfig = MODEL_MAP[requestedModel];
  const tier = modelConfig.tier;

  if (!isPremium) {
    // 免费用户：检查每日配额
    const today = new Date().toISOString().split('T')[0];
    const quotaKey = tier === 'advanced' ? 'advanced_daily' : 'basic_daily';

    const { data } = await supabase
      .from('usage_stats')
      .select('id')
      .eq('user_id', userId)
      .eq('model_tier', tier)
      .eq('date', today);

    const usedToday = data?.length || 0;
    const limit = QUOTA_LIMITS.free[quotaKey];

    if (usedToday >= limit) {
      // 尝试降级
      if (tier === 'advanced' && FALLBACK_MAP[requestedModel]) {
        const fallbackModel = FALLBACK_MAP[requestedModel];
        const fallbackCheck = await checkQuotaWithFallback(supabase, userId, fallbackModel, isPremium);
        if (fallbackCheck.allowed) {
          return {
            allowed: true,
            finalModel: fallbackCheck.finalModel,
          };
        }
      }

      return {
        allowed: false,
        finalModel: requestedModel,
        reason: `今日${tier === 'advanced' ? '高级' : '普通'}模型配额已用完（${limit}次）`,
      };
    }
  } else {
    // 付费用户：检查速率限制
    const now = new Date();

    // 检查每分钟限制
    const { data: minuteData } = await supabase
      .from('rate_limits')
      .select('count, window_start')
      .eq('user_id', userId)
      .eq('limit_key', 'minute')
      .single();

    if (minuteData) {
      const windowStart = new Date(minuteData.window_start);
      const elapsed = (now.getTime() - windowStart.getTime()) / 1000;

      if (elapsed < 60 && minuteData.count >= QUOTA_LIMITS.premium.perMinute) {
        return {
          allowed: false,
          finalModel: requestedModel,
          reason: `请求过于频繁，请等待 ${Math.ceil(60 - elapsed)} 秒`,
        };
      }
    }

    // 检查每小时限制
    const { data: hourData } = await supabase
      .from('rate_limits')
      .select('count, window_start')
      .eq('user_id', userId)
      .eq('limit_key', 'hour')
      .single();

    if (hourData) {
      const windowStart = new Date(hourData.window_start);
      const elapsed = (now.getTime() - windowStart.getTime()) / 1000 / 60;

      if (elapsed < 60 && hourData.count >= QUOTA_LIMITS.premium.perHour) {
        return {
          allowed: false,
          finalModel: requestedModel,
          reason: `每小时请求次数已达上限（${QUOTA_LIMITS.premium.perHour}次）`,
        };
      }
    }

    // 检查月度软阈值
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: monthlyData } = await supabase
      .from('usage_stats')
      .select('id')
      .eq('user_id', userId)
      .eq('month', currentMonth);

    const usedThisMonth = monthlyData?.length || 0;

    if (usedThisMonth >= QUOTA_LIMITS.premium.monthlyMax) {
      return {
        allowed: false,
        finalModel: requestedModel,
        reason: `本月请求次数已达上限（${QUOTA_LIMITS.premium.monthlyMax}次）`,
      };
    }

    // 更新速率限制计数
    await updateRateLimit(supabase, userId, 'minute', 60);
    await updateRateLimit(supabase, userId, 'hour', 3600);
  }

  return { allowed: true, finalModel: requestedModel };
}

// ============================================
// 更新速率限制
// ============================================
async function updateRateLimit(
  supabase: any,
  userId: string,
  limitKey: string,
  windowSeconds: number
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('limit_key', limitKey)
    .single();

  if (existing) {
    const windowStart = new Date(existing.window_start);
    const elapsed = (now.getTime() - windowStart.getTime()) / 1000;

    if (elapsed < windowSeconds) {
      await supabase
        .from('rate_limits')
        .update({ count: existing.count + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('rate_limits')
        .update({
          count: 1,
          window_start: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', existing.id);
    }
  } else {
    await supabase.from('rate_limits').insert({
      user_id: userId,
      limit_key: limitKey,
      count: 1,
      window_start: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  }
}

// ============================================
// 获取月度成本
// ============================================
async function getMonthlyCost(supabase: any, userId: string): Promise<number> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data } = await supabase
    .from('usage_stats')
    .select('cost_usd')
    .eq('user_id', userId)
    .eq('month', currentMonth);

  return data?.reduce((sum: number, row: any) => sum + parseFloat(row.cost_usd), 0) || 0;
}

// ============================================
// 记录使用情况
// ============================================
async function recordUsage(
  supabase: any,
  userId: string,
  modelKey: ModelKey,
  modelConfig: typeof MODEL_MAP[ModelKey]
) {
  const now = new Date();

  await supabase.from('usage_stats').insert({
    user_id: userId,
    model_name: modelKey,
    model_tier: modelConfig.tier,
    tokens_used: 0, // 会在流结束后更新
    cost_usd: 0,
    date: now.toISOString().split('T')[0],
    month: now.toISOString().slice(0, 7),
  });
}
