'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.push('/auth/login?error=config');
        return;
      }

      try {
        // 获取当前 session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
          // 保存 token
          localStorage.setItem('supabase_token', session.access_token);
          // 跳转到聊天页面
          router.push('/chat');
        } else {
          // 没有 session，跳转到登录页
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/auth/login?error=callback');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#F5C518]"></div>
        <p className="mt-4 text-gray-600">正在验证登录状态...</p>
      </div>
    </div>
  );
}
