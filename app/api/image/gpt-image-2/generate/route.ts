import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { uploadToStorage } from '@/lib/storage-upload';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

// 尺寸配置：sizeKey -> fal image_size 参数
const SIZE_MAP: Record<string, { width: number; height: number } | string> = {
  'landscape_16_9_2k': { width: 2048, height: 1152 },  // 16:9 2K
  'landscape_16_9_4k': { width: 3840, height: 2160 },  // 16:9 4K
  'portrait_9_16_4k':  { width: 2160, height: 3840 },  // 9:16 4K
  'square_2k':         { width: 2048, height: 2048 },  // 1:1 2K
};

// 定价表：[quality][sizeKey] = 积分
const PRICING: Record<string, Record<string, number>> = {
  high: {
    'landscape_16_9_2k': 7,
    'landscape_16_9_4k': 20,
    'portrait_9_16_4k':  20,
    'square_2k':         10,
  },
  medium: {
    'landscape_16_9_2k': 7,
    'landscape_16_9_4k': 15,
    'portrait_9_16_4k':  15,
    'square_2k':         7,
  },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    const body = await req.json();
    const {
      prompt,
      images = [],       // base64 数组，0=文生图，1=单图编辑，多=多图融合
      quality = 'high',  // 'high' | 'medium'
      sizeKey = 'square_2k',
    } = body;

    if (!prompt) return NextResponse.json({ error: '请输入图片描述' }, { status: 400 });

    const imageSize = SIZE_MAP[sizeKey];
    if (!imageSize) return NextResponse.json({ error: '无效的尺寸选项' }, { status: 400 });

    const qualityPricing = PRICING[quality] ?? PRICING['high'];
    const cost = qualityPricing[sizeKey] ?? 10;

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
    let imageUrl: string;

    if (imageCount === 0) {
      // 文生图
      const result = await fal.subscribe('openai/gpt-image-2', {
        input: {
          prompt,
          image_size: imageSize,
          quality,
          output_format: 'jpeg',
        },
      });
      const img = (result.data as any)?.images?.[0];
      if (!img?.url) throw new Error('未能生成图片');
      imageUrl = img.url;
    } else {
      // 图生图（单图编辑 或 多图融合）
      const result = await fal.subscribe('openai/gpt-image-2/edit', {
        input: {
          prompt,
          image_urls: images,
          image_size: imageSize,
          quality,
          output_format: 'jpeg',
        },
      });
      const img = (result.data as any)?.images?.[0];
      if (!img?.url) throw new Error('未能生成图片');
      imageUrl = img.url;
    }

    // 上传到 Supabase Storage
    let permanentUrl = imageUrl;
    try {
      permanentUrl = await uploadToStorage(user.id, imageUrl, 'image');
    } catch {
      console.warn('上传 Storage 失败，使用原始 URL');
    }

    // 历史记录超 50 张则清空
    const { count: historyCount } = await supabaseAdmin
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (historyCount && historyCount >= 50) {
      await supabaseAdmin.from('image_generations').delete().eq('user_id', user.id);
    }

    const mode = imageCount === 0 ? 'text-to-image' : imageCount === 1 ? 'single-edit' : 'multi-edit';

    const { data: imageRecord } = await supabaseAdmin
      .from('image_generations')
      .insert({
        user_id: user.id,
        model: 'gpt-image-2',
        prompt,
        image_url: permanentUrl,
        size: `${quality}-${sizeKey}-${mode}`,
        cost_credits: cost,
        status: 'completed',
        api_source: 'gpt-image-2',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    const newCredits = Math.max(0, imageCredits - cost);
    await supabaseAdmin.from('users').update({ image_credits: newCredits }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      images: [{ url: permanentUrl, id: imageRecord?.id, prompt }],
      remainingBalance: newCredits,
      cost,
    });

  } catch (error: any) {
    console.error('GPT Image 2 生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
