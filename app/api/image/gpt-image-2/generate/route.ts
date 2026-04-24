import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

// 尺寸配置
const SIZE_MAP: Record<string, { width: number; height: number }> = {
  'landscape_16_9_2k': { width: 2048, height: 1152 },
  'landscape_16_9_4k': { width: 3840, height: 2160 },
  'portrait_9_16_4k':  { width: 2160, height: 3840 },
  'square_2k':         { width: 2048, height: 2048 },
};

// 定价表
const PRICING: Record<string, Record<string, number>> = {
  high:   { 'landscape_16_9_2k': 7, 'landscape_16_9_4k': 20, 'portrait_9_16_4k': 20, 'square_2k': 10 },
  medium: { 'landscape_16_9_2k': 7, 'landscape_16_9_4k': 15, 'portrait_9_16_4k': 15, 'square_2k': 7  },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    const body = await req.json();
    const { prompt, images = [], quality = 'high', sizeKey = 'square_2k' } = body;

    if (!prompt) return NextResponse.json({ error: '请输入图片描述' }, { status: 400 });

    const imageSize = SIZE_MAP[sizeKey];
    if (!imageSize) return NextResponse.json({ error: '无效的尺寸选项' }, { status: 400 });

    const cost = PRICING[quality]?.[sizeKey] ?? 10;

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('image_credits')
      .eq('id', user.id)
      .single();

    const imageCredits = userData?.image_credits || 0;
    if (imageCredits < cost) {
      return NextResponse.json(
        { error: `积分不足，需要 ${cost} 积分，当前仅有 ${imageCredits} 积分` },
        { status: 403 }
      );
    }

    const imageCount = images.length;
    const endpoint = imageCount === 0 ? 'openai/gpt-image-2' : 'openai/gpt-image-2/edit';
    const mode = imageCount === 0 ? 'text-to-image' : imageCount === 1 ? 'single-edit' : 'multi-edit';

    const input = imageCount === 0
      ? { prompt, image_size: imageSize, quality, output_format: 'jpeg' }
      : { prompt, image_urls: images, image_size: imageSize, quality, output_format: 'jpeg' };

    // 异步提交队列，不等待结果（避免 Vercel 60s 超时）
    const { request_id } = await fal.queue.submit(endpoint, { input });

    // 先扣积分
    const newCredits = Math.max(0, imageCredits - cost);
    await supabaseAdmin.from('users').update({ image_credits: newCredits }).eq('id', user.id);

    // 历史记录超 50 张则清空
    const { count: historyCount } = await supabaseAdmin
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (historyCount && historyCount >= 50) {
      await supabaseAdmin.from('image_generations').delete().eq('user_id', user.id);
    }

    // 先插入 pending 记录，等轮询完成后更新 image_url
    const { data: imageRecord } = await supabaseAdmin
      .from('image_generations')
      .insert({
        user_id: user.id,
        model: 'gpt-image-2',
        prompt,
        image_url: '',
        size: `${quality}-${sizeKey}-${mode}`,
        cost_credits: cost,
        status: 'pending',
        api_source: 'gpt-image-2',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      requestId: request_id,
      recordId: imageRecord?.id,
      endpoint,
      remainingBalance: newCredits,
      cost,
    });

  } catch (error: any) {
    console.error('GPT Image 2 提交错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
