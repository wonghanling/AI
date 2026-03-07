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

// 定价规则：会员价 = 成本 + 0.4×秒，普通价 = 成本 + 0.6×秒
// Wan 自带音频不区分，Ovi 按次计费

type UserType = 'normal' | 'premium';
type PerSecEntry = { normal: number; premium: number };
type PerSecPricing = Record<string, {
  noAudio: PerSecEntry;
  audio?: PerSecEntry;
}>;

type ModelConfig = {
  name: string;
  endpoint: string;
  mode: 'i2v' | 't2v' | 'firstLastFrame';
  perSecPricing?: PerSecPricing;
  flatPricing?: PerSecEntry;   // Ovi 按次
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsEndFrame?: boolean;
  supportsAudio?: boolean;     // 有音频开关
  audioBuiltIn?: boolean;      // 自带音频，不需要选择（Wan、Ovi）
  supportsDuration?: boolean;
  durationFormat?: 'seconds' | 'number';
  i2vNoAspectRatio?: boolean;
  imageParamName?: string;
  endImageParamName?: string;
};

function m(cost: number): PerSecEntry {
  return { normal: cost + 0.6, premium: cost + 0.4 };
}

const FAL_MODELS: Record<string, ModelConfig> = {
  'veo3.1-t2v': {
    name: 'Veo 3.1 文生视频',
    endpoint: 'fal-ai/veo3.1',
    mode: 't2v',
    perSecPricing: {
      '720p':  { noAudio: m(1.38),  audio: m(2.76) },
      '1080p': { noAudio: m(1.38),  audio: m(2.76) },
      '4k':    { noAudio: m(2.76),  audio: m(4.14) },
    },
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  'veo3.1-i2v': {
    name: 'Veo 3.1 图生视频',
    endpoint: 'fal-ai/veo3.1/image-to-video',
    mode: 'i2v',
    perSecPricing: {
      '720p':  { noAudio: m(1.38),  audio: m(2.76) },
      '1080p': { noAudio: m(1.38),  audio: m(2.76) },
      '4k':    { noAudio: m(2.76),  audio: m(4.14) },
    },
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  'veo3.1-fast-t2v': {
    name: 'Veo 3.1 Fast 文生视频',
    endpoint: 'fal-ai/veo3.1/fast',
    mode: 't2v',
    perSecPricing: {
      '720p':  { noAudio: m(0.69),  audio: m(1.035) },
      '1080p': { noAudio: m(0.69),  audio: m(1.035) },
      '4k':    { noAudio: m(2.07),  audio: m(2.415) },
    },
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  'veo3.1-fast-i2v': {
    name: 'Veo 3.1 Fast 图生视频',
    endpoint: 'fal-ai/veo3.1/fast/image-to-video',
    mode: 'i2v',
    perSecPricing: {
      '720p':  { noAudio: m(0.69),  audio: m(1.035) },
      '1080p': { noAudio: m(0.69),  audio: m(1.035) },
      '4k':    { noAudio: m(2.07),  audio: m(2.415) },
    },
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    imageParamName: 'image_url',
  },
  'veo3.1-first-last': {
    name: 'Veo 3.1 首尾帧',
    endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    mode: 'firstLastFrame',
    perSecPricing: {
      '720p':  { noAudio: m(0.69),  audio: m(1.035) },
      '1080p': { noAudio: m(0.69),  audio: m(1.035) },
      '4k':    { noAudio: m(2.07),  audio: m(2.415) },
    },
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsEndFrame: true,
    supportsAudio: true,
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  // Wan 自带音频，不区分，用 noAudio 价格
  'wan2.5-t2v': {
    name: 'Wan 2.5 文生视频',
    endpoint: 'fal-ai/wan-25-preview/text-to-video',
    mode: 't2v',
    perSecPricing: {
      '480p':  { noAudio: m(0.345) },
      '720p':  { noAudio: m(0.69) },
      '1080p': { noAudio: m(1.035) },
    },
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    audioBuiltIn: true,
  },
  'wan2.5-i2v': {
    name: 'Wan 2.5 图生视频',
    endpoint: 'fal-ai/wan-25-preview/image-to-video',
    mode: 'i2v',
    perSecPricing: {
      '480p':  { noAudio: m(0.345) },
      '720p':  { noAudio: m(0.69) },
      '1080p': { noAudio: m(1.035) },
    },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    imageParamName: 'image_url',
    audioBuiltIn: true,
  },
  // Kling：无音频 / 有音频两档
  'kling2.6-i2v': {
    name: 'Kling 2.6 图生视频',
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    mode: 'i2v',
    perSecPricing: {
      'default': { noAudio: m(0.483), audio: m(0.966) },
    },
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
  // Ovi：按次计费，自带音频
  'ovi-i2v': {
    name: 'Ovi 图生视频',
    endpoint: 'fal-ai/ovi/image-to-video',
    mode: 'i2v',
    flatPricing: { normal: 1.98, premium: 1.78 },
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsDuration: false,
    imageParamName: 'image_url',
    audioBuiltIn: true,
  },
};

function calcCost(
  model: ModelConfig,
  resolution: string,
  duration: number,
  generateAudio: boolean,
  userType: UserType
): number {
  // 按次计费（Ovi）
  if (model.flatPricing) {
    return parseFloat(model.flatPricing[userType].toFixed(2));
  }

  if (!model.perSecPricing) return 0;

  const res = resolution || model.defaultResolution;
  const entry = model.perSecPricing[res] ?? model.perSecPricing['default'];
  if (!entry) return 0;

  // 自带音频不区分，始终用 noAudio 价格
  const useAudio = !model.audioBuiltIn && generateAudio && model.supportsAudio;
  const priceEntry = (useAudio && entry.audio) ? entry.audio : entry.noAudio;

  const dur = duration || (model.durations[0] ?? 5);
  return parseFloat((priceEntry[userType] * dur).toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    const body = await req.json();
    const { model, prompt, duration, aspectRatio, resolution, imageUrl, endImageUrl, generateAudio } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = FAL_MODELS[model];
    if (!modelConfig) return NextResponse.json({ error: '无效的模型' }, { status: 400 });

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('video_credits, user_type')
      .eq('id', user.id)
      .single();

    const videoCredits = parseFloat(userData?.video_credits || '0');
    const isPremium = userData?.user_type === 'premium';
    const userType: UserType = isPremium ? 'premium' : 'normal';

    const effectiveResolution = resolution || modelConfig.defaultResolution;
    const effectiveDuration = duration || (modelConfig.durations[0] ?? 5);
    const cost = calcCost(modelConfig, effectiveResolution, effectiveDuration, !!generateAudio, userType);

    if (videoCredits < cost) {
      return NextResponse.json({
        error: `余额不足，本次需要 ¥${cost.toFixed(2)}，当前余额 ¥${videoCredits.toFixed(2)}`
      }, { status: 403 });
    }

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
      input.resolution = effectiveResolution;
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

    // 音频参数（自带音频的模型不传 generate_audio）
    if (modelConfig.supportsAudio && !modelConfig.audioBuiltIn) {
      input.generate_audio = !!generateAudio;
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

    const { request_id } = await fal.queue.submit(endpoint, { input });

    const newBalance = parseFloat((videoCredits - cost).toFixed(2));
    await supabaseAdmin
      .from('users')
      .update({ video_credits: newBalance })
      .eq('id', user.id);

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
        metadata: { mode, endpoint, imageUrl, endImageUrl, resolution: effectiveResolution, isPremium, cost },
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
