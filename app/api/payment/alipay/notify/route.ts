import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 支付宝配置
const ALIPAY_CONFIG = {
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
};

// 验证支付宝签名
function verifySign(params: Record<string, any>, sign: string, alipayPublicKey: string): boolean {
  try {
    // 1. 过滤 sign 和 sign_type 字段
    const filteredParams = Object.keys(params)
      .filter(key => key !== 'sign' && key !== 'sign_type')
      .sort()
      .reduce((obj, key) => {
        obj[key] = params[key];
        return obj;
      }, {} as Record<string, any>);

    // 2. 拼接参数
    const signString = Object.keys(filteredParams)
      .map(key => `${key}=${filteredParams[key]}`)
      .join('&');

    // 3. 使用支付宝公钥验证签名
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signString, 'utf8');
    return verify.verify(alipayPublicKey, sign, 'base64');
  } catch (error) {
    console.error('验证签名错误:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 获取支付宝回调参数
    const formData = await req.formData();
    const params: Record<string, any> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('支付宝回调参数:', params);

    // 验证签名
    const sign = params.sign;
    if (!sign) {
      return NextResponse.json({ error: '缺少签名' }, { status: 400 });
    }

    const isValid = verifySign(params, sign, ALIPAY_CONFIG.alipayPublicKey);
    if (!isValid) {
      console.error('签名验证失败');
      return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
    }

    // 获取支付状态
    const tradeStatus = params.trade_status;
    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const totalAmount = params.total_amount;
    const buyerEmail = params.buyer_email;

    console.log('支付状态:', {
      tradeStatus,
      outTradeNo,
      tradeNo,
      totalAmount,
      buyerEmail,
    });

    // 处理支付成功
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // TODO: 在这里更新数据库，激活用户订阅
      // 1. 根据 outTradeNo 查找订单
      // 2. 更新订单状态为已支付
      // 3. 激活用户的专业版订阅
      // 4. 记录支付日志

      console.log('支付成功，订单号:', outTradeNo);

      // 返回 success 给支付宝（必须返回这个字符串）
      return new NextResponse('success', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // 其他状态
    return new NextResponse('success', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error: any) {
    console.error('处理支付宝回调错误:', error);
    return NextResponse.json(
      { error: error.message || '处理回调失败' },
      { status: 500 }
    );
  }
}
