import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({
  credentials: process.env.FAL_KEY!,
});

// 模型配置
const FAL_MODELS: Record<string, {
  name: string;
  t2v?: string;
  i2v?: string;
  extend?: string;
  firstLastFrame?: string;
  cost: number;
  durations: string[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsEndFrame?: boolean;
  supportsAudio?: boolean;
  supportsDuration?: boolean;
  durationFormat?: 'seconds' | 'number';
  i2vNoAspectRatio?: boolean; // i2v 模式不发 aspect_ratio（如 wan2.5 i2v）
  imageParamName?: string; // 'image_url' or 'start_image_url'
  endImageParamName?: string; // 'end_image_url' or 'tail_image_url' or 'last_frame_url'
}> = {
  'veo3.1': {
    name: 'Veo 3.1',
    t2v: 'fal-ai/veo3.1',
    i2v: 'fal-ai/veo3.1/image-to-video',
    cost: 15,
    durations: ['4', '6', '8'],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  'veo3.1-fast': {
    name: 'Veo 3.1 Fast',
    t2v: 'fal-ai/veo3.1/fast',
    i2v: 'fal-ai/veo3.1/fast/image-to-video',
    cost: 12,
    durations: ['4', '6', '8'],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  'veo3.1-extend': {
    name: 'Veo 3.1 Extend',
    extend: 'fal-ai/veo3.1/fast/extend-video',
    cost: 10,
    durations: ['7'],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  'veo3.1-first-last': {
    name: 'Veo 3.1 首尾帧',
    firstLastFrame: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    cost: 15,
    durations: ['4', '6', '8'],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsEndFrame: true,
    supportsAudio: true,
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  'wan2.5': {
    name: 'Wan 2.5',
    t2v: 'fal-ai/wan-25-preview/text-to-video',
    i2v: 'fal-ai/wan-25-preview/image-to-video',
    cost: 8,
    durations: ['5', '10'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
  },
  'kling2.6': {
    name: 'Kling 2.6',
    i2v: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    cost: 10,
    durations: ['5', '10'],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    durationFormat: 'number',
    supportsEndFrame: true,
    supportsAudio: true,
    imageParamName: 'start_image_url',
    endImageParamName: 'end_image_url',
  },
  'ovi': {
    name: 'Ovi',
    i2v: 'fal-ai/ovi/image-to-video',
    cost: 8,
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: true,
    supportsDuration: false,
    imageParamName: 'image_url',
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
      mode, // 't2v' | 'i2v' | 'extend' | 'firstLastFrame'
      prompt,
      duration,
      aspectRatio,
      resolution,
      imageUrl,
      endImageUrl,
      videoUrl, // extend 用
      generateAudio,
    } = body;

    if (!model || !prompt) {
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

    // 构建 fal.ai 请求参数（动态组装）
    let endpoint = '';
    let input: Record<string, any> = { prompt };

    // 1. 确定 endpoint
    if (mode === 't2v' && modelConfig.t2v) {
      endpoint = modelConfig.t2v;
    } else if (mode === 'i2v' && modelConfig.i2v) {
      endpoint = modelConfig.i2v;
    } else if (mode === 'extend' && modelConfig.extend) {
      endpoint = modelConfig.extend;
    } else if (mode === 'firstLastFrame' && modelConfig.firstLastFrame) {
      endpoint = modelConfig.firstLastFrame;
    } else {
      return NextResponse.json({ error: '模型不支持该模式' }, { status: 400 });
    }

    // 2. 添加通用参数（ovi 不支持 duration）
    if (modelConfig.supportsDuration !== false && modelConfig.durations.length > 0) {
      const durationValue = String(duration || modelConfig.durations[0]);
      const raw = durationValue.replace('s', '');
      input.duration = modelConfig.durationFormat === 'number' ? raw : `${raw}s`;
    }

    // 3. 添加 aspect_ratio（如果模型支持）
    if (modelConfig.aspectRatios.length > 0) {
      const skipAspectRatio = mode === 'i2v' && modelConfig.i2vNoAspectRatio;
      if (!skipAspectRatio) {
        if (mode === 't2v') {
          input.aspect_ratio = aspectRatio || modelConfig.aspectRatios[0];
        } else if (mode === 'i2v' || mode === 'firstLastFrame') {
          input.aspect_ratio = aspectRatio || 'auto';
        }
      }
    }

    // 4. 添加 resolution（如果模型支持）
    if (modelConfig.resolutions.length > 0) {
      input.resolution = resolution || modelConfig.defaultResolution;
    }

    // 5. 添加图片参数（i2v, firstLastFrame）
    if (mode === 'i2v' || mode === 'firstLastFrame') {
      if (!imageUrl) {
        return NextResponse.json({ error: '缺少图片 URL' }, { status: 400 });
      }
      const imageParam = modelConfig.imageParamName || 'image_url';
      input[imageParam] = imageUrl;

      // 添加尾帧（如果支持）
      if (endImageUrl && modelConfig.supportsEndFrame && modelConfig.endImageParamName) {
        input[modelConfig.endImageParamName] = endImageUrl;
      }
    }

    // 6. 添加视频参数（extend）
    if (mode === 'extend') {
      if (!videoUrl) {
        return NextResponse.json({ error: '缺少视频 URL' }, { status: 400 });
      }
      input.video_url = videoUrl;
    }

    // 7. 添加音频参数（如果模型支持）
    if (modelConfig.supportsAudio && generateAudio !== undefined) {
      input.generate_audio = generateAudio;
    }

    // 8. 添加模型特定参数
    if (model === 'kling2.6') {
      input.negative_prompt = 'blur, distort, and low quality';
    } else if (model === 'ovi') {
      input.negative_prompt = 'jitter, bad hands, blur, distortion';
      input.audio_negative_prompt = 'robotic, muffled, echo, distorted';
      input.num_inference_steps = 30;
    } else if (model.startsWith('wan2.5')) {
      input.enable_prompt_expansion = true;
      input.enable_safety_checker = true;
    } else if (model.startsWith('veo3.1')) {
      input.safety_tolerance = '4';
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
        duration: parseInt(String(duration || modelConfig.durations[0] || '0')),
        aspect_ratio: aspectRatio || '16:9',
        status: 'pending',
        cost_credits: modelConfig.cost,
        task_id: request_id,
        progress: 0,
        metadata: { mode, endpoint, imageUrl, endImageUrl, videoUrl, resolution },
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
