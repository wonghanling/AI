import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { Service } from '@volcengine/openapi';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({
  credentials: process.env.FAL_KEY!,
});

const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengSubmit = volcService.createJSONAPI('CVSync2AsyncSubmitTask', { Version: '2022-08-31' });

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
  provider?: 'fal' | 'dashscope' | 'jimeng';
  dashscopeModel?: string;
  jimengReqKey?: string;
  supportsCamera?: boolean;
  perSecPricing?: PerSecPricing;
  flatPricing?: PerSecEntry;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsEndFrame?: boolean;
  supportsAudio?: boolean;
  audioBuiltIn?: boolean;
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
      '720p':  { noAudio: m(0.69),   audio: m(1.035) },
      '1080p': { noAudio: m(0.69),   audio: m(1.035) },
      '4k':    { noAudio: m(2.07),   audio: m(2.415) },
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
      '720p':  { noAudio: m(0.69),   audio: m(1.035) },
      '1080p': { noAudio: m(0.69),   audio: m(1.035) },
      '4k':    { noAudio: m(2.07),   audio: m(2.415) },
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
      '720p':  { noAudio: m(0.69),   audio: m(1.035) },
      '1080p': { noAudio: m(0.69),   audio: m(1.035) },
      '4k':    { noAudio: m(2.07),   audio: m(2.415) },
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
  // Wan DashScope 系列
  'wan2.6-t2v': {
    name: 'Wan 2.6 文生视频',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.6-t2v',
    mode: 't2v',
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    supportsAudio: true,
    audioBuiltIn: false,
  },
  'wan2.5-t2v-preview': {
    name: 'Wan 2.5 文生视频',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.5-t2v-preview',
    mode: 't2v',
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    supportsAudio: true,
    audioBuiltIn: false,
  },
  'wan2.6-i2v': {
    name: 'Wan 2.6 图生视频',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.6-i2v',
    mode: 'i2v',
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    imageParamName: 'img_url',
    supportsAudio: true,
    audioBuiltIn: false,
  },
  'wan2.6-i2v-flash': {
    name: 'Wan 2.6 图生视频 Flash',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.6-i2v-flash',
    mode: 'i2v',
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    imageParamName: 'img_url',
    supportsAudio: true,
    audioBuiltIn: false,
  },
  'wan2.5-i2v-preview': {
    name: 'Wan 2.5 图生视频',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.5-i2v-preview',
    mode: 'i2v',
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    imageParamName: 'img_url',
    supportsAudio: true,
    audioBuiltIn: false,
  },
  'wan2.2-kf2v-flash': {
    name: 'Wan 2.2 首尾帧视频',
    endpoint: 'dashscope',
    provider: 'dashscope',
    dashscopeModel: 'wan2.2-kf2v-flash',
    mode: 'firstLastFrame',
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } },
    durations: [5],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsEndFrame: true,
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  // 即梦 3.0 Pro（1080P）
  'jimeng-pro-t2v': {
    name: '即梦 3.0 Pro 文生视频',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    mode: 't2v',
    perSecPricing: { '1080p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
  },
  'jimeng-pro-i2v': {
    name: '即梦 3.0 Pro 图生视频',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    mode: 'i2v',
    perSecPricing: { '1080p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  // 即梦 3.0 720P
  'jimeng-t2v': {
    name: '即梦 3.0 文生视频 720P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30',
    mode: 't2v',
    perSecPricing: { '720p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p'],
    defaultResolution: '720p',
    durationFormat: 'number',
  },
  'jimeng-i2v': {
    name: '即梦 3.0 图生视频首帧 720P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30',
    mode: 'i2v',
    perSecPricing: { '720p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-first-last': {
    name: '即梦 3.0 首尾帧 720P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30',
    mode: 'firstLastFrame',
    perSecPricing: { '720p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsEndFrame: true,
  },
  'jimeng-camera': {
    name: '即梦 3.0 运镜 720P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_i2v_recamera_v30',
    mode: 'i2v',
    perSecPricing: { '720p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsCamera: true,
  },
  // 即梦 3.0 1080P
  'jimeng-1080-t2v': {
    name: '即梦 3.0 文生视频 1080P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30_1080p',
    mode: 't2v',
    perSecPricing: { '1080p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
  },
  'jimeng-1080-i2v': {
    name: '即梦 3.0 图生视频首帧 1080P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30_1080',
    mode: 'i2v',
    perSecPricing: { '1080p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-1080-first-last': {
    name: '即梦 3.0 首尾帧 1080P',
    endpoint: 'jimeng',
    provider: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30_1080',
    mode: 'firstLastFrame',
    perSecPricing: { '1080p': { noAudio: m(0) } },
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsEndFrame: true,
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
    if (model === 'ovi-i2v') {
      input.negative_prompt = 'jitter, bad hands, blur, distortion';
      input.audio_negative_prompt = 'robotic, muffled, echo, distorted';
      input.num_inference_steps = 30;
    } else if (model.startsWith('wan2.5') && modelConfig.provider !== 'dashscope') {
      input.enable_prompt_expansion = true;
      input.enable_safety_checker = true;
    } else if (model.startsWith('veo3.1')) {
      input.safety_tolerance = '4';
    }

    let request_id: string;
    let taskEndpoint: string;

    // 将 base64 data URL 上传到 Storage，返回公开 HTTP URL
    const toPublicUrl = async (url: string): Promise<string> => {
      if (!url || !url.startsWith('data:')) return url;
      const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return url;
      const mimeType = match[1];
      const ext = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(match[2], 'base64');
      const filename = `frames/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabaseAdmin.storage.from('images').upload(filename, buffer, { contentType: mimeType, upsert: false });
      if (error) throw new Error(`上传帧图片失败: ${error.message}`);
      const { data } = supabaseAdmin.storage.from('images').getPublicUrl(filename);
      return data.publicUrl;
    };

    if (modelConfig.provider === 'jimeng') {
      // 即梦 火山引擎
      const jmBody: Record<string, unknown> = {
        req_key: modelConfig.jimengReqKey,
        prompt,
        seed: -1,
      };
      if (effectiveDuration) jmBody.frames = Number(effectiveDuration) === 10 ? 241 : 121;
      if (modelConfig.mode === 't2v' && aspectRatio) jmBody.aspect_ratio = aspectRatio;
      if (modelConfig.mode === 'i2v' && imageUrl) jmBody.image_urls = [await toPublicUrl(imageUrl)];
      if (modelConfig.mode === 'firstLastFrame') {
        if (!imageUrl || !endImageUrl) return NextResponse.json({ error: '首尾帧模式需要同时上传两张图片' }, { status: 400 });
        jmBody.image_urls = [await toPublicUrl(imageUrl), await toPublicUrl(endImageUrl)];
      }
      if (modelConfig.supportsCamera) {
        jmBody.template_id = 'dynamic_orbit';
        jmBody.camera_strength = 'medium';
      }

      const jmRes = await jimengSubmit(jmBody) as any;
      if (jmRes?.code !== 10000) throw new Error(`即梦提交失败: ${jmRes?.message || JSON.stringify(jmRes)}`);
      request_id = jmRes?.data?.task_id;
      if (!request_id) throw new Error(`即梦未返回 task_id: ${JSON.stringify(jmRes)}`);
      taskEndpoint = `jimeng:${modelConfig.jimengReqKey}`;

    } else if (modelConfig.provider === 'dashscope') {
      // DashScope Wan 系列
      const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY!;
      const dsInput: Record<string, unknown> = { prompt };
      const dsParams: Record<string, unknown> = { prompt_extend: true };

      if (modelConfig.mode === 'i2v' && modelConfig.imageParamName && imageUrl) {
        dsInput[modelConfig.imageParamName] = await toPublicUrl(imageUrl);
        console.log('DashScope i2v 图片URL:', dsInput[modelConfig.imageParamName]);
      }
      if (modelConfig.mode === 'firstLastFrame') {
        if (!imageUrl || !endImageUrl) return NextResponse.json({ error: '首尾帧模式需要同时上传两张图片' }, { status: 400 });
        if (modelConfig.imageParamName) dsInput[modelConfig.imageParamName] = await toPublicUrl(imageUrl);
        if (modelConfig.endImageParamName) dsInput[modelConfig.endImageParamName] = await toPublicUrl(endImageUrl);
        console.log('DashScope firstLastFrame 图片URL:', dsInput);
      }
      if (effectiveDuration) dsParams.duration = Number(effectiveDuration);
      if (effectiveResolution) dsParams.resolution = effectiveResolution;
      if (modelConfig.dashscopeModel?.startsWith('wan2.6')) {
        dsParams.audio = !!generateAudio;
      }

      const dsRes = await fetch(
        'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_KEY}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({ model: modelConfig.dashscopeModel, input: dsInput, parameters: dsParams }),
        }
      );
      if (!dsRes.ok) throw new Error(`DashScope 提交失败: ${await dsRes.text()} | img_url: ${JSON.stringify(dsInput)}`);
      const dsData = await dsRes.json();
      request_id = dsData.output?.task_id;
      if (!request_id) throw new Error(`DashScope 未返回 task_id: ${JSON.stringify(dsData)}`);
      taskEndpoint = `dashscope:${modelConfig.dashscopeModel}`;

    } else {
      // fal.ai
      try {
        const submitResult = await fal.queue.submit(endpoint, { input });
        request_id = submitResult.request_id;
      } catch (falError: any) {
        console.error('fal.queue.submit 错误:', JSON.stringify(falError));
        return NextResponse.json({
          error: falError?.message || 'fal 提交失败',
          detail: falError?.body || falError?.cause || String(falError),
        }, { status: 500 });
      }
      taskEndpoint = endpoint;
    }

    const newBalance = parseFloat((videoCredits - cost).toFixed(2));
    await supabaseAdmin
      .from('users')
      .update({ video_credits: newBalance })
      .eq('id', user.id);

    const { data: videoRecord, error: insertError } = await supabaseAdmin
      .from('video_generations')
      .insert({
        user_id: user.id,
        prompt,
        model,
        duration: effectiveDuration || 5,
        aspect_ratio: aspectRatio || '16:9',
        resolution: effectiveResolution || '720p',
        status: 'pending',
        cost_credits: Math.ceil(cost),
        task_id: request_id,
        progress: 0,
        metadata: { mode: modelConfig.mode, endpoint: taskEndpoint, imageUrl, endImageUrl, resolution: effectiveResolution, isPremium, cost },
      })
      .select()
      .single();

    if (insertError) {
      console.error('数据库插入失败:', insertError);
      return NextResponse.json({ error: '数据库插入失败', detail: insertError.message }, { status: 500 });
    }

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
