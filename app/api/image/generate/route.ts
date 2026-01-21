import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 初始化 Supabase 客户端（使用 service role key）
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

// 图片模型配置
const IMAGE_MODELS: Record<string, { openrouterModel: string; cost: number }> = {
  'flux-schnell': {
    openrouterModel: 'black-forest-labs/flux-schnell',
    cost: 0.003,
  },
  'flux-pro': {
    openrouterModel: 'black-forest-labs/flux-pro',
    cost: 0.05,
  },
  'stable-diffusion': {
    openrouterModel: 'stability-ai/stable-diffusion-xl',
    cost: 0.01,
  },
};

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
    const { model, prompt, size = '1024x1024', quality = 'standard' } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证模型
    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 4. 检查用户配额
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type, credits')
      .eq('id', user.id)
      .single();

    const userType = userData?.user_type || 'free';
    const credits = userData?.credits || 0;

    // 免费用户检查每日配额
    if (userType === 'free') {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabaseAdmin
        .from('image_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today);

      if ((count || 0) >= 5) {
        return NextResponse.json({ error: '今日免费配额已用完，请升级到专业版' }, { status: 403 });
      }
    }

    // 5. 调用 OpenRouter 生成图片
    let imageUrl = '';
    try {
      const response = await openrouter.images.generate({
        model: modelConfig.openrouterModel,
        prompt: prompt,
        n: 1,
        size: size,
      });

      imageUrl = response.data[0]?.url || '';

      if (!imageUrl) {
        throw new Error('未能生成图片');
      }
    } catch (error: any) {
      console.error('Image generation error:', error);
      return NextResponse.json(
        { error: '图片生成失败: ' + (error.message || '未知错误') },
        { status: 500 }
      );
    }

    // 6. 保存生成记录
    const { data: imageRecord, error: insertError } = await supabaseAdmin
      .from('image_generations')
      .insert({
        user_id: user.id,
        model: model,
        prompt: prompt,
        image_url: imageUrl,
        size: size,
        quality: quality,
        cost: modelConfig.cost,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save image record:', insertError);
    }

    // 7. 扣除积分（如果使用积分系统）
    if (userType === 'pro' && credits > 0) {
      await supabaseAdmin
        .from('users')
        .update({ credits: Math.max(0, credits - modelConfig.cost) })
        .eq('id', user.id);
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      model: model,
      prompt: prompt,
      cost: modelConfig.cost,
      recordId: imageRecord?.id,
    });
  } catch (error: any) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
