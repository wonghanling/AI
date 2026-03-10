'use client';

import React, { useState, useEffect } from 'react';
import {
  Play, Download, Share2, Zap,
  Image as ImageIcon, Sparkles, ChevronDown, Clock,
  Maximize2, Layers, Film, MoreHorizontal,
  Search, Bell, User, X, AlertCircle, CheckCircle2,
  Video, Wand2, History, CreditCard, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import { getCachedCredits, setCachedCredits } from '@/lib/credits-cache';

// --- Mock Data & Constants ---

// 定价规则：会员价 = 成本 + 0.4×秒，普通价 = 成本 + 0.6×秒
// Wan 自带音频不区分，Ovi 按次计费
type PerSecEntry = { normal: number; premium: number };
type PerSecPricing = Record<string, { noAudio: PerSecEntry; audio?: PerSecEntry }>;

function m(cost: number): PerSecEntry {
  return { normal: cost + 0.6, premium: cost + 0.4 };
}

const MODELS = [
  {
    id: 'veo3.1-t2v',
    name: 'Veo 3.1 文生视频',
    provider: 'Google',
    tags: ['4K', '音频', '文生视频'],
    perSecPricing: { '720p': { noAudio: m(1.38), audio: m(2.76) }, '1080p': { noAudio: m(1.38), audio: m(2.76) }, '4k': { noAudio: m(2.76), audio: m(4.14) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [4, 6, 8] },
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Google 最新模型，4K 超清，支持音频生成'
  },
  {
    id: 'veo3.1-i2v',
    name: 'Veo 3.1 图生视频',
    provider: 'Google',
    tags: ['4K', '音频', '图生视频'],
    perSecPricing: { '720p': { noAudio: m(1.38), audio: m(2.76) }, '1080p': { noAudio: m(1.38), audio: m(2.76) }, '4k': { noAudio: m(2.76), audio: m(4.14) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [4, 6, 8] },
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Veo 3.1 图生视频，支持首帧控制'
  },
  {
    id: 'veo3.1-fast-t2v',
    name: 'Veo 3.1 Fast 文生视频',
    provider: 'Google',
    tags: ['4K', '快速', '文生视频'],
    perSecPricing: { '720p': { noAudio: m(0.69), audio: m(1.035) }, '1080p': { noAudio: m(0.69), audio: m(1.035) }, '4k': { noAudio: m(2.07), audio: m(2.415) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [4, 6, 8] },
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Veo 3.1 快速版文生视频，速度更快'
  },
  {
    id: 'veo3.1-fast-i2v',
    name: 'Veo 3.1 Fast 图生视频',
    provider: 'Google',
    tags: ['4K', '快速', '图生视频'],
    perSecPricing: { '720p': { noAudio: m(0.69), audio: m(1.035) }, '1080p': { noAudio: m(0.69), audio: m(1.035) }, '4k': { noAudio: m(2.07), audio: m(2.415) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [4, 6, 8] },
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Veo 3.1 快速版图生视频'
  },
  {
    id: 'veo3.1-first-last',
    name: 'Veo 3.1 首尾帧',
    provider: 'Google',
    tags: ['4K', '首尾帧', '音频'],
    perSecPricing: { '720p': { noAudio: m(0.69), audio: m(1.035) }, '1080p': { noAudio: m(0.69), audio: m(1.035) }, '4k': { noAudio: m(2.07), audio: m(2.415) } } as PerSecPricing,
    features: { t2v: false, i2v: false, startFrame: true, endFrame: true, firstLastFrame: true },
    duration: { fixed: [4, 6, 8] },
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: '支持首尾帧控制，精确控制视频起止画面'
  },
  {
    id: 'wan2.6-t2v',
    name: 'Wan 2.6 文生视频',
    provider: 'Wan',
    tags: ['720P', '文生视频', '音频'],
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720P', '1080P'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Wan 2.6 文生视频，阿里官方 DashScope，支持音频'
  },
  {
    id: 'wan2.5-t2v-preview',
    name: 'Wan 2.5 文生视频',
    provider: 'Wan',
    tags: ['720P', '文生视频', '音频'],
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480P', '720P', '1080P'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Wan 2.5 文生视频，阿里官方 DashScope'
  },
  {
    id: 'wan2.6-i2v',
    name: 'Wan 2.6 图生视频',
    provider: 'Wan',
    tags: ['720P', '图生视频', '音频'],
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10, 15] },
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Wan 2.6 图生视频，阿里官方 DashScope，支持音频'
  },
  {
    id: 'wan2.6-i2v-flash',
    name: 'Wan 2.6 图生视频 Flash',
    provider: 'Wan',
    tags: ['720P', '图生视频', '快速'],
    perSecPricing: { '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10, 15] },
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Wan 2.6 图生视频 Flash 快速版'
  },
  {
    id: 'wan2.5-i2v-preview',
    name: 'Wan 2.5 图生视频',
    provider: 'Wan',
    tags: ['720P', '图生视频'],
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    supportsAudio: true,
    audioBuiltIn: false,
    desc: 'Wan 2.5 图生视频，阿里官方 DashScope'
  },
  {
    id: 'wan2.2-kf2v-flash',
    name: 'Wan 2.2 首尾帧视频',
    provider: 'Wan',
    tags: ['720P', '首尾帧'],
    perSecPricing: { '480P': { noAudio: m(0) }, '720P': { noAudio: m(0) }, '1080P': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: false, startFrame: true, endFrame: true, firstLastFrame: true },
    duration: { fixed: [5] },
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: 'Wan 2.2 首尾帧视频，精确控制起止画面'
  },
  {
    id: 'jimeng-pro-t2v',
    name: '即梦 3.0 Pro 文生视频',
    provider: '即梦',
    tags: ['1080P', '文生视频', 'Pro'],
    perSecPricing: { '1080p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 Pro，1080P 高清，多镜头叙事，精准遵循指令'
  },
  {
    id: 'jimeng-pro-i2v',
    name: '即梦 3.0 Pro 图生视频',
    provider: '即梦',
    tags: ['1080P', '图生视频', 'Pro'],
    perSecPricing: { '1080p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['1080p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 Pro 图生视频，1080P 高清首帧控制'
  },
  {
    id: 'jimeng-t2v',
    name: '即梦 3.0 文生视频 720P',
    provider: '即梦',
    tags: ['720P', '文生视频'],
    perSecPricing: { '720p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 文生视频 720P，高性价比之选'
  },
  {
    id: 'jimeng-i2v',
    name: '即梦 3.0 图生视频首帧 720P',
    provider: '即梦',
    tags: ['720P', '图生视频'],
    perSecPricing: { '720p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['720p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 图生视频首帧控制 720P'
  },
  {
    id: 'jimeng-first-last',
    name: '即梦 3.0 首尾帧 720P',
    provider: '即梦',
    tags: ['720P', '首尾帧'],
    perSecPricing: { '720p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: false, startFrame: true, endFrame: true, firstLastFrame: true },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['720p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 首尾帧 720P，精确控制起止画面'
  },
  {
    id: 'jimeng-camera',
    name: '即梦 3.0 运镜 720P',
    provider: '即梦',
    tags: ['720P', '运镜', '图生视频'],
    perSecPricing: { '720p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['720p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 运镜模式，专业摄影机运动效果'
  },
  {
    id: 'jimeng-1080-t2v',
    name: '即梦 3.0 文生视频 1080P',
    provider: '即梦',
    tags: ['1080P', '文生视频'],
    perSecPricing: { '1080p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 文生视频 1080P 高清'
  },
  {
    id: 'jimeng-1080-i2v',
    name: '即梦 3.0 图生视频首帧 1080P',
    provider: '即梦',
    tags: ['1080P', '图生视频'],
    perSecPricing: { '1080p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['1080p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 图生视频首帧控制 1080P 高清'
  },
  {
    id: 'jimeng-1080-first-last',
    name: '即梦 3.0 首尾帧 1080P',
    provider: '即梦',
    tags: ['1080P', '首尾帧'],
    perSecPricing: { '1080p': { noAudio: m(0) } } as PerSecPricing,
    features: { t2v: false, i2v: false, startFrame: true, endFrame: true, firstLastFrame: true },
    duration: { fixed: [5, 10] },
    aspectRatios: [],
    resolutions: ['1080p'],
    supportsAudio: false,
    audioBuiltIn: false,
    desc: '即梦 3.0 首尾帧 1080P 高清'
  },
  {
    id: 'ovi-i2v',
    name: 'Ovi 图生视频',
    provider: 'Ovi',
    tags: ['音频', '创意', '图生视频', '按次计费'],
    flatPricing: { normal: 1.98, premium: 1.78 } as PerSecEntry,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [] },
    aspectRatios: [],
    resolutions: [],
    supportsAudio: false,
    audioBuiltIn: true,
    desc: '支持视频和音频同步生成，按次计费'
  },
];

// 计算本次费用
function calcCost(
  model: typeof MODELS[0],
  resolution: string,
  duration: number | null,
  generateAudio: boolean,
  isPremium: boolean
): number {
  const userType = isPremium ? 'premium' : 'normal';

  // 按次计费（Ovi）
  if ('flatPricing' in model && model.flatPricing) {
    return parseFloat((model.flatPricing as PerSecEntry)[userType].toFixed(2));
  }

  if (!('perSecPricing' in model) || !model.perSecPricing) return 0;

  const table = model.perSecPricing as PerSecPricing;
  const res = resolution || (model.resolutions[0] ?? '');
  const entry = table[res] ?? table['default'];
  if (!entry) return 0;

  const useAudio = !model.audioBuiltIn && generateAudio && model.supportsAudio;
  const priceEntry = (useAudio && entry.audio) ? entry.audio : entry.noAudio;
  const dur = duration ?? (model.duration.fixed[0] as number | undefined) ?? 5;
  return parseFloat((priceEntry[userType] * dur).toFixed(2));
}

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9', icon: 'w-8 h-5' },
  { label: '9:16', value: '9:16', icon: 'w-5 h-8' },
  { label: '1:1', value: '1:1', icon: 'w-6 h-6' },
  { label: '2.4:1', value: '2.4:1', icon: 'w-8 h-3' },
];

const STYLE_CHIPS = ['赛博朋克', '电影感', '动漫风格', '微距特写', '无人机航拍', '黑白艺术'];

// --- Components ---

const Badge = ({ children, type = 'default' }: { children: React.ReactNode; type?: string }) => {
  const styles = {
    default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    primary: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${styles[type as keyof typeof styles]}`}>
      {children}
    </span>
  );
};

export default function VideoPage() {
  const router = useRouter();

  // --- State Management ---
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState<number | null>(null);
  const [resolution, setResolution] = useState<string>('720p');
  const [generateAudio, setGenerateAudio] = useState<boolean>(false);
  const [startFrameImage, setStartFrameImage] = useState<string | null>(null);
  const [endFrameImage, setEndFrameImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoCredits, setVideoCredits] = useState(0); // 视频余额（人民币）
  const [isPremium, setIsPremium] = useState(false); // 是否会员
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [error, setError] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorite' | 'failed'>('all');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  // 用于存储轮询清理函数
  const [pollCleanup, setPollCleanup] = useState<(() => void) | null>(null);

  // History records
  const [historyRecords, setHistoryRecords] = useState<Array<{
    id: string;
    prompt: string;
    model: string;
    status: 'success' | 'failed' | 'generating';
    videoUrl?: string;
    thumbnail?: string;
    timestamp: Date;
    cost: number;
    isFavorite?: boolean;
  }>>([]);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.push('/auth/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }
    };

    checkAuth();
  }, [router]);

  // Load video credits from API/localStorage on mount
  useEffect(() => {
    const loadCredits = async () => {
      const supabase = getSupabaseClient();
      if (supabase) {
        // 先从缓存加载积分（立即显示）
        const cached = getCachedCredits();
        if (cached) {
          setVideoCredits(cached.videoCredits);
        }

        // 然后从API获取最新积分（后台更新）
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const response = await fetch('/api/user/credits', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              const newImageCredits = data.imageCredits || 0;
              const newVideoCredits = parseFloat(data.videoCredits || '0');
              const userType = data.userType || 'free';

              setVideoCredits(newVideoCredits);
              setIsPremium(userType === 'premium');

              // 更新缓存
              setCachedCredits(newImageCredits, newVideoCredits);
              return;
            }
          } catch (err) {
            console.error('获取积分失败:', err);
          }
        }
      }

      // 如果API获取失败，从localStorage读取
      const savedCredits = localStorage.getItem('videoCredits');
      if (savedCredits) {
        setVideoCredits(parseFloat(savedCredits));
      }
    };

    loadCredits();
  }, []);

  // Load history records from Supabase
  useEffect(() => {
    loadHistory();
  }, []);

  // Supabase Realtime 订阅：实时监听视频生成状态变化
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 订阅当前用户的 video_generations 表变化
      channel = supabase
        .channel('video_generations_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_generations',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            console.log('🔔 Realtime 更新:', payload);

            const record = payload.new;

            // 更新进度
            if (record.progress !== undefined) {
              setProgress(record.progress);
            }

            // 如果视频完成
            if (record.status === 'completed' && record.video_url) {
              console.log('✅ Realtime: 视频生成完成');
              setIsGenerating(false);
              setProgress(100);
              setGeneratedVideo(record.video_url);
              loadHistory();
            }

            // 如果生成失败
            if (record.status === 'failed') {
              console.log('❌ Realtime: 视频生成失败');
              setIsGenerating(false);
              setProgress(0);
              setError('视频生成失败，费用已扣除（API 已消耗资源）');
              loadHistory();
            }
          }
        )
        .subscribe();

      console.log('🔌 Realtime 订阅已启动');
    };

    setupRealtimeSubscription();

    // 清理订阅
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log('🔌 Realtime 订阅已清理');
      }
    };
  }, []);

  // Save video credits to localStorage when changed (使用防抖)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('videoCredits', videoCredits.toString());
    }, 500); // 500ms 防抖

    return () => clearTimeout(timer);
  }, [videoCredits]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showModelDropdown && !target.closest('.model-dropdown-container')) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelDropdown]);

  // --- Handlers ---
  const handleGenerate = async () => {
    if (prompt.trim().length === 0) return;
    const currentCost = calcCost(selectedModel, resolution, duration, generateAudio, isPremium);
    if (videoCredits < currentCost) {
      setShowRechargeModal(true);
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('请先登录');
        setIsGenerating(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('登录已过期，请重新登录');
        setIsGenerating(false);
        return;
      }

      // 调用视频生成API（mode 由后端根据 model id 决定）
      const response = await fetch('/api/video/fal/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          prompt: prompt,
          model: selectedModel.id,
          aspectRatio: aspectRatio,
          resolution: resolution,
          duration: duration,
          imageUrl: startFrameImage,
          endImageUrl: endFrameImage,
          generateAudio: generateAudio,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('VIDEO_ERROR_STATUS:', response.status);
        console.error('VIDEO_ERROR_BODY:', JSON.stringify(data));
        throw new Error(data.error || '生成失败');
      }

      console.log('✅ 视频生成请求成功:', data);
      console.log('taskId:', data.taskId, 'recordId:', data.recordId);
      if (!data.recordId) {
        console.error('❌ recordId 为空，数据库插入可能失败');
      }

      // 更新余额
      setVideoCredits(parseFloat(data.remainingCredits || '0'));

      // 清理之前的轮询（如果有）
      if (pollCleanup) {
        pollCleanup();
      }

      // 开始轮询任务状态，并保存清理函数
      const cleanup = pollVideoStatus(data.taskId, data.recordId);
      setPollCleanup(() => cleanup);

    } catch (err: any) {
      console.error('❌ 生成视频失败:', err);
      const errorMsg = err.message || '生成失败，请重试';
      setError(`${errorMsg} (详细信息请查看控制台)`);
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // 轮询视频生成状态（使用指数退避策略减少请求）
  const pollVideoStatus = (taskId: string, recordId: string) => {
    const maxAttempts = 100; // 最多轮询100次（约15-20分钟）
    const maxRetries = 3; // 每次请求最多重试3次
    let attempts = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    // 指数退避策略：减少请求次数，避免过度轮询
    const getPollingInterval = (attempt: number): number => {
      if (attempt <= 10) return 2000;      // 前10次：每2秒（快速响应）
      if (attempt <= 30) return 5000;      // 10-30次：每5秒
      if (attempt <= 60) return 10000;     // 30-60次：每10秒
      return 15000;                        // 60次以上：每15秒
    };

    // 带重试的 fetch 请求
    const fetchWithRetry = async (url: string, options: RequestInit, retries = maxRetries): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000) // 10秒超时
          });
          return response;
        } catch (err: any) {
          const isLastRetry = i === retries - 1;

          // 如果是网络错误且不是最后一次重试，等待后重试
          if (!isLastRetry && (err.name === 'AbortError' || err.message.includes('fetch'))) {
            console.warn(`⚠️ 请求失败，${i + 1}/${retries} 次重试中...`, err.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 递增等待时间
            continue;
          }

          throw err;
        }
      }
      throw new Error('请求失败');
    };

    const poll = async () => {
      if (isCancelled) return; // 如果已取消，停止轮询

      try {
        attempts++;

        // 每次轮询都重新获取 token，避免 token 过期导致轮询失败
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Supabase 客户端未初始化');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // 如果 session 获取失败，尝试刷新
        if (sessionError || !session) {
          console.warn('⚠️ Session 获取失败，尝试刷新...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError || !refreshedSession) {
            throw new Error('登录已过期，请刷新页面重新登录');
          }
        }

        const currentSession = session || (await supabase.auth.getSession()).data.session;
        if (!currentSession) {
          throw new Error('无法获取登录状态，请刷新页面');
        }

        const response = await fetchWithRetry(
          `/api/video/query?taskId=${encodeURIComponent(taskId)}&recordId=${recordId}`,
          {
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          // 401 错误特殊处理
          if (response.status === 401) {
            throw new Error('登录已过期，请刷新页面重新登录');
          }

          console.error('❌ 查询视频状态API错误:', {
            status: response.status,
            statusText: response.statusText,
            error: data.error,
            details: data.details,
            taskId: taskId,
            recordId: recordId,
            fullResponse: data
          });
          throw new Error(data.error || '查询失败');
        }

        const interval = getPollingInterval(attempts);
        console.log(`📊 视频状态 (${attempts}/${maxAttempts}, 下次${interval/1000}秒):`, {
          taskId: taskId,
          status: data.status,
          progress: data.progress,
          videoUrl: data.videoUrl,
          rawStatus: data.rawData?.status
        });

        // 更新进度（Realtime 也会更新，但轮询作为备份）
        setProgress(data.progress);

        if (data.status === 'completed' && data.videoUrl) {
          // 生成完成
          console.log('✅ 视频生成完成:', data.videoUrl);
          setIsGenerating(false);
          setProgress(100);
          setGeneratedVideo(data.videoUrl);

          // 重新加载历史记录
          loadHistory();

        } else if (data.status === 'failed') {
          // 生成失败
          console.error('❌ 视频生成失败:', data);
          setIsGenerating(false);
          setProgress(0);
          setError('视频生成失败，费用已扣除（API 已消耗资源）');

          // 重新加载历史记录
          loadHistory();

        } else if (attempts < maxAttempts && !isCancelled) {
          // 继续轮询，使用指数退避间隔
          timeoutId = setTimeout(poll, interval);
        } else {
          // 超时
          console.warn('⏱️ 轮询超时，已达到最大尝试次数:', maxAttempts);
          setIsGenerating(false);
          setProgress(0);
          setError(`生成超时（已轮询${maxAttempts}次），请稍后查看历史记录`);
        }

      } catch (err: any) {
        console.error('❌ 查询视频状态失败:', {
          error: err,
          message: err.message,
          stack: err.stack,
          taskId: taskId,
          recordId: recordId
        });

        // 网络错误特殊提示
        const isNetworkError = err.message.includes('fetch') || err.name === 'AbortError' || err.message.includes('网络');
        const errorMessage = isNetworkError
          ? '网络连接不稳定，请检查网络后刷新页面'
          : err.message || '查询失败';

        setIsGenerating(false);
        setProgress(0);
        setError(errorMessage);
      }
    };

    poll();

    // 返回清理函数
    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  };

  // 加载历史记录
  const loadHistory = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('video_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;

      if (data) {
        const now = new Date();

        const records = data.map(record => {
          // 检查"生成中"状态是否超时（超过20分钟视为失败）
          const isGenerating = record.status === 'processing' || record.status === 'pending';
          const createdAt = new Date(record.created_at);
          const minutesElapsed = (now.getTime() - createdAt.getTime()) / 1000 / 60;

          let status: 'success' | 'failed' | 'generating';

          if (record.status === 'completed') {
            status = 'success';
          } else if (record.status === 'failed') {
            status = 'failed';
          } else if (isGenerating && minutesElapsed > 20) {
            // 超时的生成中记录标记为失败
            status = 'failed';
            // 异步更新数据库状态
            supabase
              .from('video_generations')
              .update({ status: 'failed' })
              .eq('id', record.id)
              .then(({ error }) => {
                if (error) {
                  console.error('更新超时记录失败:', error);
                } else {
                  console.log(`⏱️ 记录 ${record.id} 已超时（${Math.round(minutesElapsed)}分钟），标记为失败`);
                }
              });
          } else {
            status = 'generating';
          }

          return {
            id: record.id,
            prompt: record.prompt,
            model: record.model,
            status,
            videoUrl: record.video_url,
            thumbnail: record.thumbnail_url,
            timestamp: createdAt,
            cost: record.cost_credits,
            isFavorite: record.metadata?.isFavorite || false
          };
        });

        setHistoryRecords(records);
      }
    } catch (err) {
      console.error('加载历史记录失败:', err);
    }
  };

  const handleOptimizePrompt = () => {
    setPrompt(prev => prev + " (Cinematic lighting, 8k resolution, highly detailed, trending on artstation, masterpiece)");
  };

  // Handle recharge - redirect to recharge page
  const handleRecharge = () => {
    router.push('/credits/recharge');
  };

  // Toggle favorite
  const toggleFavorite = async (id: string) => {
    const record = historyRecords.find(r => r.id === id);
    if (!record) return;

    const newFavoriteState = !record.isFavorite;

    // 更新本地state
    setHistoryRecords(prev => prev.map(r =>
      r.id === id ? { ...r, isFavorite: newFavoriteState } : r
    ));

    // 更新Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('video_generations')
          .update({
            metadata: { isFavorite: newFavoriteState }
          })
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error('更新收藏状态失败:', err);
      }
    }
  };

  // Delete history record
  const deleteRecord = async (id: string) => {
    // 确认删除
    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    // 保存原始记录，以便删除失败时恢复
    const originalRecords = [...historyRecords];

    // 先删除本地state（立即反馈）
    setHistoryRecords(prev => prev.filter(record => record.id !== id));

    // 删除Supabase记录
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('未登录，无法删除记录');
        }

        const { error } = await supabase
          .from('video_generations')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('❌ 删除记录失败:', {
            error,
            id,
            code: error.code,
            message: error.message,
            details: error.details
          });
          throw error;
        }

        console.log('✅ 记录删除成功:', id);
      } catch (err: any) {
        console.error('❌ 删除记录失败:', err);
        // 恢复本地state
        setHistoryRecords(originalRecords);
        alert(`删除失败: ${err.message || '未知错误'}`);
      }
    }
  };

  // Download video
  const downloadVideo = (videoUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = filename;
    a.click();
  };

  // Load video to preview
  const loadVideoToPreview = (record: typeof historyRecords[0]) => {
    setGeneratedVideo(record.videoUrl || null);
    setPrompt(record.prompt);
  };

  // Handle image upload
  const handleImageUpload = (type: 'start' | 'end', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'start') {
          setStartFrameImage(reader.result as string);
        } else {
          setEndFrameImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove uploaded image
  const removeImage = (type: 'start' | 'end') => {
    if (type === 'start') {
      setStartFrameImage(null);
    } else {
      setEndFrameImage(null);
    }
  };

  // Reset settings when model changes
  useEffect(() => {
    // Reset aspect ratio if not supported
    if (selectedModel.aspectRatios.length > 0 && !(selectedModel.aspectRatios as string[]).includes(aspectRatio)) {
      setAspectRatio(selectedModel.aspectRatios[0]);
    }
    // Reset duration
    if (selectedModel.duration.fixed && selectedModel.duration.fixed.length > 0) {
      setDuration(selectedModel.duration.fixed[0]);
    } else {
      setDuration(null);
    }
    // Reset resolution
    if (selectedModel.resolutions && selectedModel.resolutions.length > 0) {
      setResolution(selectedModel.resolutions[0]);
    }
    // Clear images if not supported
    if (!selectedModel.features.startFrame && !selectedModel.features.firstLastFrame) {
      setStartFrameImage(null);
    }
    if (!selectedModel.features.endFrame) {
      setEndFrameImage(null);
    }
    // Reset audio generation
    if (selectedModel.supportsAudio) {
      setGenerateAudio(false);
    }
  }, [selectedModel, aspectRatio]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollCleanup) {
        console.log('🧹 清理视频轮询定时器');
        pollCleanup();
      }
    };
  }, [pollCleanup]);

  // Filter models based on search query
  const filteredModels = MODELS.filter(model =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.provider.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.tags.some(tag => tag.toLowerCase().includes(modelSearchQuery.toLowerCase()))
  );

  // Group models by provider
  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof MODELS>);

  return (
    <div className="flex flex-col h-screen bg-[#09090B] text-zinc-300 font-sans selection:bg-purple-500/30">

      {/* 1. Top Navigation Bar */}
      <header className="h-14 border-b border-white/5 bg-[#09090B]/80 backdrop-blur-md flex items-center justify-between px-6 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-900 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
            <Video size={18} fill="currentColor" />
          </Link>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            AI 视频生成
          </span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] border border-zinc-700 text-zinc-400 ml-2">BETA</span>
        </div>

        <div className="flex-1 max-w-xl mx-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="搜索生成记录、提示词或模板..."
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-zinc-300 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/credits/recharge')}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-full border border-zinc-700/50 transition-colors group"
          >
            <CreditCard size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-white">¥{videoCredits.toFixed(2)}</span>
            <span className="text-xs text-zinc-500 group-hover:text-white transition-colors">视频余额</span>
          </button>
          <button className="p-2 hover:bg-zinc-800 rounded-full relative text-zinc-400 hover:text-white transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#09090B]"></span>
          </button>
          <Link href="/chat" className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-full border border-zinc-700/50 text-sm text-zinc-300 hover:text-white transition-colors">
            聊天
          </Link>
          <Link href="/" className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-zinc-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:ring-2 ring-zinc-700 transition-all">
            返回
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* 2. Left Panel: Controls & Inputs */}
        <aside className="w-[360px] flex flex-col border-r border-white/5 bg-[#0B0C10] overflow-y-auto custom-scrollbar">
          {/* 切换按钮 - 图片/视频 */}
          <div className="p-5 pb-3 border-b border-white/5">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Link
                href="/image"
                className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 rounded-lg font-medium text-xs transition-colors border border-zinc-800"
              >
                <ImageIcon size={16} />
                <span>图片生成</span>
                <ChevronDown size={12} className="rotate-90" />
              </Link>
              <button
                className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-br from-purple-500/20 to-blue-900/20 text-purple-400 rounded-lg font-medium text-xs border border-purple-500/30"
              >
                <Video size={16} />
                <span>视频生成</span>
                <CheckCircle2 size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/chat"
                className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 rounded-lg font-medium text-xs transition-colors border border-zinc-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>聊天</span>
                <ChevronDown size={12} className="rotate-90" />
              </Link>
              <Link
                href="/image/pro"
                className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 rounded-lg font-medium text-xs transition-colors border border-zinc-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>图片专业版</span>
                <ChevronDown size={12} className="rotate-90" />
              </Link>
            </div>
          </div>

          <div className="p-5 space-y-8 pb-24">

            {/* 充值按钮 + 余额显示 */}
            <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <div className="text-[10px] text-zinc-500 mb-0.5">视频余额</div>
                <div className="text-base font-bold text-white">¥{videoCredits.toFixed(2)}</div>
                {isPremium && <div className="text-[10px] text-purple-400 mt-0.5">会员价</div>}
              </div>
              <button
                onClick={() => router.push('/credits/recharge')}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20"
              >
                <Zap size={13} />
                充值
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Model Selector Section */}
            <section className="space-y-3 model-dropdown-container">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">选择模型</label>
                <span className="text-xs text-purple-400 cursor-pointer hover:underline">查看所有</span>
              </div>
              <div className="relative group">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between transition-all text-left group-hover:shadow-lg group-hover:shadow-purple-500/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/5">
                      <Film size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        {selectedModel.name}
                        <Badge type="primary">{selectedModel.tags[0]}</Badge>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">
                        {selectedModel.provider}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-zinc-600 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Model Dropdown */}
                {showModelDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-[400px] overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-3 border-b border-zinc-800">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input
                          type="text"
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          placeholder="搜索模型..."
                          className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-purple-500/50 text-zinc-300 placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    {/* Model List */}
                    <div className="overflow-y-auto custom-scrollbar">
                      {Object.entries(groupedModels).map(([provider, models]) => (
                        <div key={provider} className="border-b border-zinc-800/50 last:border-0">
                          <div className="px-3 py-2 bg-zinc-800/30">
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{provider}</span>
                          </div>
                          {models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model);
                                setShowModelDropdown(false);
                                setModelSearchQuery('');
                              }}
                              className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left ${
                                selectedModel.id === model.id ? 'bg-purple-500/10' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-white flex items-center gap-2">
                                  {model.name}
                                  {selectedModel.id === model.id && (
                                    <CheckCircle2 size={12} className="text-purple-400" />
                                  )}
                                </div>
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                  {model.tags.slice(0, 2).map((tag, idx) => (
                                    <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-purple-400 font-medium ml-2">
                                <Zap size={10} />
                                ¥{calcCost(model, model.resolutions[0] ?? '', model.duration.fixed[0] ?? null, false, isPremium).toFixed(2)}起
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visual Model Capability Tags */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedModel.features.t2v && <Badge type="default">文生视频</Badge>}
                  {selectedModel.features.i2v && <Badge type="default">图生视频</Badge>}
                  {(selectedModel.features.firstLastFrame || selectedModel.features.endFrame) && <Badge type="primary">首尾帧</Badge>}
                  {selectedModel.supportsAudio && <Badge type="success">音频</Badge>}
                  {'audioBuiltIn' in selectedModel && selectedModel.audioBuiltIn && <Badge type="success">自带音频</Badge>}
                  <span className="text-xs text-zinc-600 flex items-center gap-1 ml-auto">
                    <Zap size={12} className="text-amber-500" />
                    ¥{calcCost(selectedModel, resolution, duration, generateAudio, isPremium).toFixed(2)}
                  </span>
                </div>
              </div>
            </section>

            {/* Prompt Input Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">提示词 (Prompt)</label>
                <button
                  onClick={handleOptimizePrompt}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded-md hover:bg-purple-500/10"
                >
                  <Wand2 size={12} /> 智能优化
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="描述您想生成的画面... 例如：Cyberpunk street in rain, neon lights reflection, cinematic shot, 8k"
                  className="w-full min-h-[140px] bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 resize-y transition-all placeholder:text-zinc-700"
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 bg-zinc-900/80 px-1.5 py-0.5 rounded">
                  {prompt.length}/2000
                </div>
              </div>

              {/* Negative Prompt Accordion */}
              <div className="pt-2">
                <button
                  className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
                  onClick={() => setNegativePrompt(prev => prev === null ? '' : null)}
                >
                  <ChevronDown size={12} className={`transform transition-transform ${negativePrompt !== null ? 'rotate-180' : ''}`} />
                  负面提示词 (Negative Prompt)
                </button>
                {negativePrompt !== null && (
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="不想出现的元素 (Low quality, blurry, bad anatomy)..."
                    className="w-full mt-2 bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 focus:outline-none focus:border-red-500/30 min-h-[80px]"
                  />
                )}
              </div>
            </section>

            {/* Media Reference Section */}
            <section className="space-y-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                画面引导 (Image Ref)
                {!selectedModel.features.startFrame && !selectedModel.features.endFrame && !selectedModel.features.firstLastFrame && (
                   <span className="text-[10px] text-amber-500/80 flex items-center gap-1">
                     <AlertCircle size={10} /> 当前模型不支持
                   </span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Start Frame */}
                {(() => {
                  const canUploadStart = selectedModel.features.startFrame || selectedModel.features.firstLastFrame;
                  return (
                <div className={`relative ${!canUploadStart ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('start', e)}
                    className="hidden"
                    id="start-frame-upload"
                    disabled={!canUploadStart}
                  />
                  <label
                    htmlFor="start-frame-upload"
                    className={`border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 transition-all group relative overflow-hidden ${!canUploadStart ? '' : 'cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600'}`}
                  >
                    {startFrameImage ? (
                      <>
                        <img src={startFrameImage} alt="Start frame" className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            // 使用 requestAnimationFrame 确保立即响应
                            requestAnimationFrame(() => {
                              removeImage('start');
                            });
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center z-10 transition-colors"
                        >
                          <X size={14} className="text-white" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center z-10">
                          <span className="text-xs text-white">点击上传</span>
                        </div>
                        <ImageIcon size={20} className="text-zinc-600 group-hover:text-zinc-400" />
                        <span className="text-[10px] text-zinc-500">首帧图片</span>
                      </>
                    )}
                  </label>
                </div>
                  );
                })()}

                {/* End Frame */}
                <div className={`relative ${!selectedModel.features.endFrame ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('end', e)}
                    className="hidden"
                    id="end-frame-upload"
                    disabled={!selectedModel.features.endFrame}
                  />
                  <label
                    htmlFor="end-frame-upload"
                    className={`border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 transition-all group relative overflow-hidden ${!selectedModel.features.endFrame ? '' : 'cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600'}`}
                  >
                    {endFrameImage ? (
                      <>
                        <img src={endFrameImage} alt="End frame" className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            // 使用 requestAnimationFrame 确保立即响应
                            requestAnimationFrame(() => {
                              removeImage('end');
                            });
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center z-10 transition-colors"
                        >
                          <X size={14} className="text-white" />
                        </button>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={20} className="text-zinc-600 group-hover:text-zinc-400" />
                        <span className="text-[10px] text-zinc-500">尾帧图片</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </section>

            {/* Settings Parameters */}
            <section className="space-y-4">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">生成参数 (Settings)</label>

              {/* Aspect Ratio - Only for models that support it */}
              {selectedModel.aspectRatios.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-zinc-500">画面比例</span>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSupported = (selectedModel.aspectRatios as string[]).includes(ratio.value);
                    return (
                      <button
                        key={ratio.value}
                        onClick={() => isSupported && setAspectRatio(ratio.value)}
                        disabled={!isSupported}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
                          aspectRatio === ratio.value
                            ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                            : isSupported
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                              : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-700 cursor-not-allowed opacity-40'
                        }`}
                      >
                        <div className={`border border-current rounded-sm ${ratio.icon}`} />
                        <span className="text-[10px]">{ratio.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Duration Selection - Only for models with multiple duration options */}
              {selectedModel.duration.fixed && selectedModel.duration.fixed.length > 1 && (
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500">时长选择</span>
                  <div className="flex gap-2 flex-wrap">
                    {selectedModel.duration.fixed.map((dur) => (
                      <button
                        key={dur}
                        onClick={() => setDuration(dur)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          duration === dur
                            ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Selection - Only for models with resolution options */}
              {selectedModel.resolutions && selectedModel.resolutions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500">清晰度</span>
                  <div className="flex gap-2 flex-wrap">
                    {selectedModel.resolutions.map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          resolution === res
                            ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Generation Toggle - Only for models that support audio */}
              {selectedModel.supportsAudio && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">生成音频</span>
                    <button
                      onClick={() => setGenerateAudio(!generateAudio)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        generateAudio ? 'bg-purple-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          generateAudio ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600">
                    {generateAudio ? '将生成视频配音' : '仅生成无声视频'}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Sticky CTA Button */}
          <div className="sticky bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10] to-transparent border-t border-white/5 z-20">
            {/* 本次费用显示 */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-zinc-500">本次费用</span>
              <span className="text-sm font-bold text-purple-400">
                ¥{calcCost(selectedModel, resolution, duration, generateAudio, isPremium).toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className={`
                w-full relative overflow-hidden rounded-xl py-4 font-semibold text-sm tracking-wide transition-colors shadow-xl
                ${isGenerating
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700 pointer-events-none'
                  : prompt
                    ? 'bg-gradient-to-r from-purple-500 to-blue-900 text-white hover:shadow-purple-500/25 active:scale-[0.98] border border-purple-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed pointer-events-none'}
              `}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span>生成中... {Math.round(progress)}%</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Sparkles size={18} className={prompt ? "animate-pulse" : ""} />
                  <span>立即生成</span>
                  <span className="ml-1 text-[10px] font-bold opacity-80 bg-black/10 px-1.5 py-0.5 rounded">
                    -¥{calcCost(selectedModel, resolution, duration, generateAudio, isPremium).toFixed(2)}
                  </span>
                </div>
              )}
              {/* Progress Bar Overlay */}
              {isGenerating && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              )}
            </button>
          </div>
        </aside>

        {/* 3. Center: Preview Stage */}
        <main className="flex-1 bg-[#09090B] flex flex-col relative">
           {/* Stage Toolbar */}
           <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-900/30">
             <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                   <Layers size={14} /> 预览模式
                </span>
             </div>
             <div className="flex items-center gap-3">
                {generatedVideo && (
                  <>
                    <button
                      onClick={() => downloadVideo(generatedVideo, `video-${Date.now()}.mp4`)}
                      className="p-1.5 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded"
                    >
                      <Download size={16} />
                    </button>
                    <button className="p-1.5 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded">
                      <Share2 size={16} />
                    </button>
                  </>
                )}
                <button className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Maximize2 size={16} />
                </button>
             </div>
           </div>

           {/* Canvas Area */}
           <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#09090B] to-[#09090B]">

              {isGenerating ? (
                // Generating State
                <div className="w-full max-w-3xl aspect-video rounded-2xl bg-zinc-900/50 border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
                   <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-blue-500/5 animate-pulse"></div>
                   <Loader2 size={48} className="text-purple-400 animate-spin mb-6" />
                   <h3 className="text-lg font-medium text-white mb-2">正在创造影像...</h3>
                   <p className="text-zinc-500 text-sm max-w-md text-center px-4">AI 正在根据您的提示词构建三维空间与光影，预计剩余 {Math.ceil((100 - progress) / 1.5 * 0.1)} 秒。</p>
                   <div className="mt-8 flex gap-3">
                      <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400 border border-zinc-700">排队顺位: #2</span>
                      <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400 border border-zinc-700">模型: {selectedModel.name}</span>
                   </div>
                </div>
              ) : generatedVideo ? (
                // Video Preview with Gradient Border
                <div className="w-full max-w-3xl space-y-4">
                  {/* 调试信息 */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-zinc-400">视频URL:</span>
                      <code className="text-purple-400 flex-1 truncate">{generatedVideo}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedVideo);
                          alert('已复制到剪贴板');
                        }}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                      >
                        复制
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={generatedVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-400 border border-blue-500/30"
                      >
                        在新标签页打开
                      </a>
                      <button
                        onClick={() => {
                          const video = document.querySelector('video');
                          if (video) {
                            video.load();
                            console.log('🔄 重新加载视频');
                          }
                        }}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                      >
                        重新加载
                      </button>
                    </div>
                  </div>

                  <div className="w-full aspect-video rounded-2xl relative overflow-hidden shadow-2xl">
                  {/* Gradient Border */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-blue-600 to-blue-900 p-[2px] rounded-2xl">
                    <div className="w-full h-full bg-[#09090B] rounded-2xl overflow-hidden">
                      <video
                        src={generatedVideo}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-cover"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={(e) => {
                          console.error('❌ 视频播放错误:', {
                            videoUrl: generatedVideo,
                            error: e,
                            errorCode: (e.target as HTMLVideoElement).error?.code,
                            errorMessage: (e.target as HTMLVideoElement).error?.message
                          });
                          setError('视频加载失败，请检查视频URL是否有效');
                        }}
                        onLoadedMetadata={() => {
                          console.log('✅ 视频元数据加载成功:', generatedVideo);
                        }}
                        onCanPlay={() => {
                          console.log('✅ 视频可以播放:', generatedVideo);
                        }}
                      />
                    </div>
                  </div>

                  {/* Video Info Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg">
                      <p className="text-xs text-zinc-300 line-clamp-2 max-w-md">{prompt}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-zinc-400">
                        {aspectRatio}
                      </span>
                      {duration && (
                        <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-zinc-400">
                          {duration}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ) : (
                // Empty State
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500/10 to-blue-900/10 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/20 rotate-12 shadow-2xl">
                    <Film size={32} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">开始您的创作</h2>
                    <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">
                      在左侧输入提示词并选择模型，开始生成您的视频作品。
                    </p>
                  </div>
                </div>
              )}
           </div>
        </main>

        {/* 4. Right Panel: History & Drawer */}
        <aside className={`${showHistoryDrawer ? 'w-80' : 'w-14'} transition-all duration-300 border-l border-white/5 bg-[#0B0C10] flex flex-col`}>
          <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
             {showHistoryDrawer && <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">历史记录</span>}
             <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800"
             >
               <History size={16} />
             </button>
          </div>

          {showHistoryDrawer && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
               {/* 提醒横幅 */}
               <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                 <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                 <div className="flex-1">
                   <p className="text-[11px] text-amber-300 leading-relaxed">
                     历史记录仅保留最近 25 条，请及时下载保存重要视频
                   </p>
                 </div>
               </div>

               {/* Filters */}
               <div className="flex gap-2 pb-2">
                 <button
                   onClick={() => setHistoryFilter('all')}
                   className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                     historyFilter === 'all'
                       ? 'bg-zinc-800 text-white border-zinc-700'
                       : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                   }`}
                 >
                   全部
                 </button>
                 <button
                   onClick={() => setHistoryFilter('favorite')}
                   className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                     historyFilter === 'favorite'
                       ? 'bg-zinc-800 text-white border-zinc-700'
                       : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                   }`}
                 >
                   收藏
                 </button>
                 <button
                   onClick={() => setHistoryFilter('failed')}
                   className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                     historyFilter === 'failed'
                       ? 'bg-zinc-800 text-white border-zinc-700'
                       : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                   }`}
                 >
                   失败
                 </button>
               </div>

               {/* History List */}
               <div className="space-y-3">
                 {historyRecords.filter(record => {
                   if (historyFilter === 'favorite') return record.isFavorite;
                   if (historyFilter === 'failed') return record.status === 'failed';
                   return true;
                 }).length === 0 ? (
                   // Empty State
                   <div className="text-center py-12">
                     <History size={32} className="text-zinc-700 mx-auto mb-3" />
                     <p className="text-xs text-zinc-600">
                       {historyFilter === 'all' ? '暂无生成记录' :
                        historyFilter === 'favorite' ? '暂无收藏记录' : '暂无失败记录'}
                     </p>
                   </div>
                 ) : (
                   historyRecords.filter(record => {
                     if (historyFilter === 'favorite') return record.isFavorite;
                     if (historyFilter === 'failed') return record.status === 'failed';
                     return true;
                   }).map((record) => (
                     <div
                       key={record.id}
                       className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all group"
                     >
                       {/* Thumbnail */}
                       <div
                         className="relative aspect-video bg-zinc-800 cursor-pointer"
                         onClick={() => loadVideoToPreview(record)}
                       >
                         {record.thumbnail && (
                           <img
                             src={record.thumbnail}
                             alt="Video thumbnail"
                             className="w-full h-full object-cover"
                           />
                         )}
                         {record.status === 'success' && (
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <Play size={32} className="text-white" fill="white" />
                           </div>
                         )}
                         {record.status === 'failed' && (
                           <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                             <AlertCircle size={24} className="text-red-500" />
                           </div>
                         )}
                         {record.status === 'generating' && (
                           <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                             <Loader2 size={24} className="text-purple-400 animate-spin" />
                           </div>
                         )}
                         {/* Status Badge */}
                         <div className="absolute top-2 right-2">
                           {record.status === 'success' && (
                             <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded-full border border-emerald-500/30">
                               成功
                             </span>
                           )}
                           {record.status === 'failed' && (
                             <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[9px] rounded-full border border-red-500/30">
                               失败
                             </span>
                           )}
                           {record.status === 'generating' && (
                             <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[9px] rounded-full border border-purple-500/30">
                               生成中
                             </span>
                           )}
                         </div>
                       </div>

                       {/* Info */}
                       <div className="p-3 space-y-2">
                         <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                           {record.prompt}
                         </p>
                         <div className="flex items-center justify-between text-[10px] text-zinc-500">
                           <span>{record.model}</span>
                           <span className="flex items-center gap-1">
                             <span>¥{Number(record.cost).toFixed(2)}</span>
                             <span>·</span>
                             <span>{new Date(record.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                           </span>
                         </div>

                         {/* Actions */}
                         <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                           <button
                             onClick={() => toggleFavorite(record.id)}
                             className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] transition-colors ${
                               record.isFavorite
                                 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                 : 'bg-zinc-800 text-zinc-400 hover:text-white'
                             }`}
                           >
                             <Sparkles size={12} fill={record.isFavorite ? 'currentColor' : 'none'} />
                             {record.isFavorite ? '已收藏' : '收藏'}
                           </button>
                           {record.status === 'success' && record.videoUrl && (
                             <button
                               onClick={() => downloadVideo(record.videoUrl!, `video-${record.id}.mp4`)}
                               className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                             >
                               <Download size={12} />
                               下载
                             </button>
                           )}
                           <button
                             onClick={() => deleteRecord(record.id)}
                             className="px-2 py-1.5 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                           >
                             <X size={12} />
                           </button>
                         </div>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </div>
          )}
        </aside>

      </div>

      {/* 5. Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[400px] bg-[#09090B] border border-zinc-800 rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
             <button
               onClick={() => {
                 // 使用 requestAnimationFrame 确保立即响应
                 requestAnimationFrame(() => {
                   setShowErrorModal(false);
                 });
               }}
               className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
             >
               <X size={18} />
             </button>

             <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                   <AlertCircle size={24} />
                </div>
                <div>
                   <h3 className="text-lg font-semibold text-white">任务生成失败</h3>
                   <p className="text-sm text-zinc-500 mt-2">
                      系统检测到您的提示词包含潜在的敏感内容，触发了安全拦截机制。此次尝试未扣除积分。
                   </p>
                </div>
                <div className="w-full bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-left">
                   <p className="text-xs text-zinc-400 font-mono">Error Code: POLICY_VIOLATION_NSFW</p>
                </div>
                <button
                   onClick={() => {
                     // 使用 requestAnimationFrame 确保立即响应
                     requestAnimationFrame(() => {
                       setShowErrorModal(false);
                     });
                   }}
                   className="w-full py-2 bg-white text-black font-medium text-sm rounded-lg hover:bg-zinc-200 transition-colors"
                >
                   我知道了
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 6. Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[480px] bg-[#09090B] border border-zinc-800 rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
             <button
               onClick={() => setShowRechargeModal(false)}
               className="absolute top-4 right-4 text-zinc-500 hover:text-white"
             >
               <X size={18} />
             </button>

             <div className="space-y-6">
                <div className="text-center">
                   <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={24} className="text-white" />
                   </div>
                   <h3 className="text-lg font-semibold text-white">视频余额不足</h3>
                   <p className="text-sm text-zinc-500 mt-2">
                      当前余额: <span className="text-purple-400 font-medium">¥{videoCredits.toFixed(2)}</span>
                   </p>
                   <p className="text-sm text-zinc-500 mt-1">
                      本次需要: <span className="text-red-400 font-medium">¥{calcCost(selectedModel, resolution, duration, generateAudio, isPremium).toFixed(2)}</span>
                   </p>
                </div>

                {/* Recharge Options */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { amount: 50, popular: false },
                    { amount: 100, popular: true },
                    { amount: 1000, popular: false }
                  ].map((option) => (
                    <button
                      key={option.amount}
                      onClick={handleRecharge}
                      className={`relative bg-zinc-900 border rounded-xl p-4 text-left transition-all group hover:shadow-lg ${
                        option.popular
                          ? 'border-purple-500/50 hover:border-purple-500 hover:shadow-purple-500/20'
                          : 'border-zinc-800 hover:border-purple-500/50 hover:shadow-purple-500/10'
                      }`}
                    >
                      {option.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white text-[9px] font-bold rounded-full whitespace-nowrap">
                          推荐
                        </span>
                      )}
                      <div className="text-2xl font-bold text-white mb-1">
                        ¥{option.amount}
                      </div>
                      <div className="text-xs text-zinc-500">
                        充 ¥{option.amount} 得 ¥{option.amount}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-xs text-zinc-600 mb-3">
                    视频余额独立使用，不可用于图片生成
                  </p>
                  <button
                    onClick={handleRecharge}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-900 text-white font-medium text-sm rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                  >
                    前往充值页面
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Global CSS for scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272A;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3F3F46;
        }
      `}</style>
    </div>
  );
}
