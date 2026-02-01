import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
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

    // 2. 获取用户信息
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_type, credits, image_credits, video_credits')
      .eq('id', user.id)
      .single();

    // 如果用户不存在，自动创建
    if (userError || !userData) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_type: 'free',
          credits: 0,
          image_credits: 0,
          video_credits: 0
        })
        .select('user_type, credits, image_credits, video_credits')
        .single();

      if (createError) {
        console.error('创建用户记录失败:', createError);
        return NextResponse.json({ error: '创建用户记录失败' }, { status: 500 });
      }

      const userType = newUser?.user_type || 'free';
      const credits = newUser?.credits || 0;
      const imageCredits = newUser?.image_credits || 0;
      const videoCredits = newUser?.video_credits || 0;

      return NextResponse.json({
        userType,
        credits,
        balance: credits,
        imageCredits,
        videoCredits,
        usage: {
          advanced: { used: 0, remaining: 3, limit: 3 },
          basic: { used: 0, remaining: 10, limit: 10 }
        }
      });
    }

    const userType = userData?.user_type || 'free';
    const credits = userData?.credits || 0; // 保留旧字段兼容性
    const imageCredits = userData?.image_credits || 0;
    const videoCredits = userData?.video_credits || 0;

    // 3. 获取今日使用统计
    const today = new Date().toISOString().split('T')[0];

    // 获取高级模型使用次数
    const { count: advancedCount } = await supabaseAdmin
      .from('usage_stats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('model_tier', 'advanced')
      .eq('date', today);

    // 获取普通模型使用次数
    const { count: basicCount } = await supabaseAdmin
      .from('usage_stats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('model_tier', 'basic')
      .eq('date', today);

    // 4. 计算剩余配额
    let advancedRemaining = 0;
    let basicRemaining = 0;

    if (userType === 'free') {
      advancedRemaining = Math.max(0, 3 - (advancedCount || 0));
      basicRemaining = Math.max(0, 10 - (basicCount || 0));
    } else {
      // 专业版用户：高级模型每月1600次，普通模型无限
      const month = new Date().toISOString().slice(0, 7);
      const { count: monthlyAdvancedCount } = await supabaseAdmin
        .from('usage_stats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('model_tier', 'advanced')
        .eq('month', month);

      advancedRemaining = Math.max(0, 1600 - (monthlyAdvancedCount || 0));
      basicRemaining = 999999; // 无限
    }

    return NextResponse.json({
      userType,
      credits, // 保留旧字段兼容性
      balance: credits, // 兼容前端
      imageCredits, // 图片积分
      videoCredits, // 视频积分
      usage: {
        advanced: {
          used: advancedCount || 0,
          remaining: advancedRemaining,
          limit: userType === 'free' ? 3 : 1600,
        },
        basic: {
          used: basicCount || 0,
          remaining: basicRemaining,
          limit: userType === 'free' ? 10 : 999999,
        },
      },
    });
  } catch (error: any) {
    console.error('Credits API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
