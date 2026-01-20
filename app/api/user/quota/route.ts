import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    // 2. 获取用户类型
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    const userType = userData?.user_type || 'free';

    // 3. 获取今日使用量
    const today = new Date().toISOString().split('T')[0];

    const { data: advancedUsage, count: advancedCount } = await supabaseAdmin
      .from('usage_stats')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('model_tier', 'advanced')
      .eq('date', today);

    const { data: basicUsage, count: basicCount } = await supabaseAdmin
      .from('usage_stats')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('model_tier', 'basic')
      .eq('date', today);

    const advancedUsed = advancedCount || 0;
    const basicUsed = basicCount || 0;

    // 4. 返回配额信息
    if (userType === 'free') {
      return NextResponse.json({
        user_type: 'free',
        advanced: {
          limit: 3,
          used: advancedUsed,
          remaining: Math.max(0, 3 - advancedUsed),
        },
        basic: {
          limit: 10,
          used: basicUsed,
          remaining: Math.max(0, 10 - basicUsed),
        },
      });
    } else {
      // 付费用户 - 返回速率限制信息
      return NextResponse.json({
        user_type: 'premium',
        rate_limits: {
          per_minute: {
            limit: 10,
            remaining: 10, // 简化版，实际应该查询 rate_limits 表
          },
          per_hour: {
            limit: 100,
            remaining: 100, // 简化版
          },
        },
        monthly: {
          limit: 1600,
          used: advancedUsed + basicUsed, // 简化版，实际应该查询本月总量
          remaining: Math.max(0, 1600 - (advancedUsed + basicUsed)),
        },
      });
    }
  } catch (error: any) {
    console.error('Quota API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
