'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { ArrowLeft, Zap, Check, Loader2 } from 'lucide-react';

// 积分套餐配置
const CREDIT_PACKAGES = [
  {
    id: 'credits_10',
    credits: 100,
    price: 10,
    label: '入门套餐',
  },
  {
    id: 'credits_50',
    credits: 500,
    price: 50,
    label: '标准套餐',
    popular: true,
  },
  {
    id: 'credits_100',
    credits: 1000,
    price: 100,
    label: '超值套餐',
  },
];

// 积分定价说明
const PRICING_INFO = [
  { model: 'Nano Banana', resolution: '1K', credits: 5, price: 0.5 },
  { model: 'Nano Banana', resolution: '2K', credits: 9, price: 0.9 },
  { model: 'Nano Banana Pro', resolution: '1K', credits: 9, price: 0.9 },
  { model: 'Nano Banana Pro', resolution: '2K', credits: 15, price: 1.5 },
  { model: 'Nano Banana Pro', resolution: '4K', credits: 25, price: 2.5 },
];

export default function RechargeCreditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [currentCredits, setCurrentCredits] = useState(0);

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

        // 获取当前积分
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
              setCurrentCredits(data.balance || 0);
            }
          } catch (err) {
            console.error('获取积分失败:', err);
          }
        }
      } else {
        router.push('/auth/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleRecharge = async (pkg: typeof CREDIT_PACKAGES[0]) => {
    setLoading(true);
    setError('');

    try {
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
          plan: 'credits',
          amount: pkg.price,
          credits: pkg.credits,
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 返回按钮 */}
        <Link href="/image" className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-medium">返回图片生成</span>
        </Link>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">充值积分</h1>
          <p className="text-gray-600">选择适合您的积分套餐</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200">
            <span className="text-sm text-gray-600">当前积分：</span>
            <span className="text-lg font-bold text-purple-600">{currentCredits}</span>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 max-w-2xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* 积分套餐 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${
                pkg.popular
                  ? 'border-purple-500 shadow-lg'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  推荐
                </div>
              )}

              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-2">{pkg.label}</div>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {pkg.credits}
                  <span className="text-lg text-gray-500 ml-1">积分</span>
                </div>
                <div className="mt-4 text-3xl font-bold text-purple-600">
                  ¥{pkg.price}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(pkg.price / pkg.credits * 10).toFixed(1)} 分/积分
                </div>
              </div>

              <button
                onClick={() => handleRecharge(pkg)}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    处理中...
                  </span>
                ) : (
                  '立即充值'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* 积分定价说明 */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            积分消耗说明
          </h2>

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium mb-4">
              <span>1 积分 = ¥0.1</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">模型</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">分辨率</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">消耗积分</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">约等于</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_INFO.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{item.model}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.resolution}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-purple-600">
                      {item.credits} 积分
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">
                      ¥{item.price.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>积分永久有效，不会过期</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>充值成功后积分立即到账</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>支持支付宝安全支付</span>
            </div>
          </div>
        </div>

        {/* 安全提示 */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 安全支付由支付宝提供保障</p>
        </div>
      </div>
    </div>
  );
}
