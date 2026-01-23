'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';

// 模型配置
const MODELS = {
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana',
    displayName: 'Nano Banana',
    isPro: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    resolutions: {
      '1K': { label: '1K', size: 1024, credits: 5 },
      '2K': { label: '2K', size: 2048, credits: 9 },
    }
  },
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    displayName: 'Nano Banana Pro',
    isPro: true,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
    resolutions: {
      '1K': { label: '1K', size: 1024, credits: 15 },
      '2K': { label: '2K', size: 2048, credits: 20 },
      '4K': { label: '4K', size: 4096, credits: 40 },
    }
  }
};

// 生成数量选项
const IMAGE_COUNTS = [
  { value: 1, label: '1x', cooldown: 10 },
  { value: 2, label: '2x', cooldown: 20 },
  { value: 4, label: '4x', cooldown: 30 },
];

function ImageGenerationContent() {
  const [selectedModel, setSelectedModel] = useState<'nano-banana' | 'nano-banana-pro'>('nano-banana-pro');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [imageCount, setImageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false); // 移动端侧边栏控制
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // 上传的图片 base64
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string;
    url: string;
    prompt: string;
    size: string;
  }>>([]);

  const currentModel = MODELS[selectedModel];

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }

    // 检查文件类型
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('只支持 PNG、JPG、JPEG、WebP 格式');
      return;
    }

    // 读取文件并转换为 base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setError('');
    };
    reader.onerror = () => {
      setError('图片读取失败');
    };
    reader.readAsDataURL(file);
  };

  // 清除上传的图片
  const clearUploadedImage = () => {
    setUploadedImage(null);
  };

  // 获取用户积分
  useEffect(() => {
    const fetchCredits = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setCredits(0); // 未登录积分为0
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCredits(0); // 未登录积分为0
        return;
      }

      try {
        const response = await fetch('/api/user/credits', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCredits(data.balance || 0);
        }
      } catch (err) {
        console.error('获取积分失败:', err);
        setCredits(100);
      }
    };

    fetchCredits();
  }, []);

  // 获取历史记录
  useEffect(() => {
    const fetchHistory = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      try {
        const response = await fetch('/api/image/history?limit=50', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const formattedImages = data.images.map((img: any) => ({
            id: img.id,
            url: img.image_url,
            prompt: img.prompt,
            size: img.size
          }));
          setGeneratedImages(formattedImages);
        }
      } catch (err) {
        console.error('获取历史记录失败:', err);
      }
    };

    fetchHistory();
  }, []);

  // 冷却倒计时
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // 计算总积分消耗
  const calculateTotalCredits = () => {
    const resolutionCredits = currentModel.resolutions[resolution as keyof typeof currentModel.resolutions]?.credits || 0;
    return resolutionCredits * imageCount;
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入图片描述');
      return;
    }

    if (prompt.length > 500) {
      setError('描述不能超过 500 字');
      return;
    }

    if (cooldownSeconds > 0) {
      setError(`请等待 ${cooldownSeconds} 秒后再生成`);
      return;
    }

    const totalCredits = calculateTotalCredits();
    if (credits < totalCredits) {
      setError(`积分不足，需要 ${totalCredits} 积分`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();

      // 模拟模式
      if (!supabase) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const newImages = Array.from({ length: imageCount }, (_, i) => ({
          id: `${Date.now()}-${i}`,
          url: `https://via.placeholder.com/1024x1024?text=Generated+Image+${i + 1}`,
          prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
          size: `${resolution} ${aspectRatio}`
        }));

        setGeneratedImages([...newImages, ...generatedImages]);
        setCredits(credits - totalCredits);
        setCooldownSeconds(IMAGE_COUNTS.find(c => c.value === imageCount)?.cooldown || 10);
        setLoading(false);
        return;
      }

      // 真实模式
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setLoading(false);
        return;
      }

      // 调用 API
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          prompt: prompt,
          model: selectedModel,
          aspectRatio: aspectRatio,
          resolution: resolution,
          count: imageCount,
          imageUrl: uploadedImage, // 添加上传的图片
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      // 成功生成
      const newImages = data.images.map((img: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        url: img.url,
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        size: `${resolution} ${aspectRatio}`
      }));

      setGeneratedImages([...newImages, ...generatedImages]);
      setCredits(data.remainingBalance);
      setCooldownSeconds(IMAGE_COUNTS.find(c => c.value === imageCount)?.cooldown || 10);

    } catch (err: any) {
      console.error('生成失败:', err);
      setError(err.message || '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 移动端遮罩层 */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* 左侧边栏 - 移动端可滑出 */}
      <aside className={`
        fixed md:relative
        w-48 bg-white border-r border-gray-200 flex flex-col
        h-full z-50
        transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center font-bold text-black text-lg">
              B
            </div>
            <span className="font-semibold">Nano Banana</span>
          </Link>
        </div>

        <nav className="flex-1 p-3">
          <div className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              主页
            </Link>

            <Link href="/image/pro" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              专业版
            </Link>

            <button
              onClick={() => setSelectedModel('nano-banana')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                selectedModel === 'nano-banana'
                  ? 'bg-[#F5C518] text-black font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Nano Banana
            </button>

            <button
              onClick={() => setSelectedModel('nano-banana-pro')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                selectedModel === 'nano-banana-pro'
                  ? 'bg-[#F5C518] text-black font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Nano Banana Pro
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-[#F5C518] text-black rounded-lg p-3 text-center">
            <div className="text-xs mb-1 font-semibold">剩余积分</div>
            <div className="text-2xl font-bold">{credits}</div>
            <Link href="/credits/recharge" className="mt-2 text-xs underline hover:no-underline inline-block font-semibold">
              充值
            </Link>
          </div>
        </div>
      </aside>

      {/* 中间内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-8">
          {/* 移动端顶部栏 */}
          <div className="md:hidden flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold">{currentModel.displayName}</h1>
            <div className="text-sm font-medium text-gray-900">{credits} 积分</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-8 mb-6">
            <h1 className="hidden md:block text-2xl font-bold mb-2">{currentModel.displayName}</h1>
            <p className="hidden md:block text-sm text-gray-500 mb-6">已上传图片</p>

            {/* 错误提示 */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 上传图片区域 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上传图片（可选）
              </label>
              {uploadedImage ? (
                <div className="relative border-2 border-gray-300 rounded-lg p-4">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <button
                    onClick={clearUploadedImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    title="删除图片"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#F5C518] transition-colors block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={loading}
                  />
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-600 mb-1">点击上传或拖放文件</p>
                  <p className="text-xs text-gray-400">PNG、JPG、JPEG、WebP，最大10MB</p>
                </label>
              )}
            </div>

            {/* Prompt 输入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                placeholder="描述您想要生成的图片..."
                className="w-full h-24 px-3 md:px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C518] focus:border-transparent resize-none text-sm md:text-base"
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs ${prompt.length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
                  {prompt.length}/500
                </span>
                {cooldownSeconds > 0 && (
                  <span className="text-xs text-orange-500 font-medium">
                    冷却中: {cooldownSeconds}秒
                  </span>
                )}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={loading}
                className="w-full px-3 md:px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C518] text-sm md:text-base"
              >
                {currentModel.aspectRatios.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C518] text-sm"
              >
                {Object.entries(currentModel.resolutions).map(([key, res]) => (
                  <option key={key} value={key}>
                    {res.label} - {res.credits} 积分
                  </option>
                ))}
              </select>
            </div>

            {/* Number of Images */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Images
              </label>
              <select
                value={imageCount}
                onChange={(e) => setImageCount(parseInt(e.target.value))}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C518] text-sm"
              >
                {IMAGE_COUNTS.map((count) => (
                  <option key={count.value} value={count.value}>
                    {count.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 重要提示 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-gray-800">
                  <div className="font-semibold mb-1">重要提示</div>
                  <ul className="space-y-1 text-xs">
                    <li>• 积分用于图片生成等算力服务</li>
                    <li>• 积分一经消耗不可退还</li>
                    <li>• 请求提交即消耗积分（生成失败也会扣除）</li>
                    <li>• 同一用户同时只能有 1 个生成任务</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || cooldownSeconds > 0 || credits < calculateTotalCredits()}
              className="w-full bg-[#F5C518] hover:bg-[#E6B800] text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>生成中...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <span>等待 {cooldownSeconds} 秒</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>创建图片 · {calculateTotalCredits()} 积分</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              本次生成将消耗 {calculateTotalCredits()} 积分
            </p>
          </div>

          {/* 生成结果区域 - 移到下面 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-8">
            <h2 className="text-xl font-semibold mb-4">
              {currentModel.displayName} 生成结果
            </h2>

            {generatedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500 mb-1">还没有图片</p>
                <p className="text-xs text-gray-400">简单一步开始创作</p>
                <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-900 font-semibold">1</span>
                    <span>输入图片描述（Prompt）</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-900 font-semibold">2</span>
                    <span>选择宽高比和分辨率</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-900 font-semibold">3</span>
                    <span>点击"创建图片"按钮</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {generatedImages.map((image) => (
                  <div key={image.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="relative w-full h-64 bg-gray-100">
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{image.prompt}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{image.size}</span>
                        <a
                          href={image.url}
                          download
                          className="text-xs text-gray-900 hover:text-black font-medium"
                        >
                          下载
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ImageGenerationPage() {
  return <ImageGenerationContent />;
}
