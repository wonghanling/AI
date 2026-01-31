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

// --- Mock Data & Constants ---

const MODELS = [
  // Veo 3.1 系列
  {
    id: 'veo3.1-4k',
    name: 'Veo 3.1 4K',
    provider: 'Google',
    tags: ['4K', '高质量', '音频'],
    cost: 10,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'Google最新的高级AI模型，支持视频自动配套音频生成，质量高价格低'
  },
  {
    id: 'veo3.1-components-4k',
    name: 'Veo 3.1 Components 4K',
    provider: 'Google',
    tags: ['4K', '首帧', '音频'],
    cost: 10,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: false },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1 4k模式，支持首帧传递，不支持尾帧，性价比最高'
  },
  {
    id: 'veo3.1-pro-4k',
    name: 'Veo 3.1 Pro 4K',
    provider: 'Google',
    tags: ['4K', '超高质量', 'Pro'],
    cost: 30,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1 4k高质量模式，质量超高，支持首尾帧和文生视频'
  },
  {
    id: 'veo_3_1-4K',
    name: 'Veo 3.1 4K (OpenAI格式)',
    provider: 'Google',
    tags: ['4K', '音频', 'OpenAI'],
    cost: 9,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo_3_1 4k模式，OpenAI视频格式，性价比最高'
  },
  {
    id: 'veo_3_1-fast-4K',
    name: 'Veo 3.1 Fast 4K',
    provider: 'Google',
    tags: ['4K', '快速', '首尾帧'],
    cost: 5,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1快速+4k模式，支持首尾帧和文生视频，价格低廉'
  },
  {
    id: 'veo_3_1-components-4K',
    name: 'Veo 3.1 Components 4K (OpenAI)',
    provider: 'Google',
    tags: ['4K', '首帧', 'OpenAI'],
    cost: 9,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: false },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo_3_1 4k模式，支持首帧传递，不支持尾帧'
  },
  {
    id: 'veo_3_1-fast',
    name: 'Veo 3.1 Fast',
    provider: 'Google',
    tags: ['快速', '低成本', '首尾帧'],
    cost: 3,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1快速模式，支持首尾帧和文生视频，最低价格'
  },
  {
    id: 'veo3.1',
    name: 'Veo 3.1',
    provider: 'Google',
    tags: ['标准', '音频', '首尾帧'],
    cost: 7,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1标准版，支持视频自动配套音频生成，支持首尾帧和文生视频'
  },
  {
    id: 'veo3.1-pro',
    name: 'Veo 3.1 Pro',
    provider: 'Google',
    tags: ['Pro', '超高质量', '音频'],
    cost: 30,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1高质量模式，质量超高，价格也超高，支持首尾帧和文生视频'
  },
  {
    id: 'veo3.1-fast',
    name: 'Veo 3.1 Fast (标准)',
    provider: 'Google',
    tags: ['快速', '音频', '首尾帧'],
    cost: 7,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3.1快速模式，支持视频自动配套音频生成，支持首尾帧和文生视频'
  },
  {
    id: 'veo3-pro',
    name: 'Veo 3 Pro',
    provider: 'Google',
    tags: ['Pro', '超高质量', '音频'],
    cost: 35,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '2.4:1'],
    desc: 'veo3高质量模式，支持视频自动配套音频生成，质量超高'
  },

  // Sora 系列
  {
    id: 'sora-2-all',
    name: 'Sora 2 All',
    provider: 'OpenAI',
    tags: ['逆向', '720p', '10-15s'],
    cost: 3,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [10, 15] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'sora-2的逆向，支持10s，15s，都是720p'
  },
  {
    id: 'sora-2-pro-all',
    name: 'Sora 2 Pro All',
    provider: 'OpenAI',
    tags: ['逆向', '1080p', '15-25s'],
    cost: 31,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { fixed: [15, 25] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'sora-2-pro的逆向，支持15s和25s，15s支持1080p和720p'
  },
  {
    id: 'sora-2-4s',
    name: 'Sora 2 (4s)',
    provider: 'OpenAI',
    tags: ['官方', '720p', '4s'],
    cost: 20,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [4] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'Sora 2官方版，4秒720p，物理准确、逼真，支持音效'
  },
  {
    id: 'sora-2-8s',
    name: 'Sora 2 (8s)',
    provider: 'OpenAI',
    tags: ['官方', '720p', '8s'],
    cost: 40,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [8] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'Sora 2官方版，8秒720p，物理准确、逼真，支持音效'
  },
  {
    id: 'sora-2-12s',
    name: 'Sora 2 (12s)',
    provider: 'OpenAI',
    tags: ['官方', '720p', '12s'],
    cost: 60,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [12] },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'Sora 2官方版，12秒720p，物理准确、逼真，支持音效'
  },
  {
    id: 'sora-2-pro-10s-720p',
    name: 'Sora 2 Pro (10s 720p)',
    provider: 'OpenAI',
    tags: ['官方Pro', '720p', '10s'],
    cost: 450,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [10] },
    aspectRatios: ['16:9', '9:16'],
    desc: 'Sora 2 Pro官方版，10秒720p，可选择清晰度'
  },
  {
    id: 'sora-2-pro-15s-720p',
    name: 'Sora 2 Pro (15s 720p)',
    provider: 'OpenAI',
    tags: ['官方Pro', '720p', '15s'],
    cost: 650,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [15] },
    aspectRatios: ['16:9', '9:16'],
    desc: 'Sora 2 Pro官方版，15秒720p，可选择清晰度'
  },
  {
    id: 'sora-2-pro-15s-1080p',
    name: 'Sora 2 Pro (15s 1080p)',
    provider: 'OpenAI',
    tags: ['官方Pro', '1080p', '15s'],
    cost: 1100,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [15] },
    aspectRatios: ['16:9', '9:16'],
    desc: 'Sora 2 Pro官方版，15秒1080p，可选择清晰度'
  },
  {
    id: 'sora-2-pro-25s-1080p',
    name: 'Sora 2 Pro (25s 1080p)',
    provider: 'OpenAI',
    tags: ['官方Pro', '1080p', '25s'],
    cost: 1800,
    features: { t2v: true, i2v: true, startFrame: false, endFrame: false },
    duration: { fixed: [25] },
    aspectRatios: ['16:9', '9:16'],
    desc: 'Sora 2 Pro官方版，25秒1080p，可选择清晰度'
  },

  // Grok 系列
  {
    id: 'grok-video-3',
    name: 'Grok Video 3',
    provider: 'xAI',
    tags: ['最新', '低成本'],
    cost: 3,
    features: { t2v: true, i2v: false, startFrame: false, endFrame: false },
    duration: { min: 2, max: 8, default: 4 },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'grok的最新视频模型'
  },

  // Luma 系列
  {
    id: 'luma_video_api',
    name: 'Luma Video API',
    provider: 'Luma AI',
    tags: ['快速', '参考图', '40s出图'],
    cost: 30,
    features: { t2v: true, i2v: true, startFrame: true, endFrame: true },
    duration: { min: 2, max: 8, default: 5 },
    aspectRatios: ['16:9', '9:16', '1:1'],
    desc: 'Luma AI文生视频，支持上传2张参考图片，快速模式约40秒出视频'
  },

  // Runway 系列
  {
    id: 'runwayml-gen3a_turbo-10',
    name: 'Runway Gen-3A Turbo (10s)',
    provider: 'RunwayML',
    tags: ['Gen-3A', '图生视频', '10s'],
    cost: 25,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [10] },
    aspectRatios: ['16:9'],
    desc: 'RunwayML Gen-3A Turbo-10，先进的图生视频模型'
  },
  {
    id: 'runwayml-gen3a_turbo-5',
    name: 'Runway Gen-3A Turbo (5s)',
    provider: 'RunwayML',
    tags: ['Gen-3A', '图生视频', '5s'],
    cost: 15,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5] },
    aspectRatios: ['16:9'],
    desc: 'RunwayML Gen-3A Turbo-5，先进的图生视频模型'
  },
  {
    id: 'runwayml-gen4_turbo-10',
    name: 'Runway Gen-4 Turbo (10s)',
    provider: 'RunwayML',
    tags: ['Gen-4', '图生视频', '16:9'],
    cost: 25,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [10] },
    aspectRatios: ['16:9'],
    desc: '支持最新gen3模型，仅支持16:9画面，使用官方账号'
  },
  {
    id: 'runwayml-gen4_turbo-5',
    name: 'Runway Gen-4 Turbo (5s)',
    provider: 'RunwayML',
    tags: ['Gen-4', '图生视频', '16:9'],
    cost: 15,
    features: { t2v: false, i2v: true, startFrame: true, endFrame: false },
    duration: { fixed: [5] },
    aspectRatios: ['16:9'],
    desc: '支持最新gen3模型，仅支持16:9画面，使用官方账号'
  }
];

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
  const [duration, setDuration] = useState(4);
  const [startFrameImage, setStartFrameImage] = useState<string | null>(null);
  const [endFrameImage, setEndFrameImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [credits, setCredits] = useState(1240);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorite' | 'failed'>('all');

  // --- Effects ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsGenerating(false);
            setCredits(c => c - selectedModel.cost);
            return 0;
          }
          return prev + 1.5;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isGenerating, selectedModel.cost]);

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
  const handleGenerate = () => {
    if (prompt.trim().length === 0) return;
    setIsGenerating(true);
    setProgress(0);
  };

  const handleOptimizePrompt = () => {
    setPrompt(prev => prev + " (Cinematic lighting, 8k resolution, highly detailed, trending on artstation, masterpiece)");
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
    if (!selectedModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(selectedModel.aspectRatios[0]);
    }
    // Reset duration
    if (selectedModel.duration.fixed) {
      setDuration(selectedModel.duration.fixed[0]);
    } else if (selectedModel.duration.default) {
      setDuration(selectedModel.duration.default);
    }
    // Clear images if not supported
    if (!selectedModel.features.startFrame) {
      setStartFrameImage(null);
    }
    if (!selectedModel.features.endFrame) {
      setEndFrameImage(null);
    }
  }, [selectedModel]);

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
          <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-full border border-zinc-700/50 transition-colors group">
            <CreditCard size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-white">{credits}</span>
            <span className="text-xs text-zinc-500 group-hover:text-white transition-colors">积分</span>
          </button>
          <button className="p-2 hover:bg-zinc-800 rounded-full relative text-zinc-400 hover:text-white transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#09090B]"></span>
          </button>
          <Link href="/" className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-zinc-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:ring-2 ring-zinc-700 transition-all">
            返回
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* 2. Left Panel: Controls & Inputs */}
        <aside className="w-[360px] flex flex-col border-r border-white/5 bg-[#0B0C10] overflow-y-auto custom-scrollbar">
          <div className="p-5 space-y-8 pb-24">

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
                                {model.cost}
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
                  <Badge type={selectedModel.features.t2v ? 'default' : 'warning'}>Text-to-Video</Badge>
                  <Badge type={selectedModel.features.i2v ? 'default' : 'warning'}>Image-to-Video</Badge>
                  <span className="text-xs text-zinc-600 flex items-center gap-1 ml-auto">
                    <Zap size={12} className="text-amber-500" /> {selectedModel.cost} 积分/次
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
                {!selectedModel.features.startFrame && !selectedModel.features.endFrame && (
                   <span className="text-[10px] text-amber-500/80 flex items-center gap-1">
                     <AlertCircle size={10} /> 当前模型不支持
                   </span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Start Frame */}
                <div className={`relative ${!selectedModel.features.startFrame ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('start', e)}
                    className="hidden"
                    id="start-frame-upload"
                    disabled={!selectedModel.features.startFrame}
                  />
                  <label
                    htmlFor="start-frame-upload"
                    className="border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600 transition-all group relative overflow-hidden"
                  >
                    {startFrameImage ? (
                      <>
                        <img src={startFrameImage} alt="Start frame" className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            removeImage('start');
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
                    className="border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600 transition-all group relative overflow-hidden"
                  >
                    {endFrameImage ? (
                      <>
                        <img src={endFrameImage} alt="End frame" className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            removeImage('end');
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

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <span className="text-xs text-zinc-500">画面比例</span>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSupported = selectedModel.aspectRatios.includes(ratio.value);
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

              {/* Duration Slider */}
              {selectedModel.duration.fixed ? (
                // Fixed duration options
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500">时长（固定）</span>
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
              ) : (
                // Variable duration slider
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>时长</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <input
                    type="range"
                    min={selectedModel.duration.min}
                    max={selectedModel.duration.max}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                    <span>{selectedModel.duration.min}s</span>
                    <span>{selectedModel.duration.max}s</span>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sticky CTA Button */}
          <div className="sticky bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10] to-transparent border-t border-white/5 z-20">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className={`
                w-full relative overflow-hidden rounded-xl py-4 font-semibold text-sm tracking-wide transition-all shadow-xl
                ${isGenerating
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                  : prompt
                    ? 'bg-gradient-to-r from-purple-500 to-blue-900 text-white hover:shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99] border border-purple-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'}
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
                    -{selectedModel.cost} 积分
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
                   <p className="text-zinc-500 text-sm max-w-md text-center px-4">AI 正在根据您的提示词构建三维空间与光影，预计剩余 12 秒。</p>
                   <div className="mt-8 flex gap-3">
                      <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400 border border-zinc-700">排队顺位: #2</span>
                      <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400 border border-zinc-700">模型: {selectedModel.name}</span>
                   </div>
                </div>
              ) : (
                // Empty State
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-zinc-800 rotate-12 shadow-2xl">
                    <Film size={32} className="text-zinc-600" />
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
                 {/* Empty State */}
                 <div className="text-center py-12">
                   <History size={32} className="text-zinc-700 mx-auto mb-3" />
                   <p className="text-xs text-zinc-600">暂无生成记录</p>
                 </div>
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
               onClick={() => setShowErrorModal(false)}
               className="absolute top-4 right-4 text-zinc-500 hover:text-white"
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
                   onClick={() => setShowErrorModal(false)}
                   className="w-full py-2 bg-white text-black font-medium text-sm rounded-lg hover:bg-zinc-200 transition-colors"
                >
                   我知道了
                </button>
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
