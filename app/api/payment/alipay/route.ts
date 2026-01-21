import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AlipaySdk } from 'alipay-sdk';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 初始化支付宝 SDK
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  gateway: 'https://openapi.alipay.com/gateway.do',
  timeout: 5000,
  camelcase: true,
});

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份（必须登录）
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await req.json();
    const { plan, amount } = body;

    if (!plan || !amount) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 生成订单号
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 4. 创建支付订单记录
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        order_no: orderId,
        user_id: user.id, // 确保使用登录用户的 ID
        order_type: plan,
        amount_rmb: amount,
        status: 'pending',
        payment_method: 'alipay',
        credits_amount: 0,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
    }

    // 5. 生成支付宝支付链接
    const paymentUrl = await generateAlipayUrl(orderId, amount, plan, user.email || '');

    return NextResponse.json({
      success: true,
      orderId: orderId,
      paymentUrl: paymentUrl,
      amount: amount,
      order_type: plan,
    });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}

// 生成支付宝支付链接（电脑网站支付）
async function generateAlipayUrl(
  orderId: string,
  amount: number,
  plan: string,
  userEmail: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // 调用支付宝电脑网站支付接口
  const result = await alipaySdk.pageExec('alipay.trade.page.pay', {
    bizContent: {
      outTradeNo: orderId, // 商户订单号
      productCode: 'FAST_INSTANT_TRADE_PAY',
      totalAmount: amount.toFixed(2), // 订单金额，单位为元
      subject: `BoLuoing AI - ${plan}`, // 订单标题
      body: `购买 ${plan} 套餐`, // 订单描述
    },
    returnUrl: `${baseUrl}/payment/callback`, // 同步回调地址
    notifyUrl: `${baseUrl}/api/payment/alipay/notify`, // 异步通知地址
  });

  return result;
}

// 支付同步回调接口（用户支付完成后跳转）
export async function GET(req: NextRequest) {
  try {
    // 获取支付宝回调参数
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // 验证签名
    const signVerified = alipaySdk.checkNotifySign(params);

    if (!signVerified) {
      console.error('Alipay signature verification failed');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/payment/failed?reason=signature_error`
      );
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;

    if (!outTradeNo) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/payment/failed?reason=missing_order`
      );
    }

    // 跳转到支付成功页面
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success?orderId=${outTradeNo}&tradeNo=${tradeNo}`
    );
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payment/failed?reason=server_error`
    );
  }
}
