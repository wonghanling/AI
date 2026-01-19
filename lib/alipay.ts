// 支付宝配置和工具函数
import crypto from 'crypto';

export const ALIPAY_CONFIG = {
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  gateway: 'https://openapi.alipay.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL!,
};

// 生成支付宝支付链接
export function generateAlipayUrl(orderNo: string, amount: number, subject: string): string {
  const params: Record<string, string> = {
    app_id: ALIPAY_CONFIG.appId,
    method: 'alipay.trade.page.pay',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    version: '1.0',
    notify_url: ALIPAY_CONFIG.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: orderNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount.toFixed(2),
      subject,
    }),
  };

  const sign = signAlipayParams(params);
  params.sign = sign;

  const query = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  return `${ALIPAY_CONFIG.gateway}?${query}`;
}

// 签名
export function signAlipayParams(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .filter(key => key !== 'sign' && params[key])
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const sign = crypto
    .createSign('RSA-SHA256')
    .update(signString, 'utf8')
    .sign(ALIPAY_CONFIG.privateKey, 'base64');

  return sign;
}

// 验证签名
export function verifyAlipaySign(params: Record<string, string>): boolean {
  const sign = params.sign;
  const signType = params.sign_type;

  if (!sign || signType !== 'RSA2') {
    return false;
  }

  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .filter(key => key !== 'sign' && key !== 'sign_type' && params[key])
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signString, 'utf8');

  return verify.verify(ALIPAY_CONFIG.alipayPublicKey, sign, 'base64');
}
