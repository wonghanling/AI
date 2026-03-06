import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fal from '@fal-ai/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY });

// 模型配置
const FAL_MODELS: Record<string, {
  name: string;
  t2v?: string;
  i2v?: string;
  r2v?: string;
  cost: number;
  durations: string[];
  aspectRatios: string[];
  defaultResolution: string;
  supportsEndFrame?: boolean;
  supportsAudio?: boolean;
}> = {
  'veo3.1': {
    name: 'Veo 3.1',
    t2v: 'fal-ai/veo3.1',
    i2v: 'fal-ai/veo3.1/image-to-video',
    cost: 15,
    durations: ['4', '6', '8'],
    aspectRatios: ['16:9', '9:16'],
    defaultResolution: '4K',
    supportsAudio: true,
  },
  'wan2.5': {
    name: 'Wan 2.5',
    t2v: 'fal-ai/wan-25-preview/text-to-video',
    i2v: 'fal-ai/wan-25-preview/image-to-video',
    cost: 8,
    durations: ['5', '10'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    defaultResolution: '1080p',
  },
  'wan2.6-r2v': {
    name: 'Wan 2.6 R2V',
    r2v: 'wan/v2.6/reference-to-video',
    cost: 10,
    durations: ['5', '10'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    defaultResolution: '1080p',
  },
  'kling2.5-turbo': {
    name: 'Kling 2.5 Turbo',
    t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    i2v: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    cost: 10,
    durations: ['5', '10'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    defaultResolution: '1080p',
    supportsEndFrame: true,
  },
  'ovi': {
    name: 'Ovi',
    t2v: 'fal-ai/ovi',
    i2v: 'fal-ai/ovi/image-to-video',
    cost: 8,
    durations: ['5'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    defaultResolution: '1080p',
    supportsAudio: true,
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
      model,
      mode, // 't2v' | 'i2v' | 'r2v'
      prompt,
      duration,
      aspectRatio,
      imageUrl,
      endImageUrl,
      videoUrls, // r2v 用
      generateAudio,
    } = body;

    if (!model || !prompt || !mode) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = FAL_MODELS[model];
    if (!modelConfig) return NextResponse.json({ error: '无效的模型' }, { status: 400 });

    // 检查积分
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('video_credits')
      .eq('id', user.id)
      .single();

    const videoCredits = userData?.video_credits || 0;
    if (videoCredits < modelConfig.cost) {
      return NextResponse.json({ error: `视频积分不足，需要 ${modelConfig.cost} 积分` }, { status: 403 });
    }

    // 构建 fal.ai 请求参数
    let endpoint = '';
    let input: Record<string, any> = { prompt };

    if (mode === 't2v') {
      endpoint = modelConfig.t2v!;
      input.aspect_ratio = aspectRatio || '16:9';
      input.duration = duration || modelConfig.durations[0];
      if (model === 'veo3.1') {
        input.resolution = modelConfig.defaultResolution;
        input.generate_audio = generateAudio || false;
      } else if (model === 'wan2.5') {
        input.resolution = modelConfig.defaultResolution;
      } else if (model === 'kling2.5-turbo') {
        input.negative_prompt = 'blur, distort, and low quality';
        input.cfg_scale = 0.5;
      }
    } else if (mode === 'i2v') {
      endpoint = modelConfig.i2v!;
      input.image_url = imageUrl;
      input.aspect_ratio = aspectRatio || 'auto';
      input.duration = duration || modelConfig.durations[0];
      if (model === 'veo3.1') {
        input.resolution = modelConfig.defaultResolution;
        input.generate_audio = generateAudio || false;
      } else if (model === 'wan2.5') {
        input.resolution = modelConfig.defaultResolution;
      } else if (model === 'kling2.5-turbo') {
        input.negative_prompt = 'blur, distort, and low quality';
        input.cfg_scale = 0.5;
        if (endImageUrl) input.tail_image_url = endImageUrl;
      }
    } else if (mode === 'r2v') {
      endpoint = modelConfig.r2v!;
      input.video_urls = videoUrls;
      input.aspect_ratio = aspectRatio || '16:9';
      input.duration = duration || modelConfig.durations[0];
      input.resolution = modelConfig.defaultResolution;
    }

    // 提交任务到 fal.ai（异步）
    const { request_id } = await fal.queue.submit(endpoint, { input });

    // 扣除积分
    await supabaseAdmin
      .from('users')
      .update({ video_credits: videoCredits - modelConfig.cost })
      .eq('id', user.id);

    // 保存记录
    const { data: videoRecord } = await supabaseAdmin
      .from('video_generations')
      .insert({
        user_id: user.id,
        prompt,
        model,
        duration: parseInt(duration || modelConfig.durations[0]),
        aspect_ratio: aspectRatio || '16:9',
        status: 'pending',
        cost_credits: modelConfig.cost,
        task_id: request_id,
        progress: 0,
        metadata: { mode, endpoint, imageUrl, endImageUrl, videoUrls },
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      taskId: request_id,
      recordId: videoRecord?.id,
      remainingCredits: videoCredits - modelConfig.cost,
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
