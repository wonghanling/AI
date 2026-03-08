'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import { getCachedUser, setCachedUser } from '@/lib/user-cache';
import { Loader2, ArrowLeft, Zap, Image as ImageIcon, Video, CreditCard, FileText, MessageSquare, Crown } from 'lucide-react';

interface UserData {
  user_type: string;
  credits: number;
  image_credits: number;
  video_credits: number;
}

interface UsageData {
  basic_used: number;
  advanced_used: number;
}

const USER_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  free:    { label: '免费版', color: 'bg-gray-100 text-gray-600' },
  pro:     { label: 'Pro 会员', color: 'bg-blue-100 text-blue-600' },
  premium: { label: '高级会员', color: 'bg-yellow-100 text-yellow-700' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [usage, setUsage] = useState<UsageData>({ basic_used: 0, advanced_used: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { router.push('/auth/login'); return; }

    const cached = getCachedUser();
    if (cached?.user) setUser(cached.user);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/auth/login'); return; }

    setUser(authUser);
    setCachedUser(authUser);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // 获取积分和套餐
    const res = await fetch('/api/user/credits', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUserData({
        user_type: data.userType || 'free',
        credits: data.credits || 0,
        image_credits: data.imageCredits || 0,
        video_credits: parseFloat(data.videoCredits || '0'),
      });
    }

    // 获取今日用量
    const today = new Date().toISOString().split('T')[0];
    const { data: usageRows } = await supabase
      .from('usage_stats')
      .select('model_tier')
      .eq('user_id', authUser.id)
      .eq('date', today);

    if (usageRows) {
      setUsage({
        basic_used: usageRows.filter(r => r.model_tier === 'basic').length,
        advanced_used: usageRows.filter(r => r.model_tier === 'advanced').length,
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const typeInfo = USER_TYPE_LABEL[userData?.user_type || 'free'];
  const isFree = userData?.user_type === 'free';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/chat" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">个人中心</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 用户信息 + 套餐状态 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                  <Crown className="w-3 h-3" />
                  {typeInfo.label}
                </span>
              </div>
            </div>
            {isFree && (
              <Link href="/payment" className="bg-[#F5C518] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors">
                升级会员
              </Link>
            )}
          </div>
        </div>

        {/* 余额卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <MessageSquare className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{userData?.credits ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">聊天积分</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <ImageIcon className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{userData?.image_credits ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">图片积分</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <Video className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">¥{(userData?.video_credits ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-0.5">视频余额</p>
          </div>
        </div>

        {/* 今日用量 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">今日聊天用量</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>普通模型</span>
                <span>{usage.basic_used} / {isFree ? 10 : '无限'}</span>
              </div>
              {isFree && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(usage.basic_used / 10 * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>高级模型</span>
                <span>{usage.advanced_used} / {isFree ? 3 : '无限'}</span>
              </div>
              {isFree && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-purple-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(usage.advanced_used / 3 * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/credits/recharge" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">充值积分</p>
              <p className="text-xs text-gray-500">图片 / 视频余额</p>
            </div>
          </Link>
          <Link href="/orders" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">订单记录</p>
              <p className="text-xs text-gray-500">查看充值历史</p>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
