import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await req.json();
    const { plan, amount, userEmail } = body;

    if (!plan || !amount || !userEmail) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 2. 验证用户身份（可选，如果前端已经传了 email）
    const authHeader = req.headers.get('authorization');
    let userId = '';

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (user) {
        userId = user.id;
      }
    }

    // 3. 生成订单号
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 4. 创建支付订单记录
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        order_id: orderId,
        user_id: userId || null,
        user_email: userEmail,
        plan: plan,
        amount: amount,
        status: 'pending',
        payment_method: 'alipay',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
    }

    // 5. 生成支付宝支付链接
    // 注意：这里需要集成真实的支付宝 SDK
    // 目前返回一个模拟的支付链接
    const paymentUrl = generateAlipayUrl(orderId, amount, plan);

    return NextResponse.json({
      success: true,
      orderId: orderId,
      paymentUrl: paymentUrl,
      amount: amount,
      plan: plan,
    });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}

// 生成支付宝支付链接（模拟）
function generateAlipayUrl(orderId: string, amount: number, plan: string): string {
  // TODO: 集成真实的支付宝 SDK
  // 这里返回一个模拟的支付链接

  // 在实际生产环境中，你需要：
  // 1. 安装支付宝 SDK: npm install alipay-sdk
  // 2. 配置支付宝应用信息（APPID、私钥、公钥等）
  // 3. 调用支付宝 API 生成支付链接

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // 模拟支付链接（实际应该是支付宝的链接）
  return `${baseUrl}/payment/mock?orderId=${orderId}&amount=${amount}&plan=${plan}`;
}

// 支付回调接口（支付宝异步通知）
export async function GET(req: NextRequest) {
  try {
    // 处理支付宝的异步通知
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');

    if (!orderId) {
      return NextResponse.json({ error: '缺少订单号' }, { status: 400 });
    }

    // 验证支付宝签名（重要！）
    // TODO: 实现支付宝签名验证

    // 更新订单状态
    if (status === 'success') {
      const { data: orderData } = await supabaseAdmin
        .from('payment_orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (orderData) {
        // 更新订单状态
        await supabaseAdmin
          .from('payment_orders')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        // 更新用户订阅状态
        if (orderData.user_id) {
          await supabaseAdmin
            .from('users')
            .update({
              user_type: 'pro',
              subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后
            })
            .eq('id', orderData.user_id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
