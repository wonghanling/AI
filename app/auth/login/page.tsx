'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<'password' | 'code'>('password');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    verificationCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 发送验证码
  const handleSendCode = async () => {
    if (!formData.email) {
      setError('请输入邮箱地址');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('系统配置错误，请联系管理员');
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formData.email,
      });

      if (otpError) throw otpError;

      setCodeSent(true);
      setCountdown(60);

      // 倒计时
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || '发送验证码失败，请重试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('系统配置错误，请联系管理员');
        return;
      }

      if (loginMethod === 'password') {
        // 密码登录
        if (!formData.password) {
          setError('请输入密码');
          return;
        }

        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (loginError) throw loginError;

        // 保存 session token
        if (data.session) {
          localStorage.setItem('supabase_token', data.session.access_token);
        }
      } else {
        // 验证码登录
        if (!formData.verificationCode) {
          setError('请输入验证码');
          return;
        }

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: formData.email,
          token: formData.verificationCode,
          type: 'email'
        });

        if (verifyError) throw verifyError;

        // 保存 session token
        if (data.session) {
          localStorage.setItem('supabase_token', data.session.access_token);
        }
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col lg:flex-row overflow-x-hidden">
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

            {/* Divider */}
            <div className="space-y-4">
              <div className="h-[1px] w-full bg-white/10"></div>
            </div>
          </div>

          {/* Background Text */}
          <div className="absolute bottom-10 left-10 text-white/5 text-[120px] font-bold select-none whitespace-nowrap pointer-events-none">
            PRECISION
          </div>
        </div>
      </section>

      {/* Right Side - Login Form */}
      <section className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 md:p-20 bg-white">
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <header className="mb-14 text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <div className="size-14 bg-[#F5C518] rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(246,196,69,0.4)]">
                <svg className="w-8 h-8 text-[#121212]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            <h1 className="text-[36px] font-semibold text-[#1D1D1F] tracking-tight mb-3">登录</h1>
            <p className="text-[#86868B] text-lg font-light">访问您的高级工作空间</p>
          </header>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Login Method Toggle */}
          <div className="mb-8 flex gap-2 p-1 bg-[#F5F5F7] rounded-2xl">
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`flex-1 h-11 rounded-xl font-medium text-sm transition-all ${
                loginMethod === 'password'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              密码登录
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('code')}
              className={`flex-1 h-11 rounded-xl font-medium text-sm transition-all ${
                loginMethod === 'code'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              验证码登录
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[14px] font-medium text-[#1D1D1F] ml-1">邮箱地址</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                placeholder="name@company.com"
                required
              />
            </div>

            {/* Password Login */}
            {loginMethod === 'password' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="block text-[14px] font-medium text-[#1D1D1F]">密码</label>
                  <a href="#" className="text-[13px] text-[#86868B] hover:text-[#1D1D1F] transition-colors">
                    忘记密码?
                  </a>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                    placeholder="输入您的密码"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Code Login */}
            {loginMethod === 'code' && (
              <div className="space-y-2">
                <label className="block text-[14px] font-medium text-[#1D1D1F] ml-1">邮箱验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value })}
                    className="flex-1 h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                    placeholder="输入 6 位验证码"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0}
                    className="h-[56px] px-6 rounded-2xl border border-[#D2D2D7] bg-white text-[#1D1D1F] font-medium text-sm hover:bg-[#FBFBFC] hover:border-[#F5C518] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
                {codeSent && (
                  <p className="mt-2 text-xs text-[#34C759] ml-1">✓ 验证码已发送到您的邮箱</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[58px] text-[#121212] font-bold text-lg rounded-2xl bg-[#F5C518] hover:brightness-105 hover:shadow-[0_10px_25px_-5px_rgba(246,196,69,0.4)] transition-all mt-6 shadow-sm active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {loading ? '登录中...' : loginMethod === 'password' ? '使用密码登录' : '使用验证码登录'}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-14 text-center">
            <p className="text-[#86868B] text-sm font-light">
              初次使用平台?{' '}
              <Link href="/auth/register" className="text-[#121212] font-semibold hover:underline underline-offset-4">
                创建账号
              </Link>
            </p>
          </div>

          {/* Footer Links */}
          <footer className="mt-20 flex justify-center gap-8 text-[11px] font-medium text-[#A1A1A6] tracking-wide">
            <a href="#" className="hover:text-[#121212] transition-colors">隐私政策</a>
            <a href="#" className="hover:text-[#121212] transition-colors">使用条款</a>
            <a href="#" className="hover:text-[#121212] transition-colors">支持</a>
          </footer>
        </div>
      </section>
    </div>
  );
}
