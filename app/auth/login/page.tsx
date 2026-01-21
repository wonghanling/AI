'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 检查是否已登录，如果已登录则跳转
  useEffect(() => {
    const checkUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 已登录，跳转到 chat 页面
        router.push('/chat');
      }
    };

    checkUser();
  }, [router]);

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const sendOTP = async () => {
    if (!formData.email) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('无法连接到认证服务');
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: false, // 不自动创建用户，只允许已注册用户登录
        },
      });

      if (otpError) {
        throw otpError;
      }

      setOtpSent(true);
      setCountdown(60);
    } catch (err: any) {
      console.error('发送验证码失败:', err);
      setError(err.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证码登录
  const handleOTPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('无法连接到认证服务');
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otp,
        type: 'email',
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.session) {
        // 登录成功
        const redirect = searchParams.get('redirect');
        if (redirect) {
          router.push(redirect);
        } else {
          router.push('/chat');
        }
      }
    } catch (err: any) {
      console.error('验证码登录失败:', err);
      setError(err.message || '验证码错误或已过期');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('无法连接到认证服务');
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.session) {
        // 登录成功，检查是否有 redirect 参数
        const redirect = searchParams.get('redirect');
        if (redirect) {
          router.push(redirect);
        } else {
          router.push('/chat');
        }
      }
    } catch (err: any) {
      console.error('登录失败:', err);
      setError(err.message || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col lg:flex-row overflow-x-hidden relative">
      {/* 返回首页按钮 */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-50 flex items-center gap-2 text-white hover:text-[#F5C518] transition-colors group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="font-medium">返回首页</span>
      </Link>

      {/* Left Side - Dark Gradient with Card */}
      <section className="lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#121212] via-[#2D2D2F] to-[#F5F5F7] min-h-[40vh] lg:min-h-screen flex">
        {/* Blur Effect */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/20 blur-[120px]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center p-8 lg:p-20">
          <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-12 max-w-lg w-full text-white border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            {/* Title */}
            <h2 className="text-5xl font-semibold tracking-tight leading-tight mb-3">
              一个账号，<br />即刻访问全球领先的 AI 能力。
            </h2>
            <p className="text-sm text-white/50 mb-8">One Account, Instant Access to the World's Leading AI Capabilities.</p>

            {/* Description */}
            <p className="text-lg text-white/60 font-light leading-relaxed mb-2">
              不再为模型选择而犹豫，<br />
              不再为平台切换而分心。
            </p>
            <p className="text-sm text-white/50 mb-6">No More Hesitation in Model Selection, No More Distraction from Platform Switching.</p>

            <p className="text-lg text-white/60 font-light leading-relaxed mb-2">
              从今天开始，<br />
              让 AI 成为你自然的一部分。
            </p>
            <p className="text-sm text-white/50 mb-12">Starting Today, Make AI a Natural Part of You.</p>
          </div>
        </div>
      </section>

      {/* Right Side - Login Form */}
      <section className="lg:w-1/2 flex items-center justify-center p-8 lg:p-20 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold mb-2">登录</h1>
          <p className="text-gray-500 mb-8">访问您的高级工作空间</p>

          {/* 登录方式切换 */}
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('password');
                setError('');
                setOtpSent(false);
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                loginMethod === 'password'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              密码登录
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('otp');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                loginMethod === 'otp'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              验证码登录
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {loginMethod === 'password' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent outline-none transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent outline-none transition-all"
                  placeholder="输入您的密码"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F5C518] hover:bg-[#E6B800] text-black font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOTPLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent outline-none transition-all"
                    placeholder="name@company.com"
                    required
                    disabled={otpSent}
                  />
                  <button
                    type="button"
                    onClick={sendOTP}
                    disabled={loading || countdown > 0 || otpSent}
                    className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all"
                  >
                    {countdown > 0 ? `${countdown}秒` : otpSent ? '已发送' : '发送验证码'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    验证码
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F5C518] focus:border-transparent outline-none transition-all"
                    placeholder="输入6位验证码"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    验证码已发送到您的邮箱，请查收
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !otpSent || !otp}
                className="w-full bg-[#F5C518] hover:bg-[#E6B800] text-black font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '验证中...' : '登录'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            初次使用平台?{' '}
            <Link href="/auth/register" className="text-[#F5C518] hover:underline font-medium">
              创建账号
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
