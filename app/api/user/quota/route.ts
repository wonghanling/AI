// ============================================
// 用户配额查询 API
// 路径：app/api/user/quota/route.ts
// ============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { QUOTA_LIMITS } from '@/lib/model-config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // 2. 获取用户类型
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    const isPremium = userData?.user_type === 'premium';

    if (!isPremium) {
      // 免费用户：查询今日使用次数
      const today = new Date().toISOString().split('T')[0];

      const { data: advancedData } = await supabaseAdmin
        .from('usage_stats')
        .select('id')
        .eq('user_id', user.id)
        .eq('model_tier', 'advanced')
        .eq('date', today);

      const { data: basicData } = await supabaseAdmin
        .from('usage_stats')
        .select('id')
        .eq('user_id', user.id)
        .eq('model_tier', 'basic')
        .eq('date', today);

      const advancedUsed = advancedData?.length || 0;
      const basicUsed = basicData?.length || 0;

      return Response.json({
        user_type: 'free',
        advanced: {
          used: advancedUsed,
          limit: QUOTA_LIMITS.free.advanced_daily,
          remaining: Math.max(0, QUOTA_LIMITS.free.advanced_daily - advancedUsed),
        },
        basic: {
          used: basicUsed,
          limit: QUOTA_LIMITS.free.basic_daily,
          remaining: Math.max(0, QUOTA_LIMITS.free.basic_daily - basicUsed),
        },
      });
    } else {
      // 付费用户：查询速率限制和月度使用
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);

      // 查询本月使用次数
      const { data: monthlyData } = await supabaseAdmin
        .from('usage_stats')
        .select('id')
        .eq('user_id', user.id)
        .eq('month', currentMonth);

      const monthlyUsed = monthlyData?.length || 0;

      // 查询每分钟限制
      const { data: minuteData } = await supabaseAdmin
        .from('rate_limits')
        .select('count, window_start')
        .eq('user_id', user.id)
        .eq('limit_key', 'minute')
        .single();

      let minuteRemaining = QUOTA_LIMITS.premium.perMinute;
      if (minuteData) {
        const windowStart = new Date(minuteData.window_start);
        const elapsed = (now.getTime() - windowStart.getTime()) / 1000;
        if (elapsed < 60) {
          minuteRemaining = Math.max(0, QUOTA_LIMITS.premium.perMinute - minuteData.count);
        }
      }

      // 查询每小时限制
      const { data: hourData } = await supabaseAdmin
        .from('rate_limits')
        .select('count, window_start')
        .eq('user_id', user.id)
        .eq('limit_key', 'hour')
        .single();

      let hourRemaining = QUOTA_LIMITS.premium.perHour;
      if (hourData) {
        const windowStart = new Date(hourData.window_start);
        const elapsed = (now.getTime() - windowStart.getTime()) / 1000 / 60;
        if (elapsed < 60) {
          hourRemaining = Math.max(0, QUOTA_LIMITS.premium.perHour - hourData.count);
        }
      }

      return Response.json({
        user_type: 'premium',
        rate_limits: {
          per_minute: {
            used: QUOTA_LIMITS.premium.perMinute - minuteRemaining,
            limit: QUOTA_LIMITS.premium.perMinute,
            remaining: minuteRemaining,
          },
          per_hour: {
            used: QUOTA_LIMITS.premium.perHour - hourRemaining,
            limit: QUOTA_LIMITS.premium.perHour,
            remaining: hourRemaining,
          },
        },
        monthly: {
          used: monthlyUsed,
          limit: QUOTA_LIMITS.premium.monthlyMax,
          remaining: Math.max(0, QUOTA_LIMITS.premium.monthlyMax - monthlyUsed),
        },
      });
    }
  } catch (error) {
    console.error('Quota API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
