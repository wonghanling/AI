'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronRight, Shield, Zap, RefreshCw, CreditCard, Globe, Share2, Info, Check } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { getCachedUser, setCachedUser, clearCachedUser } from '@/lib/user-cache';

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<'free' | 'pro' | null>(null);

  // 检查登录状态
  useEffect(() => {
    const checkUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      // 先从缓存加载用户信息（立即显示）
      const cached = getCachedUser();
      if (cached) {
        setUser(cached.user);
        setLoading(false);
      }

      // 然后从API获取最新用户信息（后台更新）
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);

      // 更新缓存
      if (user) {
        setCachedUser(user);
      } else {
        clearCachedUser();
      }
    };

    checkUser();
  }, []);

  const handleSubscribe = async (plan: 'free' | 'pro') => {
    // 防止重复点击
    if (subscribing) return;

    // 立即设置 loading 状态
    setSubscribing(plan);

    // 使用 requestAnimationFrame 确保立即响应
    requestAnimationFrame(() => {
      if (user) {
        // 已登录，跳转到支付页面
        router.push(`/payment?plan=${plan}`);
      } else {
        // 未登录，跳转到注册页面
        router.push('/auth/register');
      }
    });
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      clearCachedUser(); // 清除用户缓存
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Boluolab"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="font-bold text-lg md:text-xl tracking-tight">Boluolab</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
            <Link href="#models" className="hover:text-black transition-colors">模型</Link>
            <Link href="#pricing" className="hover:text-black transition-colors">价格</Link>
            <Link href="#features" className="hover:text-black transition-colors">功能</Link>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {loading ? (
              <div className="w-16 md:w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
            ) : user ? (
              <>
                <span className="hidden sm:inline text-xs md:text-sm font-medium text-gray-700 truncate max-w-[100px] md:max-w-none">{user.email}</span>
                <Link href="/orders" className="text-xs md:text-sm font-medium text-gray-700 hover:text-black whitespace-nowrap">
                  订单
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs md:text-sm font-medium text-gray-700 hover:text-black whitespace-nowrap"
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-xs md:text-sm font-medium text-gray-700 hover:text-black">登录</Link>
                <Link href="/auth/register" className="bg-[#F5C518] hover:bg-[#E6B800] text-black px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all shadow-sm whitespace-nowrap">
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-32 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-3">
            所有顶级 AI, <span className="text-black">一站式使用.</span>
          </h1>
          <p className="text-sm text-gray-500 mb-8 tracking-wide">Every Leading AI Model, Unified in One Seamless Platform.</p>
          <p className="text-xl text-gray-600 mb-2 max-w-2xl mx-auto leading-relaxed">
            通过统一界面, 轻松访问全球领先的 AI 模型.<br />
            告别多个订阅与复杂配置, 一个账号就够了.
          </p>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto mb-10">
            Access the world's leading AI models through a unified interface.<br />
            Say goodbye to multiple subscriptions and complex configurations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link href="/chat" className="w-full sm:w-auto bg-[#F5C518] hover:bg-[#E6B800] text-black px-12 py-4 rounded-full font-bold text-lg transition-all shadow-lg">
                开始使用
              </Link>
            ) : (
              <Link href="/auth/register" className="w-full sm:w-auto bg-[#F5C518] hover:bg-[#E6B800] text-black px-12 py-4 rounded-full font-bold text-lg transition-all shadow-lg">
                免费开始
              </Link>
            )}
            <Link href="#models" className="w-full sm:w-auto border-2 border-black text-black hover:bg-black hover:text-white px-12 py-4 rounded-full font-bold text-lg transition-all">
              查看模型
            </Link>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-8 text-sm text-gray-400 uppercase tracking-widest">Models</span>
        </div>
      </div>

      {/* Model Cards */}
      <section id="models" className="py-20 px-6 bg-gradient-to-b from-gray-100 to-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold">智能触手可及</h2>
            <p className="text-sm text-gray-400 mt-1">Intelligence at Your Fingertips</p>
          </div>

        {/* 高级模型 */}
        <div className="mb-8">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-700">高级模型 · 免费用户每天 3 次</h3>
            <p className="text-xs text-gray-400 mt-0.5">Premium Models · 3 free uses per day</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
            {[
              { name: 'GPT-5.2', desc: '最强大的推理和指令遵循能力.', icon: '/openai.svg', badge: 'PRO', modelKey: 'gpt-5.2' },
              { name: 'Claude Sonnet 4', desc: '卓越的创意写作和细腻理解.', icon: '/claude-color.svg', badge: null, modelKey: 'claude-sonnet-4' },
              { name: 'Gemini Pro', desc: 'Google 最强模型, 多模态输入.', icon: '/gemini-color.svg', badge: null, modelKey: 'gemini-pro' },
              { name: 'Grok', desc: '实时知识整合, 风趣大胆.', icon: '/grok.svg', badge: null, modelKey: 'grok' },
            ].map((model, i) => (
              <div
                key={i}
                onClick={() => router.push(`/chat?model=${model.modelKey}`)}
                className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
                style={{ transform: 'translateZ(0)' }}>
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:brightness-110 transition-all overflow-hidden">
                  <Image
                    src={model.icon}
                    alt={model.name}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-lg">{model.name}</h3>
                  {model.badge && (
                    <span className="bg-[#FDB022] text-black text-[10px] font-bold px-2 py-0.5 rounded">
                      {model.badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{model.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 普通模型 */}
        <div className="mb-8">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-700">普通模型 · 免费用户每天 10 次</h3>
            <p className="text-xs text-gray-400 mt-0.5">Standard Models · 10 free uses per day</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
            {[
              { name: 'GPT-4o Mini', desc: '轻量高效, 快速响应.', icon: '/openai.svg', modelKey: 'gpt-4.1-mini' },
              { name: 'Grok 3 Mini', desc: '快速响应, 适合日常对话.', icon: '/grok.svg', modelKey: 'claude-haiku' },
              { name: 'Gemini 2.5 Flash lite', desc: '高速处理, 性价比之选.', icon: '/gemini-color.svg', modelKey: 'gemini-flash' },
            ].map((model, i) => (
              <div
                key={i}
                onClick={() => router.push(`/chat?model=${model.modelKey}`)}
                className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
                style={{ transform: 'translateZ(0)' }}>
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:brightness-110 transition-all overflow-hidden">
                  <Image
                    src={model.icon}
                    alt={model.name}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <h3 className="font-bold text-lg mb-2">{model.name}</h3>
                <p className="text-gray-600 text-xs leading-relaxed">{model.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 图片模型 */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-700">图片模型 · 按次付费</h3>
            <p className="text-xs text-gray-400 mt-0.5">Image Models · Pay per use</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
            <div
              onClick={() => router.push('/image')}
              className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}>
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:brightness-110 transition-all overflow-hidden">
                <Image
                  src="/banana-svgrepo-com.svg"
                  alt="Nano Banana Pro"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <h3 className="font-bold text-lg mb-2">Nano Banana Pro</h3>
              <p className="text-gray-600 text-xs leading-relaxed">AI 图片生成, ¥0.9/张.</p>
            </div>

            <div
              onClick={() => router.push('/image/pro')}
              className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all">
                  <Image
                    src="/midjourney.svg"
                    alt="Midjourney"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all">
                  <Image
                    src="/stability-color.svg"
                    alt="Stability AI"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all">
                  <Image
                    src="/flux.svg"
                    alt="Flux"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
              </div>
              <h3 className="font-bold text-lg mb-2">顶级图片模型</h3>
              <p className="text-gray-600 text-xs leading-relaxed">Midjourney, Flux, SDXL 等顶级模型.</p>
            </div>
          </div>
        </div>

        {/* 视频模型 */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-700">视频模型 · 按次付费</h3>
            <p className="text-xs text-gray-400 mt-0.5">Video Models · Pay per use</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
            <div
              onClick={() => router.push('/video')}
              className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all p-1.5">
                  <img
                    src="/sora-color.svg"
                    alt="Sora"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-gray-800 to-black rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all p-1.5 text-white">
                  <img
                    src="/runway.svg"
                    alt="Runway"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain brightness-0 invert"
                  />
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all p-1.5">
                  <img
                    src="/gemini-video.svg"
                    alt="Gemini"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </div>
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center group-hover:brightness-110 transition-all">
                  <img
                    src="/grok.svg"
                    alt="Grok"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </div>
              </div>
              <h3 className="font-bold text-lg mb-2">AI 视频生成</h3>
              <p className="text-gray-600 text-xs leading-relaxed">Sora, Runway, Veo3 等顶级视频模型.</p>
            </div>

            <div
              onClick={() => window.open('https://boluolab.com', '_blank')}
              className="bg-white p-6 rounded-2xl border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200 group cursor-pointer active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}>
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:brightness-110 transition-all overflow-hidden">
                <span className="text-2xl font-bold text-black">∞</span>
              </div>
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                BoLou1971 无限画布
                <span className="text-xs font-normal text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">开发中</span>
              </h3>
              <p className="text-gray-600 text-xs leading-relaxed">创意无限, 自由绘制你的想象.</p>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Divider with Gradient */}
      <div className="relative bg-gradient-to-b from-gray-200 to-white py-8">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-400"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gradient-to-b from-gray-200 to-white px-8 text-sm text-gray-500 uppercase tracking-widest font-semibold">Features</span>
        </div>
      </div>

      {/* Features & Preview */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-2 leading-tight">为个人和专业用户打造</h2>
            <p className="text-sm text-gray-400 mb-12">Built for Individuals and Professionals</p>
            <div className="space-y-10">
              <div className="flex gap-5">
                <div className="w-12 h-12 shrink-0 bg-black rounded-full flex items-center justify-center text-white">
                  <RefreshCw size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">无缝切换</h4>
                  <p className="text-xs text-gray-400 mb-2">Seamless Switching</p>
                  <p className="text-gray-600 leading-relaxed">对话中随时切换模型, 充分利用不同架构的优势.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 shrink-0 bg-black rounded-full flex items-center justify-center text-white">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">统一计费</h4>
                  <p className="text-xs text-gray-400 mb-2">Unified Billing</p>
                  <p className="text-gray-600 leading-relaxed">一个月费账单. 无需为 OpenAI, Anthropic 和 Google 分别订阅.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 shrink-0 bg-black rounded-full flex items-center justify-center text-white">
                  <Shield size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">隐私优先</h4>
                  <p className="text-xs text-gray-400 mb-2">Privacy First</p>
                  <p className="text-gray-600 leading-relaxed">您的数据永不用于训练. 企业级加密标配.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Preview UI with Foggy Teal Background */}
          <div className="relative">
            {/* Foggy teal gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 rounded-3xl blur-3xl"></div>

            <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
              {/* macOS style dots */}
              <div className="p-4 border-b border-gray-100 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#F5C518]"></div>
                <div className="w-3 h-3 rounded-full bg-[#F5C518]"></div>
                <div className="w-3 h-3 rounded-full bg-[#F5C518]"></div>
              </div>

              <div className="p-6 space-y-6 h-[400px] overflow-y-auto bg-gradient-to-b from-white to-gray-50">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-gray-100 p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-sm border border-gray-200">
                    How does the context window of Claude 3 Opus compare to GPT-4 Turbo?
                  </div>
                </div>

                {/* AI response */}
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-sm max-w-[80%] text-sm border border-gray-200">
                    Claude 3 Opus features a 200k token context window, while GPT-4 Turbo typically operates with 128k...
                  </div>
                </div>

                {/* Switch indicator */}
                <div className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-widest py-2">
                  SWITCHED TO GEMINI PRO 1.5
                </div>

                {/* Another AI response */}
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-sm max-w-[80%] text-sm border border-gray-200">
                    Actually, let me show you a comparison chart for
                  </div>
                </div>
              </div>

              {/* Input area */}
              <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-100">
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between text-sm text-gray-400 shadow-sm">
                  <span className="italic">Type your message...</span>
                  <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                    <ChevronRight className="text-white" size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider - Features to Pricing */}
      <div className="relative bg-gradient-to-b from-white to-gray-100 py-8">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-400"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gradient-to-b from-white to-gray-100 px-8 text-sm text-gray-500 uppercase tracking-widest font-semibold">Pricing</span>
        </div>
      </div>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-gradient-to-b from-gray-100 to-gray-200">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold mb-2">一个价格, 全部功能</h2>
          <p className="text-sm text-gray-400">One Price, All Features</p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl p-6 md:p-10 border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] relative">
            <div className="text-center mb-8">
              <h3 className="font-bold text-lg mb-1">免费版</h3>
              <p className="text-xs text-gray-400 mb-3">Free Plan</p>
              <div className="flex items-center justify-center">
                <span className="text-5xl font-bold">¥0</span>
                <span className="text-gray-500 ml-2 font-medium">/月</span>
              </div>
            </div>

            <ul className="space-y-4 mb-10 text-sm">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">高级模型每天 3 次</div>
                  <div className="text-xs text-gray-400 mt-0.5">3 premium model uses per day</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/openai.svg" alt="GPT" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">GPT-5.2</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/claude-color.svg" alt="Claude" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Claude Sonnet 4</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/gemini-color.svg" alt="Gemini" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Gemini Pro</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/grok.svg" alt="Grok" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Grok</span>
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">普通模型每天 10 次</div>
                  <div className="text-xs text-gray-400 mt-0.5">10 standard model uses per day</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/claude-color.svg" alt="Claude" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Claude Haiku</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/gemini-color.svg" alt="Gemini" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Gemini Flash</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/openai.svg" alt="GPT" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">GPT-4.1 mini</span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('free')}
              disabled={subscribing !== null}
              className="block w-full h-[52px] bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-black rounded-full font-bold transition-colors mb-2 text-center relative overflow-hidden active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}
            >
              {subscribing === 'free' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  跳转中...
                </span>
              ) : (
                '免费开始'
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mb-4">Start for Free</p>
            <p className="text-xs text-gray-500 text-center">无需信用卡</p>
            <p className="text-xs text-gray-400 text-center">No credit card required</p>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl p-6 md:p-10 border-t-2 border-r-2 border-black border-l-[6px] border-b-[6px] border-l-black border-b-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] relative overflow-hidden">
            {/* Popular Badge */}
            <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
              <div className="absolute top-4 right-[-32px] bg-[#F5C518] text-black text-xs font-bold py-1 px-8 rotate-45 shadow-md">
                POPULAR
              </div>
            </div>

            <div className="text-center mb-8">
              <h3 className="font-bold text-lg mb-1">专业版</h3>
              <p className="text-xs text-gray-400 mb-3">Professional Plan</p>
              <div className="flex items-center justify-center">
                <span className="text-5xl font-bold">¥115</span>
                <span className="text-gray-500 ml-2 font-medium">/月</span>
              </div>
            </div>

            <ul className="space-y-4 mb-10 text-sm">
              {/* Unlimited Premium Models with Info */}
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">无限访问高级模型</div>
                    <div className="group relative">
                      <Info size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                        <p className="text-xs text-gray-600 leading-relaxed mb-2">
                          确保每月 1,600 次无限制高级查询. 超过 1600 次后, 为防止滥用, 请求频率可能受限.
                        </p>
                        <a href="#" className="text-xs text-blue-500 hover:underline">查看详情</a>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Unlimited premium model access</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/openai.svg" alt="GPT" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">GPT-5.2</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/claude-color.svg" alt="Claude" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Claude Sonnet 4</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/gemini-color.svg" alt="Gemini" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Gemini Pro</span>
                    </div>
                  </div>
                </div>
              </li>

              {/* Unlimited Standard Models with Info */}
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">无限访问普通模型</div>
                    <div className="group relative">
                      <Info size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                        <p className="text-xs text-gray-600 leading-relaxed mb-2">
                          确保每月 1,600 次无限制高级查询. 超过 1600 次后, 为防止滥用, 请求频率可能受限.
                        </p>
                        <a href="#" className="text-xs text-blue-500 hover:underline">查看详情</a>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Unlimited standard model access</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/claude-color.svg" alt="Claude" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Claude Haiku</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/gemini-color.svg" alt="Gemini" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Gemini Flash</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/openai.svg" alt="GPT" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">GPT-4.1 mini</span>
                    </div>
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">高级 UI 和图像生成</div>
                  <div className="text-xs text-gray-400 mt-0.5">Advanced UI and image generation</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <Image src="/banana-svgrepo-com.svg" alt="Nano Banana Pro" width={14} height={14} className="object-contain" />
                      <span className="text-xs text-gray-600">Nano Banana Pro</span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('pro')}
              disabled={subscribing !== null}
              className="block w-full h-[52px] bg-[#F5C518] hover:bg-[#E6B800] disabled:bg-[#D4A800] disabled:cursor-not-allowed text-black rounded-full font-bold transition-colors mb-2 text-center shadow-lg relative overflow-hidden active:scale-[0.98] will-change-transform"
              style={{ transform: 'translateZ(0)' }}
            >
              {subscribing === 'pro' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  跳转中...
                </span>
              ) : (
                '立即订阅'
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mb-4">Subscribe Now</p>
            <p className="text-xs text-gray-500 text-center">按月付费, 随时取消.</p>
            <p className="text-xs text-gray-400 text-center">Monthly billing, cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <Image
                  src="/logo.png"
                  alt="Boluolab"
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <span className="font-bold text-xl tracking-tight">Boluolab</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed max-w-[240px]">
                全球最先进人工智能的终极目的地. 一个界面, 无限可能.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[240px] mt-2">
                The ultimate destination for the world's most advanced AI. One interface, unlimited possibilities.
              </p>
            </div>

            <div>
              <h5 className="font-bold mb-6 text-sm uppercase tracking-wider text-gray-400">产品</h5>
              <ul className="space-y-4 text-sm font-medium text-gray-600">
                <li><Link href="#models" className="hover:text-black">模型对比</Link></li>
                <li><Link href="/chat" className="hover:text-black">开始对话</Link></li>
                <li><Link href="/dashboard" className="hover:text-black">用户中心</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-6 text-sm uppercase tracking-wider text-gray-400">公司</h5>
              <ul className="space-y-4 text-sm font-medium text-gray-600">
                <li><a href="#" className="hover:text-black">关于我们</a></li>
                <li><a href="#" className="hover:text-black">隐私政策</a></li>
                <li><a href="#" className="hover:text-black">服务条款</a></li>
                <li><a href="#" className="hover:text-black">联系我们</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-6 text-sm uppercase tracking-wider text-gray-400">社交</h5>
              <div className="flex gap-4">
                <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all">
                  <Globe size={18} />
                </button>
                <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all">
                  <Share2 size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-200 text-xs text-gray-500">
            <p>© 2026 Boluolab. 保留所有权利.</p>
            <p>为智能的未来而生.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
