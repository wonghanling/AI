'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';

// 模型配置
const MODELS = {
  'sdxl': {
    id: 'sdxl',
    name: 'stability-ai/sdxl',
    displayName: 'Stable Diffusion XL',
    credits: 3,
    description: '高质量图片生成，适合各种风格',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  },
  'mj-imagine': {
    id: 'mj-imagine',
    name: 'mj_imagine',
    displayName: 'Midjourney Imagine',
    credits: 6,
    description: 'Midjourney 风格，艺术感强',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  },
  'flux-1.1-pro': {
    id: 'flux-1.1-pro',
    name: 'flux.1.1-pro',
    displayName: 'Flux 1.1 Pro',
    credits: 10,
    description: '最新 Flux 模型，超高质量',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
  },
  'flux-pro': {
    id: 'flux-pro',
    name: 'flux-pro',
    displayName: 'Flux Pro',
    credits: 6,
    description: 'Flux 专业版，质量与速度平衡',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  },
  'flux-schnell': {
    id: 'flux-schnell',
    name: 'flux-schnell',
    displayName: 'Flux Schnell',
    credits: 3,
    description: '快速生成，性价比高',
    aspectRatios: ['1:1', '16:9', '9:16'],
  },
  'doubao': {
    id: 'doubao',
    name: 'doubao-seedream-4-5-251128',
    displayName: '豆包 Seecream',
    credits: 3,
    description: '豆包图片生成，性价比高',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  },
};

type ModelKey = keyof typeof MODELS;

// 生成数量选项
const IMAGE_COUNTS = [
  { value: 1, label: '1张' },
  { value: 2, label: '2张' },
  { value: 4, label: '4张' },
];

function ProImageContent() {
  const [selectedModel, setSelectedModel] = useState<ModelKey>('doubao');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageCount, setImageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // 上传的图片 base64
  const [loadingHistory, setLoadingHistory] = useState(true); // 历史记录加载状态
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string;
    url: string;
    prompt: string;
  }>>([]);

  const currentModel = MODELS[selectedModel];

  // 获取用户积分
  useEffect(() => {
    const fetchCredits = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setCredits(0);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCredits(0);
        return;
      }

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('credits')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setCredits(userData.credits || 0);
        }
      } catch (err) {
        console.error('获取积分失败:', err);
        setCredits(0);
      }
    };

    fetchCredits();
  }, []);

  // 获取历史图片记录
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoadingHistory(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoadingHistory(false);
        return;
      }

      try {
        const response = await fetch('/api/image/history?limit=50&source=pro', {
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
          }));
          setGeneratedImages(formattedImages);
        }
      } catch (err) {
        console.error('获取历史记录失败:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  // 监听模型切换，清除上传的图片（如果切换到不需要图片的模型）
  useEffect(() => {
    if (selectedModel !== 'sdxl' && selectedModel !== 'doubao') {
      setUploadedImage(null);
    }
  }, [selectedModel]);

  // 计算总积分消耗
  const calculateTotalCredits = () => {
    return currentModel.credits * imageCount;
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 检查文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    // 转换为 base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      setError('');
    };
    reader.onerror = () => {
      setError('图片读取失败');
    };
    reader.readAsDataURL(file);
  };

  // 清除上传的图片
  const handleClearImage = () => {
    setUploadedImage(null);
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入图片描述');
      return;
    }

    // 检查必须上传图片的模型是否上传了图片（只有 SDXL 必须上传）
    if (selectedModel === 'sdxl' && !uploadedImage) {
      setError('该模型需要上传一张图片');
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
      if (!supabase) {
        throw new Error('无法连接到服务');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('请先登录');
      }

      const requestBody: any = {
        model: currentModel.name,
        prompt: prompt.trim(),
        aspectRatio,
        count: imageCount,
      };

      // 如果是需要图片的模型，添加图片数据
      if ((selectedModel === 'sdxl' || selectedModel === 'doubao') && uploadedImage) {
        requestBody.imageBase64 = uploadedImage;
      }

      const response = await fetch('/api/image/yunwu/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      // 更新积分
      setCredits(data.remainingBalance);

      // 添加生成的图片到列表
      if (data.images && data.images.length > 0) {
        setGeneratedImages(prev => [...data.images, ...prev]);
      }

      setPrompt('');
      // 生成成功后清除上传的图片
      if (selectedModel === 'sdxl' || selectedModel === 'doubao') {
        setUploadedImage(null);
      }
    } catch (err: any) {
      console.error('生成失败:', err);
      setError(err.message || '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/chat" className="text-xl font-bold text-gray-900">
                BoLuoing AI
              </Link>
              <span className="hidden sm:inline text-sm text-gray-500">专业图片生成</span>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/image"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Nano Banana
              </Link>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#F5C518] text-black rounded-lg font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-semibold">{credits}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：模型选择和参数 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-24">
              {/* 模型选择 */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold mb-4">选择模型</h2>
                <div className="space-y-2">
                  {(Object.keys(MODELS) as ModelKey[]).map((modelKey) => {
                    const model = MODELS[modelKey];
                    return (
                      <button
                        key={modelKey}
                        onClick={() => setSelectedModel(modelKey)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          selectedModel === modelKey
                            ? 'bg-[#F5C518] text-black shadow-md'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="font-semibold">{model.displayName}</div>
                        <div className={`text-xs mt-1 ${selectedModel === modelKey ? 'text-black/70' : 'text-gray-500'}`}>
                          {model.description}
                        </div>
                        <div className={`text-sm mt-1 font-medium ${selectedModel === modelKey ? 'text-black' : 'text-gray-600'}`}>
                          {model.credits} 积分/张
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 参数设置 */}
              <div className="p-6 space-y-4">
                {/* 宽高比 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    宽高比
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent"
                  >
                    {currentModel.aspectRatios.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 生成数量 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    生成数量
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {IMAGE_COUNTS.map((count) => (
                      <button
                        key={count.value}
                        onClick={() => setImageCount(count.value)}
                        className={`py-2 rounded-lg font-medium transition-all ${
                          imageCount === count.value
                            ? 'bg-[#F5C518] text-black'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {count.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 积分消耗提示 */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">本次消耗</span>
                    <span className="text-gray-900 font-bold text-lg">
                      {calculateTotalCredits()} 积分
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：输入和结果 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 输入区域 */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold mb-4">
                {selectedModel === 'sdxl'
                  ? '图片描述（图生图）'
                  : selectedModel === 'doubao' && uploadedImage
                  ? '图片描述（图生图）'
                  : selectedModel === 'doubao' && !uploadedImage
                  ? '图片描述（文生图）'
                  : '图片描述'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 图片上传区域（SDXL 和豆包模型显示） */}
              {(selectedModel === 'sdxl' || selectedModel === 'doubao') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    上传基础图片 {selectedModel === 'sdxl' && <span className="text-red-500">*</span>}
                    {selectedModel === 'doubao' && <span className="text-gray-400 text-xs ml-1">（可选，支持文生图和图生图）</span>}
                  </label>

                  {!uploadedImage ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#F5C518] transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                        disabled={loading}
                      />
                      <label
                        htmlFor="image-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-600">点击上传图片</span>
                        <span className="text-xs text-gray-400 mt-1">支持 JPG、PNG，最大 5MB</span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-gray-300">
                      <img
                        src={uploadedImage}
                        alt="上传的图片"
                        className="w-full h-auto max-h-64 object-contain bg-gray-50"
                      />
                      <button
                        onClick={handleClearImage}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        disabled={loading}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    💡 提示：{selectedModel === 'sdxl'
                      ? '上传一张图片，AI 会根据你的描述修改这张图片'
                      : '可选择上传图片进行图生图，或直接输入描述进行文生图'}
                  </p>
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedModel === 'sdxl'
                    ? "描述你想要如何修改这张图片，例如：把猫咪变成狗狗，保持其他不变..."
                    : selectedModel === 'doubao' && uploadedImage
                    ? "描述你想要如何修改这张图片，例如：把猫咪变成狗狗，保持其他不变..."
                    : selectedModel === 'doubao' && !uploadedImage
                    ? "描述你想要生成的图片，例如：一只可爱的猫咪坐在窗台上，阳光洒在它身上..."
                    : "描述你想要生成的图片，例如：一只可爱的猫咪坐在窗台上，阳光洒在它身上..."
                }
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent resize-none"
                disabled={loading}
              />

              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || credits < calculateTotalCredits()}
                className="w-full mt-4 bg-[#F5C518] hover:bg-[#E6B800] text-black font-bold py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>生成图片 · {calculateTotalCredits()} 积分</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                积分不足？<Link href="/credits/recharge" className="text-[#F5C518] hover:underline font-semibold">立即充值</Link>
              </p>
            </div>

            {/* 生成结果 */}
            {loadingHistory ? (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-bold mb-4">生成结果</h2>
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-[#F5C518]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-gray-600">加载历史记录中...</span>
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">生成结果</h2>
                  <span className="text-sm text-gray-500">
                    {generatedImages.length} / 50
                  </span>
                </div>

                {/* 历史记录提醒 */}
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-amber-800">
                    <span className="font-semibold">重要提示：</span>
                    历史记录最多保存 50 张图片，达到 50 张后生成新图片将自动清空所有历史记录。请及时下载保存您需要的图片！
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generatedImages.map((image) => (
                    <div key={image.id} className="group relative rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-64 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                        {/* 显示提示词（限制长度） */}
                        <p className="text-white text-sm text-center line-clamp-3 mb-2">
                          {image.prompt}
                        </p>
                        <a
                          href={image.url}
                          download
                          className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                          title="下载"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProImagePage() {
  return <ProImageContent />;
}
