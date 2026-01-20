'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('正在验证支付结果...');

  useEffect(() => {
    // 从 URL 参数获取支付结果
    const outTradeNo = searchParams.get('out_trade_no');
    const tradeNo = searchParams.get('trade_no');
    const totalAmount = searchParams.get('total_amount');

    if (outTradeNo && tradeNo) {
      // 支付成功
      setStatus('success');
      setMessage('支付成功！您的订阅已激活。');

      // 3秒后跳转到首页
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } else {
      // 检查是否有错误信息
      const error = searchParams.get('error');
      if (error) {
        setStatus('failed');
        setMessage('支付失败，请重试。');
      } else {
        // 默认显示成功（支付宝会通过 return_url 返回）
        setStatus('success');
        setMessage('支付成功！您的订阅已激活。');

        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="BoLuoing"
              width={60}
              height={60}
              className="object-contain"
            />
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <Loader2 size={64} className="text-[#F5C518] animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle size={64} className="text-green-500" />
            )}
            {status === 'failed' && (
              <XCircle size={64} className="text-red-500" />
            )}
          </div>

          {/* Message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'loading' && '处理中'}
              {status === 'success' && '支付成功'}
              {status === 'failed' && '支付失败'}
            </h1>
            <p className="text-gray-600">{message}</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {status === 'success' && (
              <p className="text-center text-sm text-gray-500">
                3 秒后自动跳转到首页...
              </p>
            )}

            <Link
              href="/"
              className="block w-full bg-[#F5C518] hover:bg-[#E6B800] text-black py-3 rounded-full font-bold text-center transition-all shadow-lg"
            >
              返回首页
            </Link>

            {status === 'failed' && (
              <Link
                href="/payment?plan=pro"
                className="block w-full border-2 border-black text-black hover:bg-black hover:text-white py-3 rounded-full font-bold text-center transition-all"
              >
                重新支付
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-8">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo.png"
                alt="BoLuoing"
                width={60}
                height={60}
                className="object-contain"
              />
            </div>
            <div className="flex justify-center mb-6">
              <Loader2 size={64} className="text-[#F5C518] animate-spin" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">加载中</h1>
              <p className="text-gray-600">正在验证支付结果...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
