import { Wechatpay } from 'npm:wechatpay-axios-plugin';

export async function createWechatPayUrl(
  MERCHANT_ID: string,
  MERCHANT_APP_ID: string,
  MCH_CERT_SERIAL_NO: string,
  MCH_PRIVATE_KEY: string,
  WECHAT_PAY_PUBLIC_KEY_ID: string,
  WECHAT_PAY_PUBLIC_KEY: string,
  outTradeNo: string,
  amount: number,
  notifyUrl: string
) {
  try {
    const wxpay = new Wechatpay({
      mchid: MERCHANT_ID,
      serial: MCH_CERT_SERIAL_NO,
      privateKey: MCH_PRIVATE_KEY,
      certs: { [WECHAT_PAY_PUBLIC_KEY_ID]: WECHAT_PAY_PUBLIC_KEY }
    });
    const res = await wxpay.v3.pay.transactions.native.post({
      mchid: MERCHANT_ID,
      out_trade_no: outTradeNo,
      appid: MERCHANT_APP_ID,
      description: '网盘套餐购买',
      notify_url: notifyUrl,
      amount: { total: Math.round(amount * 100) }
    }, { headers: { 'Wechatpay-Serial': WECHAT_PAY_PUBLIC_KEY_ID } });
    if (res.data.code_url) {
      console.log(`[WeChatPay SUCCESS] outTradeNo=${outTradeNo}, url=${res.data.code_url}`);
      return { success: true, url: res.data.code_url };
    }
    console.error(`[WeChatPay FAILED] outTradeNo=${outTradeNo}, error=${res.data.message || JSON.stringify(res.data)}`);
    return { success: false, error: res.data.message || JSON.stringify(res.data) };
  } catch (err) {
    console.error(`[WeChatPay ERROR] outTradeNo=${outTradeNo}, error=${err?.message || String(err)}`);
    return { success: false, error: err?.message || String(err) };
  }
}

export function generateOrderNo(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `ORD-${yymmdd}-${result}`;
}
