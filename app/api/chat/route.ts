import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODEL_MAP, ModelKey, FALLBACK_MAP, BANNED_GROUPS } from '@/lib/model-config';

// 初始化 Supabase 客户端（使用 service role key 以绕过 RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 云雾 API 配置
const YUNWU_BASE_URL = 'https://allapi.store';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

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
        // 暂时注释掉普通模型检查，等待普通模型配置完成后启用
        // if (modelConfig.tier === 'basic' && usedCount >= 10) {
        //   return NextResponse.json({ error: '今日普通模型配额已用完，请明天再试' }, { status: 403 });
        // }
      }

      // 8. 调用云雾 API（带降级重试）
      let usedModelKey: ModelKey = model_key; // 使用的模型 key
      let usedModel = modelConfig.yunwuModel;
      let response;
      let tokensUsed = 0;

      try {
        // 调用云雾 API
        response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${YUNWU_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelConfig.yunwuModel,
            messages: messages,
            stream: stream,
            max_tokens: modelConfig.maxTokens,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`云雾 API 错误: ${response.status} - ${errorText}`);
        }
      } catch (error: any) {
        // 降级重试
        const fallbackKey = FALLBACK_MAP[model_key];
        if (fallbackKey) {
          const fallbackConfig = MODEL_MAP[fallbackKey];
          usedModelKey = fallbackKey; // 更新为降级后的模型 key
          usedModel = fallbackConfig.yunwuModel;

          response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${YUNWU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: fallbackConfig.yunwuModel,
              messages: messages,
              stream: stream,
              max_tokens: fallbackConfig.maxTokens,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`云雾 API 降级调用错误: ${response.status} - ${errorText}`);
          }
        } else {
          throw error;
        }
      }

      // 记录使用统计
      const recordUsage = async (promptTokens: number, completionTokens: number) => {
        const usedConfig = MODEL_MAP[usedModelKey];
        const cost = (promptTokens / 1000) * usedConfig.costPer1kTokens.prompt +
                     (completionTokens / 1000) * usedConfig.costPer1kTokens.completion;

        await supabaseAdmin.from('usage_stats').insert({
          user_id: user.id,
          model_name: usedConfig.displayName,
          model_tier: usedConfig.tier,
          tokens_used: promptTokens + completionTokens,
          cost_usd: cost,
          date: new Date().toISOString().split('T')[0],
          month: new Date().toISOString().slice(0, 7),
        });
      };

      // 9. 返回流式响应
      if (stream) {
        const encoder = new TextEncoder();
        let promptTokens = 0;
        let completionTokens = 0;

        // 估算 prompt tokens
        const promptText = messages.map((m: any) => m.content).join(' ');
        promptTokens = Math.ceil(promptText.length / 4);

        const readable = new ReadableStream({
          async start(controller) {
            try {
              const reader = response.body?.getReader();
              const decoder = new TextDecoder();

              if (!reader) {
                throw new Error('无法读取响应流');
              }

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);
                      const text = parsed.choices?.[0]?.delta?.content || '';

                      if (text) {
                        completionTokens += Math.ceil(text.length / 4); // 粗略估算 tokens
                        // 发送内容
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'content',
                          data: text
                        })}\n\n`));
                      }
                    } catch (e) {
                      // 忽略解析错误
                    }
                  }
                }
              }

              // 记录使用统计
              await recordUsage(promptTokens, completionTokens);

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
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage = data.usage;

        const promptTokens = usage?.prompt_tokens || Math.ceil(messages.map((m: any) => m.content).join(' ').length / 4);
        const completionTokens = usage?.completion_tokens || Math.ceil(content.length / 4);

        // 记录使用统计
        await recordUsage(promptTokens, completionTokens);

        return NextResponse.json({
          content: content,
          used_model: usedModelKey,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
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
