import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODEL_MAP, ModelKey, FALLBACK_MAP } from '@/lib/model-config';
import OpenAI from 'openai';

// 初始化 Supabase 客户端（使用 service role key 以绕过 RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 初始化 OpenRouter 客户端
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://boluoing.com',
    'X-Title': 'BoLuoing AI',
  },
});

// 频率限制 Map（内存存储，生产环境应使用 Redis）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// 并发控制 Map
const concurrentMap = new Map<string, boolean>();

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await req.json();
    const { model_key, messages, stream = true } = body;

    if (!model_key || !messages) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证 model_key（不接受真实模型 ID）
    if (!(model_key in MODEL_MAP)) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    const modelConfig = MODEL_MAP[model_key as ModelKey];

    // 4. 检查并发限制（同一用户同时只能有 1 个请求）
    if (concurrentMap.get(user.id)) {
      return NextResponse.json({ error: '请等待当前请求完成' }, { status: 429 });
    }
    concurrentMap.set(user.id, true);

    try {
      // 5. 检查频率限制
      const now = Date.now();
      const rateLimitKey = `${user.id}:${modelConfig.tier}`;
      const rateLimit = rateLimitMap.get(rateLimitKey);

      if (rateLimit && rateLimit.resetAt > now) {
        if (rateLimit.count >= 10) {
          return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
        }
        rateLimit.count++;
      } else {
        rateLimitMap.set(rateLimitKey, { count: 1, resetAt: now + 10000 }); // 10 秒窗口
      }

      // 6. 获取用户信息和订阅状态
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .single();

      const userType = userData?.user_type || 'free';

      // 7. 检查今日配额
      const today = new Date().toISOString().split('T')[0];
      const { data: todayUsage, count } = await supabaseAdmin
        .from('usage_stats')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('model_tier', modelConfig.tier)
        .eq('date', today);

      const usedCount = count || 0;

      // 检查配额限制
      if (userType === 'free') {
        if (modelConfig.tier === 'advanced' && usedCount >= 3) {
          return NextResponse.json({ error: '今日高级模型配额已用完，请升级到专业版' }, { status: 403 });
        }
        if (modelConfig.tier === 'basic' && usedCount >= 10) {
          return NextResponse.json({ error: '今日普通模型配额已用完，请明天再试' }, { status: 403 });
        }
      }

      // 8. 调用 OpenRouter（带降级重试）
      let usedModelKey = model_key; // 使用的模型 key
      let usedModel = modelConfig.openrouterModel;
      let response;
      let tokensUsed = 0;

      try {
        response = await openrouter.chat.completions.create({
          model: modelConfig.openrouterModel,
          messages: messages,
          stream: stream,
          max_tokens: modelConfig.maxTokens,
        });
      } catch (error: any) {
        // 降级重试
        const fallbackKey = FALLBACK_MAP[model_key];
        if (fallbackKey) {
          const fallbackConfig = MODEL_MAP[fallbackKey];
          usedModelKey = fallbackKey; // 更新为降级后的模型 key
          usedModel = fallbackConfig.openrouterModel;
          response = await openrouter.chat.completions.create({
            model: fallbackConfig.openrouterModel,
            messages: messages,
            stream: stream,
            max_tokens: fallbackConfig.maxTokens,
          });
        } else {
          throw error;
        }
      }

      // 记录使用统计
      const recordUsage = async (tokens: number) => {
        const cost = (tokens / 1000) * modelConfig.costPer1kTokens;
        await supabaseAdmin.from('usage_stats').insert({
          user_id: user.id,
          model_name: modelConfig.displayName,
          model_tier: modelConfig.tier,
          tokens_used: tokens,
          cost_usd: cost,
          date: new Date().toISOString().split('T')[0],
          month: new Date().toISOString().slice(0, 7),
        });
      };

      // 9. 返回流式响应
      if (stream) {
        const encoder = new TextEncoder();
        let totalTokens = 0;

        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response as any) {
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) {
                  totalTokens += Math.ceil(text.length / 4); // 粗略估算 tokens
                  // 发送内容
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'content',
                    data: text
                  })}\n\n`));
                }
              }

              // 记录使用统计
              await recordUsage(totalTokens);

              // 发送元数据
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'metadata',
                data: {
                  used_model: usedModelKey,
                  display_name: MODEL_MAP[usedModelKey].displayName,
                  fallback: usedModelKey !== model_key,
                }
              })}\n\n`));

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // 非流式响应
        const completion = response as OpenAI.Chat.Completions.ChatCompletion;
        const tokens = completion.usage?.total_tokens || 0;

        // 记录使用统计
        await recordUsage(tokens);

        return NextResponse.json({
          content: completion.choices[0]?.message?.content || '',
          used_model: usedModelKey,
          usage: completion.usage,
        });
      }
    } finally {
      // 释放并发锁
      concurrentMap.delete(user.id);
    }
  } catch (error: any) {
    console.error('Chat API error:', error);
    concurrentMap.delete(req.headers.get('authorization')?.replace('Bearer ', '') || '');
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
