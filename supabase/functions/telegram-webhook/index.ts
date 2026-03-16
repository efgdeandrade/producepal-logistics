import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) { console.error('No TELEGRAM_BOT_TOKEN'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) { console.error('sendTelegramMessage error:', e); }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = String(message.chat.id);
    const text = message.text || '';

    console.log('telegram-webhook received:', { chatId, text });

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Debug ping
    if (text === '/ping') {
      await sendTelegramMessage(chatId, [
        '🤖 Dre Debug:',
        `OPENAI_API_KEY: ${openaiKey ? '✅' : '❌ MISSING'}`,
        `TELEGRAM_BOT_TOKEN: ${telegramToken ? '✅' : '❌ MISSING'}`,
        `SUPABASE_URL: ${supabaseUrl ? '✅' : '❌ MISSING'}`,
        `SERVICE_ROLE_KEY: ${serviceKey ? '✅' : '❌ MISSING'}`,
      ].join('\n'));
      return new Response('OK', { status: 200 });
    }

    if (!openaiKey) {
      await sendTelegramMessage(chatId, 'Bot is being configured, please try again in a few minutes.');
      return new Response('OK', { status: 200 });
    }

    const supabase = createClient(supabaseUrl!, serviceKey!);

    // Identify customer
    const { data: customer } = await supabase
      .from('distribution_customers')
      .select('id, name, preferred_language')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (!customer) {
      const { data: pending } = await supabase
        .from('pending_customers')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .eq('status', 'unlinked')
        .maybeSingle();

      if (!pending) {
        const { data: newPending } = await supabase
          .from('pending_customers')
          .insert({ telegram_chat_id: chatId, first_message: text, detected_language: 'unknown', status: 'unlinked' })
          .select().single();
        await supabase.from('dre_conversations').insert({
          channel: 'telegram', external_chat_id: chatId,
          control_status: 'escalated', pending_customer_id: newPending?.id || null,
        });
        await sendTelegramMessage(chatId, "Hi! I don't recognize your account yet. What is your business name?");
      }
      return new Response('OK', { status: 200 });
    }

    // Find or create conversation
    let { data: convo } = await supabase
      .from('dre_conversations')
      .select('id, control_status')
      .eq('external_chat_id', chatId)
      .eq('channel', 'telegram')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo } = await supabase
        .from('dre_conversations')
        .insert({ customer_id: customer.id, channel: 'telegram', external_chat_id: chatId, control_status: 'dre_active' })
        .select().single();
      convo = newConvo;
    }

    if (!convo) return new Response('OK', { status: 200 });

    if (convo.control_status === 'human_in_control') {
      await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });
      await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
      return new Response('OK', { status: 200 });
    }

    // Store customer message
    await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });

    // Call GPT-4o
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: `You are Dre, the warm and professional AI sales assistant for Fuik, a fresh produce distributor in Curaçao. You communicate in Papiamentu, Dutch, English, and Spanish. Always detect and match the customer language. Papiamentu terms: kaha=case, bolsa=bag, pampuna=pumpkin, peper=pepper, patia=watermelon, mango=mango. Return ONLY valid JSON: { "intent": "order"|"question"|"complaint"|"other", "language": "english"|"dutch"|"papiamentu"|"spanish", "line_items": [{"product_name": string, "qty": number, "unit": string}], "customer_reply": string }` },
          { role: 'user', content: text },
        ],
      }),
    });

    const aiData = await aiResp.json();
    console.log('OpenAI response status:', aiResp.status);

    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
    const reply = parsed.customer_reply || "Got it! Let me help you with that.";
    const language = parsed.language || 'english';

    // If order intent, create order
    if (parsed.intent === 'order' && parsed.line_items?.length > 0) {
      const { data: order } = await supabase.from('distribution_orders').insert({
        order_number: `TG-${Date.now().toString(36).toUpperCase()}`,
        customer_id: customer.id,
        source_channel: 'telegram',
        status: 'confirmed',
        delivery_date: new Date().toISOString().split('T')[0],
      }).select().single();

      if (order) {
        for (const item of parsed.line_items) {
          await supabase.from('distribution_order_items').insert({
            order_id: order.id,
            product_name_raw: item.product_name,
            quantity: item.qty,
            order_unit: item.unit || 'kg',
          });
        }
        await supabase.from('dre_conversations').update({ order_id: order.id }).eq('id', convo.id);
      }
    }

    // Update conversation language
    await supabase.from('dre_conversations').update({ language_detected: language, updated_at: new Date().toISOString() }).eq('id', convo.id);

    // Store and send Dre reply
    await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'dre', content: reply, media_type: 'text', language_detected: language });
    await sendTelegramMessage(chatId, reply);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('telegram-webhook fatal error:', err);
    return new Response('OK', { status: 200 });
  }
});
