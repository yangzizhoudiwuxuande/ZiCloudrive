import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Aes } from 'npm:wechatpay-axios-plugin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptTradeState(
  MCH_API_V3_KEY: string,
  associatedData: string,
  nonce: string,
  ciphertext: string
): Promise<{ status: string; order_no: string }> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, MCH_API_V3_KEY, nonce, associatedData);
  const obj = JSON.parse(plaintext);
  return {
    status: (obj.trade_state ?? '').toString() === 'SUCCESS' ? 'SUCCESS' : 'OTHERS',
    order_no: obj.out_trade_no ?? ''
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { resource } = body;

    if (!resource) {
      return new Response(JSON.stringify({ code: 'FAIL', message: '缺少resource' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MCH_API_V3_KEY = Deno.env.get('MCH_API_V3_KEY');
    if (!MCH_API_V3_KEY) {
      return new Response(JSON.stringify({ code: 'FAIL', message: '支付配置未完成' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 解密支付结果
    const { associated_data, nonce, ciphertext } = resource;
    const decryptResult = await decryptTradeState(MCH_API_V3_KEY, associated_data, nonce, ciphertext);

    if (decryptResult.status !== 'SUCCESS') {
      return new Response(JSON.stringify({ code: 'SUCCESS', message: '非成功支付' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 更新订单状态（使用乐观锁）
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_no', decryptResult.order_no)
      .single();

    if (fetchError || !order) {
      console.error('订单不存在:', decryptResult.order_no);
      return new Response(JSON.stringify({ code: 'SUCCESS', message: '订单不存在' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 如果订单已经是已支付状态，直接返回成功
    if (order.status === 'paid') {
      return new Response(JSON.stringify({ code: 'SUCCESS', message: '订单已处理' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 更新订单状态
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('order_no', decryptResult.order_no)
      .eq('status', 'pending'); // 乐观锁

    if (updateError) {
      console.error('更新订单状态失败:', updateError);
      return new Response(JSON.stringify({ code: 'FAIL', message: '更新订单失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 更新用户套餐和存储限制
    const plan = order.plan_snapshot;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        current_plan_id: order.plan_id,
        storage_limit: plan.storage_bytes,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.user_id);

    if (profileError) {
      console.error('更新用户套餐失败:', profileError);
    }

    console.log(`[支付成功] 订单号: ${decryptResult.order_no}, 用户: ${order.user_id}`);

    return new Response(JSON.stringify({ code: 'SUCCESS', message: '处理成功' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('支付回调处理错误:', error);
    return new Response(JSON.stringify({ code: 'FAIL', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
