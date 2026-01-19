import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { generateAlipayUrl } from '@/lib/alipay';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
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

    // 生成订单号
    const orderNo = `ORDER_${Date.now()}_${user.id.slice(0, 8)}`;

    // 创建订单记录
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error: insertError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        user_id: user.id,
        order_no: orderNo,
        amount: 115.00,
        status: 'pending',
        payment_method: 'alipay',
      });

    if (insertError) {
      console.error('创建订单失败:', insertError);
      return new Response('创建订单失败', { status: 500 });
    }

    // 生成支付宝支付链接
    const paymentUrl = generateAlipayUrl(orderNo, 115.00, '会员订阅 - 1个月');

    return new Response(
      JSON.stringify({
        orderNo,
        paymentUrl,
        amount: 115.00,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('创建订单错误:', error);
    return new Response('服务器错误', { status: 500 });
  }
}
