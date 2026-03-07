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

// 定价结构：普通用户加价 0.6元/秒，会员加价 0.4元/秒
// baseCostPerSec: fal.ai 实际成本（元/秒）
// markupNormal: 普通用户加价（元/秒）
// markupPremium: 会员加价（元/秒）
// audioExtra: 开启音频时额外加价（元/次，固定）
const FAL_MODELS: Record<string, {
  name: string;
  endpoint: string;
  mode: 'i2v' | 't2v' | 'extend' | 'firstLastFrame';
  baseCostPerSec: number;
  markupNormal: number;
  markupPremium: number;
  audioExtra: number;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsEndFrame?: boolean;
  supportsAudio?: boolean;
  supportsDuration?: boolean;
  durationFormat?: 'seconds' | 'number';
  i2vNoAspectRatio?: boolean;
  imageParamName?: string;
  endImageParamName?: string;
}> = {
  // 1. Veo 3.1 文生视频
  'veo3.1-t2v': {
    name: 'Veo 3.1 文生视频',
    endpoint: 'fal-ai/veo3.1',
    mode: 't2v',
    baseCostPerSec: 0.50,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  // 2. Veo 3.1 图生视频
  'veo3.1-i2v': {
    name: 'Veo 3.1 图生视频',
    endpoint: 'fal-ai/veo3.1/image-to-video',
    mode: 'i2v',
    baseCostPerSec: 0.50,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  // 3. Veo 3.1 Fast 文生视频
  'veo3.1-fast-t2v': {
    name: 'Veo 3.1 Fast 文生视频',
    endpoint: 'fal-ai/veo3.1/fast',
    mode: 't2v',
    baseCostPerSec: 0.40,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  // 4. Veo 3.1 Fast 图生视频
  'veo3.1-fast-i2v': {
    name: 'Veo 3.1 Fast 图生视频',
    endpoint: 'fal-ai/veo3.1/fast/image-to-video',
    mode: 'i2v',
    baseCostPerSec: 0.40,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  // 5. Veo 3.1 延长视频
  'veo3.1-extend': {
    name: 'Veo 3.1 延长视频',
    endpoint: 'fal-ai/veo3.1/fast/extend-video',
    mode: 'extend',
    baseCostPerSec: 0.35,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [7],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  // 6. Veo 3.1 首尾帧
  'veo3.1-first-last': {
    name: 'Veo 3.1 首尾帧',
    endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    mode: 'firstLastFrame',
    baseCostPerSec: 0.50,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsEndFrame: true,
    supportsAudio: true,
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  // 7. Wan 2.5 文生视频
  'wan2.5-t2v': {
    name: 'Wan 2.5 文生视频',
    endpoint: 'fal-ai/wan-25-preview/text-to-video',
    mode: 't2v',
    baseCostPerSec: 0.20,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
  },
  // 8. Wan 2.5 图生视频
  'wan2.5-i2v': {
    name: 'Wan 2.5 图生视频',
    endpoint: 'fal-ai/wan-25-preview/image-to-video',
    mode: 'i2v',
    baseCostPerSec: 0.20,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    imageParamName: 'image_url',
  },
  // 9. Kling 2.6 图生视频
  'kling2.6-i2v': {
    name: 'Kling 2.6 图生视频',
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    mode: 'i2v',
    baseCostPerSec: 0.30,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 0,
    durations: [5, 10],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    durationFormat: 'number',
    supportsEndFrame: true,
    supportsAudio: true,
    imageParamName: 'start_image_url',
    endImageParamName: 'end_image_url',
  },
  // 10. Ovi 图生视频
  'ovi-i2v': {
    name: 'Ovi 图生视频',
    endpoint: 'fal-ai/ovi/image-to-video',
    mode: 'i2v',
    baseCostPerSec: 0.20,
    markupNormal: 0.60,
    markupPremium: 0.40,
    audioExtra: 2.0, // 音频额外收费
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: true,
    supportsDuration: false,
    imageParamName: 'image_url',
  },
};

// 计算本次费用
function calcCost(
  model: typeof FAL_MODELS[string],
  duration: number,
  generateAudio: boolean,
  isPremium: boolean
): number {
  const markup = isPremium ? model.markupPremium : model.markupNormal;
  const pricePerSec = model.baseCostPerSec + markup;
  const effectiveDuration = duration || (model.durations[0] ?? 5);
  let cost = parseFloat((pricePerSec * effectiveDuration).toFixed(2));
  if (generateAudio && model.supportsAudio && model.audioExtra > 0) {
    cost = parseFloat((cost + model.audioExtra).toFixed(2));
  }
  return cost;
}

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
      prompt,
      duration,
      aspectRatio,
      resolution,
      imageUrl,
      endImageUrl,
      videoUrl,
      generateAudio,
    } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = FAL_MODELS[model];
    if (!modelConfig) return NextResponse.json({ error: '无效的模型' }, { status: 400 });

    // 查询用户余额和类型
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('video_credits, user_type')
      .eq('id', user.id)
      .single();

    const videoCredits = parseFloat(userData?.video_credits || '0');
    const isPremium = userData?.user_type === 'premium';

    // 计算本次费用
    const effectiveDuration = duration || (modelConfig.durations[0] ?? 5);
    const cost = calcCost(modelConfig, effectiveDuration, !!generateAudio, isPremium);

    if (videoCredits < cost) {
      return NextResponse.json({
        error: `余额不足，本次需要 ¥${cost.toFixed(2)}，当前余额 ¥${videoCredits.toFixed(2)}`
      }, { status: 403 });
    }

    // 构建 fal.ai 请求参数
    const endpoint = modelConfig.endpoint;
    const mode = modelConfig.mode;
    let input: Record<string, any> = { prompt };

    // duration
    if (modelConfig.supportsDuration !== false && modelConfig.durations.length > 0) {
      const raw = String(effectiveDuration);
      input.duration = modelConfig.durationFormat === 'number' ? raw : `${raw}s`;
    }

    // aspect_ratio
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

    // resolution
    if (modelConfig.resolutions.length > 0) {
      input.resolution = resolution || modelConfig.defaultResolution;
    }

    // 图片参数
    if (mode === 'i2v' || mode === 'firstLastFrame') {
      if (!imageUrl) {
        return NextResponse.json({ error: '缺少图片 URL' }, { status: 400 });
      }
      const imageParam = modelConfig.imageParamName || 'image_url';
      input[imageParam] = imageUrl;

      if (endImageUrl && modelConfig.supportsEndFrame && modelConfig.endImageParamName) {
        input[modelConfig.endImageParamName] = endImageUrl;
      }
    }

    // 视频参数（extend）
    if (mode === 'extend') {
      if (!videoUrl) {
        return NextResponse.json({ error: '缺少视频 URL' }, { status: 400 });
      }
      input.video_url = videoUrl;
    }

    // 音频参数
    if (modelConfig.supportsAudio && generateAudio !== undefined) {
      input.generate_audio = generateAudio;
    }

    // 模型特定参数
    if (model === 'kling2.6-i2v') {
      input.negative_prompt = 'blur, distort, and low quality';
    } else if (model === 'ovi-i2v') {
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

    // 生成成功后扣除费用
    const newBalance = parseFloat((videoCredits - cost).toFixed(2));
    await supabaseAdmin
      .from('users')
      .update({ video_credits: newBalance })
      .eq('id', user.id);

    // 保存记录
    const { data: videoRecord } = await supabaseAdmin
      .from('video_generations')
      .insert({
        user_id: user.id,
        prompt,
        model,
        duration: effectiveDuration,
        aspect_ratio: aspectRatio || '16:9',
        status: 'pending',
        cost_credits: cost,
        task_id: request_id,
        progress: 0,
        metadata: { mode, endpoint, imageUrl, endImageUrl, videoUrl, resolution, isPremium, cost },
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      taskId: request_id,
      recordId: videoRecord?.id,
      remainingCredits: newBalance,
      cost,
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
