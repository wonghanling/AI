import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

const FAL_IMAGE_MODELS: Record<string, {
  endpoint: string;
  cost: number;
  requiresImage?: boolean;
}> = {
  'flux-kontext-max': {
    endpoint: 'fal-ai/flux-pro/kontext/max/text-to-image',
    cost: 10,
  },
  'flux-kontext': {
    endpoint: 'fal-ai/flux-pro/kontext',
    cost: 6,
    requiresImage: true,
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
    const { model, prompt, aspectRatio = '1:1', imageBase64 } = body;

    if (!model || !prompt) return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });

    const modelConfig = FAL_IMAGE_MODELS[model];
    if (!modelConfig) return NextResponse.json({ error: '无效的模型' }, { status: 400 });

    if (modelConfig.requiresImage && !imageBase64) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('image_credits')
      .eq('id', user.id)
      .single();

    const imageCredits = userData?.image_credits || 0;
    if (imageCredits < modelConfig.cost) {
      return NextResponse.json(
        { error: `积分不足，需要 ${modelConfig.cost} 积分，当前仅有 ${imageCredits} 积分` },
        { status: 403 }
      );
    }

    // 构建 fal 输入参数
    const input: Record<string, any> = {
      prompt,
      aspect_ratio: aspectRatio,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '2',
    };

    if (modelConfig.requiresImage && imageBase64) {
      input.image_url = imageBase64;
    }

    const result = await fal.subscribe(modelConfig.endpoint, { input });
    const images = (result.data as any)?.images;
    if (!images || images.length === 0) {
      throw new Error('未能生成图片');
    }
    const imageUrl = images[0].url;

    // 检查历史记录数量，达到 50 张则清空
    const { count: historyCount } = await supabaseAdmin
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (historyCount && historyCount >= 50) {
      await supabaseAdmin.from('image_generations').delete().eq('user_id', user.id);
    }

    // 保存记录
    const { data: imageRecord } = await supabaseAdmin
      .from('image_generations')
      .insert({
        user_id: user.id,
        model,
        prompt,
        image_url: imageUrl,
        size: aspectRatio,
        cost_credits: modelConfig.cost,
        status: 'completed',
        api_source: 'pro',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // 扣除积分
    const newCredits = Math.max(0, imageCredits - modelConfig.cost);
    await supabaseAdmin.from('users').update({ image_credits: newCredits }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      images: [{ url: imageUrl, id: imageRecord?.id, prompt }],
      remainingBalance: newCredits,
      cost: modelConfig.cost,
    });

  } catch (error: any) {
    console.error('Fal 图片生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
