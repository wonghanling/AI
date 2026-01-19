import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { verifyAlipaySign } from '@/lib/alipay';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    // 1. 获取支付宝回调参数
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('支付宝回调参数:', params);

    // 2. 验证签名（防止伪造）
    const isValid = verifyAlipaySign(params);
    if (!isValid) {
      console.error('签名验证失败');
      return new Response('fail');
    }

    // 3. 提取关键信息
    const {
      out_trade_no: orderNo,
      trade_status: tradeStatus,
      total_amount: amount,
      trade_no: alipayTradeNo,
    } = params;

    // 4. 只处理支付成功的通知
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return new Response('success');
    }

    // 5. 查询订单（幂等性检查）
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (!order) {
      console.error('订单不存在:', orderNo);
      return new Response('success');
    }

    if (order.status === 'paid') {
      console.log('订单已处理，跳过:', orderNo);
      return new Response('success');
    }

    // 6. 更新订单状态
    await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        callback_data: params,
      })
      .eq('id', order.id);

    // 7. 创建订阅记录
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    await supabase.from('subscriptions').insert({
      user_id: order.user_id,
      plan_type: 'monthly',
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      amount: parseFloat(amount),
      payment_method: 'alipay',
    });

    // 8. 更新用户类型为付费用户
    await supabase
      .from('users')
      .update({ user_type: 'premium' })
      .eq('id', order.user_id);

    console.log('订阅创建成功:', order.user_id);

    // 9. 返回 success（必须！）
    return new Response('success');

  } catch (error) {
    console.error('支付回调处理错误:', error);
    return new Response('success');
  }
}
