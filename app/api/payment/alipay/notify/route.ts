import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import AlipaySdk from 'alipay-sdk';

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
  camelCase: true,
});

// 支付宝异步通知接口
export async function POST(req: NextRequest) {
  try {
    // 1. 获取支付宝回调参数
    const formData = await req.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('Alipay notify params:', params);

    // 2. 验证签名（重要！防止伪造回调）
    const signVerified = alipaySdk.checkNotifySign(params);

    if (!signVerified) {
      console.error('Alipay signature verification failed');
      return new NextResponse('fail', { status: 400 });
    }

    // 3. 获取订单信息
    const outTradeNo = params.out_trade_no; // 商户订单号
    const tradeNo = params.trade_no; // 支付宝交易号
    const tradeStatus = params.trade_status; // 交易状态

    if (!outTradeNo) {
      return new NextResponse('fail', { status: 400 });
    }

    // 4. 查询订单
    const { data: orderData } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('order_no', outTradeNo)
      .single();

    if (!orderData) {
      console.error('Order not found:', outTradeNo);
      return new NextResponse('fail', { status: 404 });
    }

    // 5. 处理支付成功
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 更新订单状态
      await supabaseAdmin
        .from('payment_orders')
        .update({
          status: 'paid',
          trade_no: tradeNo,
          paid_at: new Date().toISOString(),
        })
        .eq('order_no', outTradeNo);

      // 更新用户订阅状态
      if (orderData.user_id) {
        const subscriptionEnd = new Date();

        // 根据套餐类型设置订阅时长
        if (orderData.order_type === 'monthly') {
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        } else if (orderData.order_type === 'yearly') {
          subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        } else {
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 默认1个月
        }

        await supabaseAdmin
          .from('users')
          .update({
            user_type: 'pro',
            subscription_end: subscriptionEnd.toISOString(),
          })
          .eq('id', orderData.user_id);

        console.log('User subscription updated:', orderData.user_id);
      }
    }

    // 6. 返回成功响应（必须返回 "success" 字符串）
    return new NextResponse('success');
  } catch (error: any) {
    console.error('Alipay notify error:', error);
    return new NextResponse('fail', { status: 500 });
  }
}
