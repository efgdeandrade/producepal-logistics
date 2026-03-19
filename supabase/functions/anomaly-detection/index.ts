import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string, token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!accessToken || !phoneNumberId) return;

  const cleanPhone = phone.replace(/\D/g, '');
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: { body: message },
    }),
  });
}

async function generateProactiveMessage(
  customerName: string,
  daysSinceOrder: number,
  lastItems: string,
  language: string,
  openaiKey: string
): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Dre, a friendly sales assistant for FUIK fresh produce in Curaçao.
Write a SHORT, warm, natural proactive message to a customer who hasn't ordered in ${daysSinceOrder} days.
Language: ${language}
Their last order included: ${lastItems || 'various produce items'}
Rules:
- Max 2 sentences
- Sound like a real person texting, not a bot
- Reference their last order naturally if relevant
- NEVER mention delivery times or dates
- End with a soft question or open invitation to order
- 1 emoji maximum
Papiamentu example: "Ayo! Largo tempu mi no a wak un orde for di bo 🌿 Tin algu bo mester e siman aki?"
English example: "Hey! Haven't seen an order from you in a while 🌿 Need anything this week?"`,
        },
        {
          role: 'user',
          content: `Generate a proactive message for customer: ${customerName}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 150,
    }),
  });

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

  try {
    // Load settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['anomaly_days_threshold', 'anomaly_max_per_run', 'anomaly_enabled']);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    if (settingsMap.anomaly_enabled === 'false') {
      return new Response(JSON.stringify({ message: 'Anomaly detection disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const daysThreshold = parseInt(settingsMap.anomaly_days_threshold || '7');
    const maxPerRun = parseInt(settingsMap.anomaly_max_per_run || '10');

    // Find customers who haven't ordered recently
    const { data: inactiveCustomers } = await supabase
      .from('distribution_customers')
      .select(`
        id, name, preferred_language,
        telegram_chat_id, whatsapp_phone,
        distribution_orders (
          id, created_at, status,
          distribution_order_items (product_name_raw, quantity, order_unit)
        )
      `)
      .not('distribution_orders', 'is', null)
      .limit(200);

    const now = Date.now();

    const candidates = (inactiveCustomers || []).filter((c: any) => {
      const orders = c.distribution_orders || [];
      if (orders.length === 0) return false;

      const lastOrder = orders
        .filter((o: any) => o.status !== 'cancelled')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (!lastOrder) return false;

      const daysSince = (now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= daysThreshold && daysSince < daysThreshold * 3;
    }).slice(0, maxPerRun);

    console.log(`Found ${candidates.length} inactive customers to contact`);

    let contacted = 0;

    for (const customer of candidates) {
      // Check if already contacted this week
      const { data: recentOutreach } = await supabase
        .from('anomaly_log')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('anomaly_type', 'proactive_outreach')
        .gte('triggered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (recentOutreach) continue;

      const orders = customer.distribution_orders || [];
      const lastOrder = orders
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const daysSince = Math.floor((now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24));

      const lastItems = (lastOrder.distribution_order_items || [])
        .slice(0, 3)
        .map((i: any) => `${i.quantity} ${i.order_unit || ''} ${i.product_name_raw}`.trim())
        .join(', ');

      const language = customer.preferred_language || 'papiamentu';

      const message = await generateProactiveMessage(
        customer.name,
        daysSince,
        lastItems,
        language,
        openaiKey
      );

      if (!message) continue;

      let sent = false;

      // Send via Telegram
      if (customer.telegram_chat_id && telegramToken) {
        await sendTelegramMessage(customer.telegram_chat_id, message, telegramToken);

        const { data: convo } = await supabase
          .from('dre_conversations')
          .select('id')
          .eq('external_chat_id', customer.telegram_chat_id)
          .eq('channel', 'telegram')
          .maybeSingle();

        const convoId = convo?.id || (await supabase.from('dre_conversations').insert({
          customer_id: customer.id,
          channel: 'telegram',
          external_chat_id: customer.telegram_chat_id,
          control_status: 'dre_active',
        }).select().single()).data?.id;

        if (convoId) {
          await supabase.from('dre_messages').insert({
            conversation_id: convoId,
            role: 'dre',
            content: message,
            media_type: 'text',
            language_detected: language,
          });
        }

        sent = true;
      }

      // Send via WhatsApp
      if (customer.whatsapp_phone) {
        await sendWhatsAppMessage(customer.whatsapp_phone, message);
        sent = true;
      }

      if (sent) {
        await supabase.from('anomaly_log').insert({
          customer_id: customer.id,
          anomaly_type: 'proactive_outreach',
          triggered_at: new Date().toISOString(),
          details: {
            days_since_order: daysSince,
            last_items: lastItems,
            message_sent: message,
            language,
            channels: [
              customer.telegram_chat_id ? 'telegram' : null,
              customer.whatsapp_phone ? 'whatsapp' : null,
            ].filter(Boolean),
          },
        });

        contacted++;
        console.log(`Contacted ${customer.name} via ${customer.telegram_chat_id ? 'Telegram' : 'WhatsApp'}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      success: true,
      candidates: candidates.length,
      contacted,
      threshold_days: daysThreshold,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
