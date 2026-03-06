import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fal from '@fal-ai/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY });

// 模型配置
const MODEL_CONFIG: Record<string, {
  cost: number;
  t2v?: string;
  i2v?: string;
  r2v?: string;
  defaultResolution: string;
}> = {
  'veo3.1':         { cost: 15, t2v: 'fal-ai/veo3.1', i2v: 'fal-ai/veo3.1/image-to-video', defaultResolution: '4K' },
  'wan2.5':         { cost: 8,  t2v: 'fal-ai/wan-25-preview/text-to-video', i2v: 'fal-ai/wan-25-preview/image-to-video', defaultResolution: '1080p' },
  'wan2.6-r2v':     { cost: 10, r2v: 'wan/v2.6/reference-to-video', defaultResolution: '1080p' },
  'kling2.5-turbo': { cost: 10, t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', i2v: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', defaultResolution: '1080p' },
  'ovi':            { cost: 8,  t2v: 'fal-ai/ovi', i2v: 'fal-ai/ovi/image-to-video', defaultResolution: '1080p' },
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: '用户认证失败' }, { status: 401 });

    const body = await request.json();
    const {
      prompt,
      model,
      mode = 't2v', // 't2v' | 'i2v' | 'r2v'
      aspectRatio = '16:9',
      duration,
      startFrameImage,
      endFrameImage,
      videoUrls,
      generateAudio = false,
      negativePrompt,
    } = body;

    if (!prompt || !model) return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });

    const modelConfig = MODEL_CONFIG[model];
    if (!modelConfig) return NextResponse.json({ error: '无效的模型' }, { status: 400 });

    // 检查积分
    const { data: userData } = await supabase
      .from('users')
      .select('video_credits')
      .eq('id', user.id)
      .single();

    const videoCredits = userData?.video_credits || 0;
    if (videoCredits < modelConfig.cost) {
      return NextResponse.json({ error: `视频积分不足，需要 ${modelConfig.cost} 积分` }, { status: 400 });
    }

    // 构建 fal.ai 请求
    let endpoint = '';
    let input: Record<string, any> = { prompt };

    if (mode === 't2v') {
      endpoint = modelConfig.t2v!;
      input.aspect_ratio = aspectRatio;
      input.duration = String(duration);

      if (model === 'veo3.1') {
        input.resolution = modelConfig.defaultResolution;
        input.generate_audio = generateAudio;
      } else if (model === 'wan2.5') {
        input.resolution = modelConfig.defaultResolution;
        if (negativePrompt) input.negative_prompt = negativePrompt;
      } else if (model === 'kling2.5-turbo') {
        input.negative_prompt = negativePrompt || 'blur, distort, and low quality';
        input.cfg_scale = 0.5;
      } else if (model === 'ovi') {
        input.negative_prompt = negativePrompt || 'jitter, bad hands, blur, distortion';
      }

    } else if (mode === 'i2v') {
      endpoint = modelConfig.i2v!;
      input.image_url = startFrameImage;
      input.duration = String(duration);

      if (model === 'veo3.1') {
        input.aspect_ratio = aspectRatio;
        input.resolution = modelConfig.defaultResolution;
        input.generate_audio = generateAudio;
      } else if (model === 'wan2.5') {
        input.resolution = modelConfig.defaultResolution;
        if (negativePrompt) input.negative_prompt = negativePrompt;
      } else if (model === 'kling2.5-turbo') {
        input.negative_prompt = negativePrompt || 'blur, distort, and low quality';
        input.cfg_scale = 0.5;
        if (endFrameImage) input.tail_image_url = endFrameImage;
      } else if (model === 'ovi') {
        input.negative_prompt = negativePrompt || 'jitter, bad hands, blur, distortion';
      }

    } else if (mode === 'r2v') {
      endpoint = modelConfig.r2v!;
      input.video_urls = videoUrls;
      input.aspect_ratio = aspectRatio;
      input.duration = String(duration);
      input.resolution = modelConfig.defaultResolution;
    }

    // 提交任务到 fal.ai
    const { request_id } = await fal.queue.submit(endpoint, { input });

    // 扣除积分
    await supabase
      .from('users')
      .update({ video_credits: videoCredits - modelConfig.cost })
      .eq('id', user.id);

    // 保存记录
    const { data: videoRecord } = await supabase
      .from('video_generations')
      .insert({
        user_id: user.id,
        prompt,
        model,
        duration: parseInt(String(duration)) || 5,
        aspect_ratio: aspectRatio,
        input_image_url: startFrameImage,
        status: 'pending',
        cost_credits: modelConfig.cost,
        task_id: request_id,
        progress: 0,
        metadata: { mode, endpoint, endFrameImage, videoUrls },
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      taskId: request_id,
      recordId: videoRecord?.id,
      status: 'pending',
      remainingCredits: videoCredits - modelConfig.cost,
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
