import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNo = searchParams.get('orderNo');

    if (!orderNo) {
      return new Response('缺少订单号', { status: 400 });
    }

    // 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // 查询订单
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .eq('user_id', user.id)
      .single();

    if (!order) {
      return new Response('订单不存在', { status: 404 });
    }

    return new Response(
      JSON.stringify({
        orderNo: order.order_no,
        status: order.status,
        amount: order.amount,
        paidAt: order.paid_at,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('查询订单错误:', error);
    return new Response('服务器错误', { status: 500 });
  }
}
