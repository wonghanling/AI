'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
        options: {
          shouldCreateUser: true,
        }
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

    if (!formData.verificationCode) {
      setError('请输入验证码');
      return;
    }

    if (!formData.agreeToTerms) {
      setError('请同意服务条款和隐私政策');
      return;
    }

    if (formData.password.length < 8) {
      setError('密码至少需要 8 个字符');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('系统配置错误，请联系管理员');
        return;
      }

      // 1. 验证 OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: formData.verificationCode,
        type: 'email'
      });

      if (verifyError) throw verifyError;

      // 2. 设置用户密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (updateError) throw updateError;

      // 3. 保存 session token
      if (data.session) {
        localStorage.setItem('supabase_token', data.session.access_token);
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-white">
      {/* Left Side - Dark Gradient */}
      <div className="lg:w-[45%] relative bg-gradient-to-br from-[#000000] via-[#1a1a1a] to-[#333333] flex flex-col justify-between p-8 lg:p-16 overflow-hidden min-h-[40vh] lg:min-h-screen">
        {/* Blur Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full bg-white/5 blur-[120px]"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[60%] rounded-full bg-white/5 blur-[100px]"></div>

        {/* Content */}
        <div className="z-10">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-24">
            <div className="size-10 bg-white/10 backdrop-blur-xl border-t-2 border-r-2 border-white/30 border-l-[3px] border-b-[3px] border-l-white/50 border-b-white/50 rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]">
              <svg className="text-white size-5" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-white text-lg font-bold tracking-widest uppercase">BoLuoing</h2>
          </div>

          {/* Main Text */}
          <div className="max-w-md">
            <h1 className="text-white text-5xl font-light tracking-tight leading-[1.2] mb-3">
              <span className="whitespace-nowrap">加入下一代 AI 工作方式.</span><br />提升人类认知.
            </h1>
            <p className="text-white/50 text-sm mb-8">Join the Next Generation of AI Workflow. Elevate Human Intelligence.</p>
            <p className="text-white/40 text-lg font-light leading-relaxed mb-3">
              体验原始计算能力与优雅界面设计的完美融合.
            </p>
            <p className="text-white/50 text-sm mb-12">Experience the Perfect Fusion of Raw Computing Power and Elegant Interface Design.</p>

            {/* Status Card */}
            <div className="bg-white/5 backdrop-blur-xl border-t border-r border-white/5 border-l-2 border-b-2 border-l-white/20 border-b-white/20 p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] shadow-[0_0_8px_rgba(246,196,69,0.6)]"></span>
                <span className="text-white/60 text-[10px] uppercase tracking-[0.3em] font-bold">系统状态: 运行中</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white text-sm font-semibold">实时合成</h4>
                  <p className="text-white/30 text-xs mt-0.5">处理 2.4TB/s 数据流</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex items-center gap-8 text-white/20 text-[10px] tracking-[0.4em] font-medium uppercase">
          <span>© 2026 BoLuoing 智能</span>
          <div className="w-8 h-[1px] bg-white/10"></div>
          <span>加密会话</span>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-[55%] flex flex-col justify-center items-center bg-white p-8 md:p-20">
        <div className="max-w-[400px] w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex mb-8">
            <div className="size-10 bg-black rounded-lg flex items-center justify-center">
              <svg className="text-[#F5C518] size-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-black mb-2">创建账号</h2>
            <p className="text-gray-400 text-sm">加入下一代专业 AI 工具.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[#1D1D1F] text-sm font-medium mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* Verification Code */}
            <div>
              <label className="block text-[#1D1D1F] text-sm font-medium mb-2">
                邮箱验证码
              </label>
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
                <p className="mt-2 text-xs text-[#34C759]">✓ 验证码已发送到您的邮箱</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#1D1D1F] text-sm font-medium mb-2">
                设置密码
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                placeholder="至少 8 个字符"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[#1D1D1F] text-sm font-medium mb-2">
                确认密码
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full h-[56px] px-5 rounded-2xl border border-[#D2D2D7] bg-white text-base outline-none placeholder:text-[#A1A1A6] focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(246,196,69,0.15)] transition-all"
                placeholder="再次输入密码"
                required
              />
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                id="terms"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-[#D2D2D7] text-[#F5C518] focus:ring-0 cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm text-[#86868B] leading-relaxed cursor-pointer select-none">
                我已阅读并同意{' '}
                <a href="#" className="text-[#1D1D1F] font-medium hover:underline underline-offset-2">服务条款</a>
                {' '}和{' '}
                <a href="#" className="text-[#1D1D1F] font-medium hover:underline underline-offset-2">隐私政策</a>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[58px] text-[#121212] font-bold text-lg rounded-2xl bg-[#F5C518] hover:brightness-105 hover:shadow-[0_10px_25px_-5px_rgba(246,196,69,0.4)] transition-all mt-4 shadow-sm active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {loading ? '注册中...' : '创建账号'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-10 text-center">
            <p className="text-[#86868B] text-sm">
              已有账号?{' '}
              <Link href="/auth/login" className="text-[#121212] font-semibold hover:underline underline-offset-4">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
