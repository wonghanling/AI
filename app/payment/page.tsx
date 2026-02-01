'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import Image from 'next/image';
import { ArrowLeft, Check, Loader2, Info } from 'lucide-react';
import Link from 'next/link';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'pro';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  // 定义功能项类型
  type Feature = {
    text: string;
    hasTooltip: boolean;
    tooltip?: string;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.push('/auth/login');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      } else {
        router.push('/auth/login');
      }
    };
    checkAuth();
  }, [router]);

  const planDetails: {
    free: {
      name: string;
      nameEn: string;
      price: number;
      features: Feature[];
    };
    pro: {
      name: string;
      nameEn: string;
      price: number;
      features: Feature[];
    };
  } = {
    free: {
      name: '免费版',
      nameEn: 'Free Plan',
      price: 0,
      features: [
        { text: '高级模型每天 3 次', hasTooltip: false },
        { text: '普通模型每天 10 次', hasTooltip: false },
        { text: '基础功能访问', hasTooltip: false },
      ]
    },
    pro: {
      name: '专业版',
      nameEn: 'Professional Plan',
      price: 115,
      features: [
        { text: '无限访问高级模型', hasTooltip: true, tooltip: '每月保证至少1,600次高级模型调用，超出部分根据使用情况提供' },
        { text: '无限访问普通模型', hasTooltip: false },
        { text: '高级 UI 和图像生成', hasTooltip: false },
        { text: '优先客服支持', hasTooltip: false },
      ]
    }
  };

  const currentPlan = planDetails[plan as keyof typeof planDetails] || planDetails.pro;

  const handlePayment = async () => {
    if (plan === 'free') {
      // 免费版直接跳转到首页
      router.push('/');
      return;
    }

    // 立即显示加载状态，提升响应速度
    setLoading(true);
    setError('');

    // 使用 setTimeout 确保 UI 立即更新
    setTimeout(async () => {
      try {
        // 获取认证 token
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('请先登录');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('登录已过期，请重新登录');
        }

        // 调用支付宝支付 API
        const response = await fetch('/api/payment/alipay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            plan: 'subscription', // 符合数据库约束：'subscription' 或 'credits'
            amount: currentPlan.price,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '创建支付订单失败');
        }

        // 直接在当前页面渲染支付宝表单并自动提交
        if (data.paymentForm) {
          // 创建一个临时的 div 来渲染表单
          const div = document.createElement('div');
          div.innerHTML = data.paymentForm;
          document.body.appendChild(div);

          // 自动提交表单
          const form = div.querySelector('form');
          if (form) {
            form.submit();
          }
        } else {
          throw new Error('未获取到支付表单');
        }
      } catch (err: any) {
        setError(err.message || '支付失败，请重试');
        setLoading(false);
      }
    }, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-medium">返回首页</span>
        </Link>

        {/* Payment Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-black to-gray-800 p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logo.png"
                alt="Boluolab"
                width={40}
                height={40}
                className="object-contain"
              />
              <h1 className="text-2xl font-bold">Boluolab</h1>
            </div>
            <h2 className="text-3xl font-bold mb-2">{currentPlan.name}</h2>
            <p className="text-white/70 text-sm">{currentPlan.nameEn}</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* User Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">账号</p>
              <p className="font-medium text-gray-900">{userEmail}</p>
            </div>

            {/* Price */}
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center mb-2">
                <span className="text-6xl font-bold text-black">¥{currentPlan.price}</span>
                <span className="text-gray-500 ml-3 text-xl">/月</span>
              </div>
              <p className="text-sm text-gray-400">按月付费，随时取消</p>
            </div>

            {/* Features */}
            <div className="mb-8">
              <h3 className="font-bold text-lg mb-4 text-gray-900">包含功能</h3>
              <ul className="space-y-3">
                {currentPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#F5C518] flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="text-black" />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-700">{feature.text}</span>
                      {feature.hasTooltip && feature.tooltip && (
                        <div className="relative group">
                          <Info
                            size={16}
                            className="text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                          />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                            {feature.tooltip}
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-[#F5C518] hover:bg-[#E6B800] text-black py-4 rounded-full font-bold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>处理中...</span>
                </>
              ) : (
                <span>{plan === 'free' ? '开始使用' : '前往支付宝支付'}</span>
              )}
            </button>

            {/* Payment Info */}
            {plan !== 'free' && (
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  点击按钮后将跳转到支付宝官方页面
                </p>
                <p className="text-xs text-gray-400">
                  电脑端：扫码支付 | 手机端：唤起支付宝 APP
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 安全支付由支付宝提供保障</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-[#F5C518] mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
