import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 支付宝配置
const ALIPAY_CONFIG = {
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  gatewayUrl: 'https://openapi.alipay.com/gateway.do',
  charset: 'utf-8',
  signType: 'RSA2',
  version: '1.0',
};

// 生成签名
function generateSign(params: Record<string, any>, privateKey: string): string {
  // 1. 过滤空值和 sign 字段
  const filteredParams = Object.keys(params)
    .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined && key !== 'sign')
    .sort()
    .reduce((obj, key) => {
      obj[key] = params[key];
      return obj;
    }, {} as Record<string, any>);

  // 2. 拼接参数
  const signString = Object.keys(filteredParams)
    .map(key => `${key}=${filteredParams[key]}`)
    .join('&');

  // 3. 使用私钥签名
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signString, 'utf8');
  return sign.sign(privateKey, 'base64');
}

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BL${timestamp}${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, amount, userEmail } = body;

    if (!plan || !amount || !userEmail) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查环境变量
    if (!ALIPAY_CONFIG.appId || !ALIPAY_CONFIG.privateKey || !ALIPAY_CONFIG.alipayPublicKey) {
      return NextResponse.json(
        { error: '支付配置错误，请联系管理员' },
        { status: 500 }
      );
    }

    // 生成订单号
    const outTradeNo = generateOrderNo();

    // 订单描述
    const subject = plan === 'pro' ? 'BoLuoing 专业版订阅' : 'BoLuoing 订阅';
    const body_text = `${subject} - ${userEmail}`;

    // 获取当前域名（用于回调）
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const returnUrl = `${protocol}://${host}/payment/success`;
    const notifyUrl = `${protocol}://${host}/api/payment/alipay/notify`;

    // 构建支付宝请求参数
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount.toFixed(2),
      subject: subject,
      body: body_text,
    };

    const params: Record<string, string> = {
      app_id: ALIPAY_CONFIG.appId,
      method: 'alipay.trade.page.pay',
      charset: ALIPAY_CONFIG.charset,
      sign_type: ALIPAY_CONFIG.signType,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: ALIPAY_CONFIG.version,
      notify_url: notifyUrl,
      return_url: returnUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // 生成签名
    const sign = generateSign(params, ALIPAY_CONFIG.privateKey);
    params.sign = sign;

    // 构建支付 URL
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');

    const paymentUrl = `${ALIPAY_CONFIG.gatewayUrl}?${queryString}`;

    // 返回支付链接
    return NextResponse.json({
      success: true,
      paymentUrl: paymentUrl,
      orderNo: outTradeNo,
    });

  } catch (error: any) {
    console.error('支付宝支付错误:', error);
    return NextResponse.json(
      { error: error.message || '创建支付订单失败' },
      { status: 500 }
    );
  }
}
