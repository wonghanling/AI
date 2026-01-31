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
  {
    id: 'm1',
    name: 'Sora Pro',
    tags: ['电影感', '8K', '高保真'],
    cost: 15,
    features: { t2v: true, i2v: true, frames: true },
    desc: '适用于需要极高写实度的电影级镜头生成。'
  },
  {
    id: 'm2',
    name: 'Runway Gen-3',
    tags: ['快速', '高质量', '商用'],
    cost: 8,
    features: { t2v: true, i2v: true, frames: false },
    desc: '专为商业视频优化的高速生成模型。'
  },
  {
    id: 'm3',
    name: 'Veo 3',
    tags: ['低成本', '快速', '实验'],
    cost: 4,
    features: { t2v: true, i2v: false, frames: false },
    desc: '用于快速验证创意，成本低廉。'
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
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [credits, setCredits] = useState(1240);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);

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

  // --- Handlers ---
  const handleGenerate = () => {
    if (prompt.trim().length === 0) return;
    setIsGenerating(true);
    setProgress(0);
  };

  const handleOptimizePrompt = () => {
    setPrompt(prev => prev + " (Cinematic lighting, 8k resolution, highly detailed, trending on artstation, masterpiece)");
  };

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
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">选择模型</label>
                <span className="text-xs text-purple-400 cursor-pointer hover:underline">查看所有</span>
              </div>
              <div className="relative group">
                <button className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between transition-all text-left group-hover:shadow-lg group-hover:shadow-purple-500/10">
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
                        {selectedModel.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-zinc-600" />
                </button>

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
                {!selectedModel.features.frames && (
                   <span className="text-[10px] text-amber-500/80 flex items-center gap-1">
                     <AlertCircle size={10} /> 当前模型不支持
                   </span>
                )}
              </label>

              <div className={`grid grid-cols-2 gap-3 ${!selectedModel.features.frames ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                {/* Start Frame */}
                <div className="border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center z-10">
                    <span className="text-xs text-white">点击上传</span>
                  </div>
                  <ImageIcon size={20} className="text-zinc-600 group-hover:text-zinc-400" />
                  <span className="text-[10px] text-zinc-500">首帧图片</span>
                </div>
                {/* End Frame */}
                <div className="border border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl aspect-[16/9] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-600 transition-all group">
                   <ImageIcon size={20} className="text-zinc-600 group-hover:text-zinc-400" />
                   <span className="text-[10px] text-zinc-500">尾帧图片</span>
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
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
                        aspectRatio === ratio.value
                          ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`border border-current rounded-sm ${ratio.icon}`} />
                      <span className="text-[10px]">{ratio.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>时长</span>
                  <span className="text-zinc-300">4s</span>
                </div>
                <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                   <div className="absolute left-0 top-0 h-full w-1/3 bg-zinc-500 rounded-full"></div>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                  <span>2s</span>
                  <span>4s</span>
                  <span>6s</span>
                  <span>8s</span>
                </div>
              </div>
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
                 <button className="text-[10px] px-2 py-1 bg-zinc-800 text-white rounded border border-zinc-700">全部</button>
                 <button className="text-[10px] px-2 py-1 bg-zinc-900 text-zinc-500 rounded border border-zinc-800 hover:border-zinc-700">收藏</button>
                 <button className="text-[10px] px-2 py-1 bg-zinc-900 text-zinc-500 rounded border border-zinc-800 hover:border-zinc-700">失败</button>
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
