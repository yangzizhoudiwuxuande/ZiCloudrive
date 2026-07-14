import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createWechatPayUrl, generateOrderNo } from '../_shared/payment-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: '用户认证失败' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { plan_id } = await req.json();

    if (!plan_id) {
      return new Response(JSON.stringify({ error: '缺少套餐ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 获取套餐信息
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: '套餐不存在' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 检查是否为免费套餐
    if (plan.is_free) {
      return new Response(JSON.stringify({ error: '免费套餐无需支付' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 生成订单号
    const orderNo = generateOrderNo();

    // 获取支付密钥
    const MERCHANT_ID = Deno.env.get('MERCHANT_ID');
    const MERCHANT_APP_ID = Deno.env.get('MERCHANT_APP_ID');
    const MCH_CERT_SERIAL_NO = Deno.env.get('MCH_CERT_SERIAL_NO');
    const MCH_PRIVATE_KEY = Deno.env.get('MCH_PRIVATE_KEY');
    const WECHAT_PAY_PUBLIC_KEY_ID = Deno.env.get('WECHAT_PAY_PUBLIC_KEY_ID');
    const WECHAT_PAY_PUBLIC_KEY = Deno.env.get('WECHAT_PAY_PUBLIC_KEY');

    if (!MERCHANT_ID || !MERCHANT_APP_ID || !MCH_CERT_SERIAL_NO || !MCH_PRIVATE_KEY || !WECHAT_PAY_PUBLIC_KEY_ID || !WECHAT_PAY_PUBLIC_KEY) {
      return new Response(JSON.stringify({ error: '支付配置未完成，请联系管理员在插件中心配置微信支付密钥' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 创建支付URL
    const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/wechat_payment_webhook`;
    const paymentResult = await createWechatPayUrl(
      MERCHANT_ID,
      MERCHANT_APP_ID,
      MCH_CERT_SERIAL_NO,
      MCH_PRIVATE_KEY,
      WECHAT_PAY_PUBLIC_KEY_ID,
      WECHAT_PAY_PUBLIC_KEY,
      orderNo,
      plan.price_monthly,
      notifyUrl
    );

    if (!paymentResult.success) {
      return new Response(JSON.stringify({ error: `创建支付失败: ${paymentResult.error}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 创建订单
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: orderNo,
        user_id: user.id,
        plan_id: plan.id,
        status: 'pending',
        wechat_pay_url: paymentResult.url,
        total_amount: plan.price_monthly,
        plan_snapshot: plan
      })
      .select()
      .single();

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return new Response(JSON.stringify({ error: '创建订单失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ order_no: orderNo }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('创建支付订单错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

