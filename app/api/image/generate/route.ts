// ============================================
// 图片生成 API（新版 - 支持双模型 + 积分系统）
// 路径：app/api/image/generate/route.ts
// ============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import {
  IMAGE_MODELS,
  IMAGE_LIMITS,
  ModelKey,
  ResolutionKey,
  AspectRatio,
  calculateSize,
  calculateTotalCredits,
  calculateCooldown,
} from '@/lib/image-models';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

// OpenRouter 客户端
const openrouter = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求
    const {
      prompt,
      model = 'nano-banana-pro',
      aspectRatio = '1:1',
      resolution = '2K',
      count = 1,
    } = await req.json();

    // 验证参数
    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt 不能为空' }, { status: 400 });
    }

    if (prompt.length > IMAGE_LIMITS.promptMaxLength) {
      return Response.json(
        { error: `Prompt 长度不能超过 ${IMAGE_LIMITS.promptMaxLength} 字` },
        { status: 400 }
      );
    }

    if (!IMAGE_MODELS[model as ModelKey]) {
      return Response.json({ error: '无效的模型' }, { status: 400 });
    }

    const modelConfig = IMAGE_MODELS[model as ModelKey];

    if (!modelConfig.aspectRatios.includes(aspectRatio as AspectRatio)) {
      return Response.json({ error: '该模型不支持此宽高比' }, { status: 400 });
    }

    if (!modelConfig.resolutions[resolution as ResolutionKey]) {
      return Response.json({ error: '该模型不支持此分辨率' }, { status: 400 });
    }

    if (![1, 2, 4].includes(count)) {
      return Response.json({ error: '生成数量只能是 1, 2 或 4' }, { status: 400 });
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. 检查频率限制（根据生成数量动态调整）
    const cooldownSeconds = calculateCooldown(count);

    const { data: recentGeneration } = await supabaseAdmin
      .from('image_generations')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentGeneration) {
      const lastTime = new Date(recentGeneration.created_at).getTime();
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;

      if (elapsed < cooldownSeconds) {
        return Response.json(
          {
            error: `请求过于频繁，请等待 ${Math.ceil(cooldownSeconds - elapsed)} 秒`,
            cooldown: Math.ceil(cooldownSeconds - elapsed),
          },
          { status: 429 }
        );
      }
    }

    // 4. 检查并发限制
    const { data: runningTasks } = await supabaseAdmin
      .from('image_generations')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'generating');

    if (runningTasks && runningTasks.length >= IMAGE_LIMITS.maxConcurrent) {
      return Response.json(
        { error: '您有正在生成的图片，请等待完成后再试' },
        { status: 429 }
      );
    }

    // 5. 计算消耗积分
    const totalCredits = calculateTotalCredits(model as ModelKey, resolution as ResolutionKey, count);

    // 6. 检查用户积分余额
    let { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    // 如果用户没有积分记录，自动创建
    if (!credits) {
      const { data: newCredits } = await supabaseAdmin
        .from('user_credits')
        .insert({ user_id: user.id, balance: 0 })
        .select()
        .single();
      credits = newCredits;
    }

    const currentBalance = credits?.balance || 0;

    if (currentBalance < totalCredits) {
      return Response.json(
        {
          error: '积分不足',
          required: totalCredits,
          current: currentBalance,
        },
        { status: 402 }
      );
    }

    // 7. 先扣除积分（请求提交即消耗）
    const { error: deductError } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: currentBalance - totalCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (deductError) {
      console.error('扣除积分失败:', deductError);
      return Response.json({ error: '扣除积分失败' }, { status: 500 });
    }

    // 8. 记录积分流水
    await supabaseAdmin.from('credit_transactions').insert({
      user_id: user.id,
      change: -totalCredits,
      reason: `image_${model}_${resolution}_${count}x`,
      balance_after: currentBalance - totalCredits,
    });

    // 9. 计算实际像素尺寸
    const resolutionSize = modelConfig.resolutions[resolution as ResolutionKey].size;
    const actualSize = calculateSize(aspectRatio as AspectRatio, resolutionSize);

    // 10. 调用 OpenRouter 生成图片（循环生成多张）
    const generatedImages: string[] = [];
    const failedCount = 0;

    try {
      for (let i = 0; i < count; i++) {
        // 创建生成记录
        const { data: generation, error: insertError } = await supabaseAdmin
          .from('image_generations')
          .insert({
            user_id: user.id,
            prompt,
            model,
            aspect_ratio: aspectRatio,
            resolution,
            size: actualSize,
            cost_credits: totalCredits / count, // 单张消耗
            status: 'generating',
          })
          .select()
          .single();

        if (insertError) {
          console.error('创建记录失败:', insertError);
          continue;
        }

        try {
          // 调用 OpenRouter API
          const response = await openrouter.images.generate({
            model: modelConfig.openrouterModel,
            prompt: prompt,
            n: 1,
            size: actualSize as any,
          });

          const imageUrl = response.data[0]?.url;

          if (!imageUrl) {
            throw new Error('未返回图片 URL');
          }

          // 更新记录为成功
          await supabaseAdmin
            .from('image_generations')
            .update({
              status: 'completed',
              image_url: imageUrl,
            })
            .eq('id', generation.id);

          generatedImages.push(imageUrl);
        } catch (error: any) {
          console.error(`图片 ${i + 1} 生成失败:`, error);

          // 更新记录为失败
          await supabaseAdmin
            .from('image_generations')
            .update({
              status: 'failed',
              error_message: error.message,
            })
            .eq('id', generation.id);
        }
      }

      // 11. 检查用户历史记录数量，超过 200 张则删除最旧的
      const { count: totalCount } = await supabaseAdmin
        .from('image_generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (totalCount && totalCount > IMAGE_LIMITS.maxHistoryPerUser) {
        const deleteCount = totalCount - IMAGE_LIMITS.maxHistoryPerUser;
        const { data: oldestImages } = await supabaseAdmin
          .from('image_generations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: true })
          .limit(deleteCount);

        if (oldestImages && oldestImages.length > 0) {
          const idsToDelete = oldestImages.map(img => img.id);
          await supabaseAdmin
            .from('image_generations')
            .delete()
            .in('id', idsToDelete);

          console.log(`用户 ${user.id} 超过 ${IMAGE_LIMITS.maxHistoryPerUser} 张限制，已删除 ${deleteCount} 张最旧的记录`);
        }
      }

      // 12. 返回结果
      if (generatedImages.length === 0) {
        return Response.json(
          {
            error: '所有图片生成失败',
            note: '积分已消耗（请求已提交）',
          },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        images: generatedImages,
        generated: generatedImages.length,
        failed: count - generatedImages.length,
        totalCredits,
        remainingBalance: currentBalance - totalCredits,
        cooldown: cooldownSeconds,
      });

    } catch (error: any) {
      console.error('图片生成失败:', error);

      return Response.json(
        {
          error: '图片生成失败',
          message: error.message,
          note: '积分已消耗（请求已提交）',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('图片生成 API 错误:', error);
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
