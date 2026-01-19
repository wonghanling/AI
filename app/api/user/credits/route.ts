// ============================================
// 获取用户图片生成额度
// 路径：app/api/user/credits/route.ts
// ============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    // 验证用户身份
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 获取用户余额
    const { data: credits, error } = await supabaseAdmin
      .from('image_credits')
      .select('balance, total_purchased')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // 如果用户没有记录，创建一个初始记录
      if (error.code === 'PGRST116') {
        const { data: newCredits } = await supabaseAdmin
          .from('image_credits')
          .insert({
            user_id: user.id,
            balance: 0,
            total_purchased: 0,
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({
            balance: 0,
            total_purchased: 0,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.error('获取余额失败:', error);
      return new Response('Failed to fetch credits', { status: 500 });
    }

    return new Response(
      JSON.stringify({
        balance: credits.balance || 0,
        total_purchased: credits.total_purchased || 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('获取余额 API 错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
