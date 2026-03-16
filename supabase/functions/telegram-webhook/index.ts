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

async function getBotId(): Promise<number | null> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await resp.json();
    return data?.result?.id || null;
  } catch { return null; }
}

async function checkGroupIntent(text: string, openaiKey: string): Promise<string> {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 100,
        messages: [
          { role: 'system', content: 'Classify the user message intent. Return JSON: { "intent": "order"|"question"|"complaint"|"casual"|"other" }. "casual" = greetings, small talk, side chat. "order" = placing/modifying an order. "question" = asking about products, prices, delivery. "complaint" = issue or problem.' },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return parsed.intent || 'other';
  } catch (e) {
    console.error('checkGroupIntent error:', e);
    return 'other';
  }
}

// ─── GROUP CHAT HANDLER ───────────────────────────────────────────────
async function handleGroupMessage(
  message: any,
  chatId: string,
  text: string,
  senderName: string,
  supabase: any,
  openaiKey: string,
) {
  const botId = await getBotId();
  const botUsername = Deno.env.get('TELEGRAM_BOT_USERNAME') || '';

  // Determine if Dre should respond
  const mentionsBot = botUsername && text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
  const isReplyToBot = message.reply_to_message?.from?.id === botId;
  let shouldRespond = mentionsBot || isReplyToBot;

  if (!shouldRespond) {
    const intent = await checkGroupIntent(text, openaiKey);
    console.log('Group intent classification:', intent);
    if (intent === 'casual' || intent === 'other') {
      console.log('Group: casual/other intent — staying silent');
      return;
    }
    shouldRespond = true;
  }

  // Look up customer by group chat ID
  const { data: customer } = await supabase
    .from('distribution_customers')
    .select('id, name, preferred_language')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!customer) {
    console.log('Group not linked to any customer:', chatId);
    await sendTelegramMessage(chatId, "Hi! I'm Dre, Fuik's order assistant 🌿 This group hasn't been linked to a customer account yet. Please contact us to get set up.");
    return;
  }

  console.log('Group customer found:', customer.id, customer.name);

  // Find or create conversation (one per group)
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

  if (!convo) return;

  console.log('Group conversation:', convo.id, convo.control_status);

  // Store customer message with sender prefix
  const prefixedContent = `[${senderName}]: ${text}`;
  await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: prefixedContent, media_type: 'text' });

  // If human in control, just store
  if (convo.control_status === 'human_in_control') {
    console.log('Group: human in control — stored message only');
    await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
    return;
  }

  // If escalated, tag manager
  if (convo.control_status === 'escalated') {
    const managerHandle = await getManagerHandle(supabase);
    await sendTelegramMessage(chatId, `${managerHandle} — a customer needs your attention here 🙏`);
    return;
  }

  // Call GPT-4o for response
  console.log('Group: Calling OpenAI...');
  const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: `You are Dre, the warm and professional AI sales assistant for Fuik, a fresh produce distributor in Curaçao. You communicate fluently in Papiamentu, Dutch, English, and Spanish. Always detect the language the customer is using and respond in that exact same language.

Papiamentu produce terms: kaha=case/box, bolsa=bag, kilo=kg, pampuna=pumpkin, peper=pepper, mango=mango, patia=watermelon, fresa=strawberry, pina=pineapple, papaja=papaya, komkommer=cucumber, sla=lettuce, tomaat=tomato.

This is a group chat. The sender is "${senderName}".

You MUST respond with ONLY a valid JSON object. No text before or after. No markdown. No code blocks. Just the raw JSON object.

Required format:
{
  "intent": "order",
  "needs_escalation": false,
  "language": "papiamentu",
  "line_items": [{"product_name": "mango", "qty": 2, "unit": "kaha"}],
  "customer_reply": "Ta bon! Mi a konfirmá bo orde: 2 kaha di mango. Bo lo recibi e entrega oy!"
}

Intent values: "order" | "question" | "complaint" | "casual" | "other"
Language values: "english" | "dutch" | "papiamentu" | "spanish"
For casual messages set line_items to [].
The customer_reply must ALWAYS be in the same language as the customer's message.
Never use the fallback phrase "Got it! Let me help you with that." — always write a real, warm, specific reply.` },
        { role: 'user', content: text },
      ],
    }),
  });

  console.log('Group OpenAI raw response status:', aiResp.status);
  const aiData = await aiResp.json();
  console.log('Group OpenAI raw content:', aiData.choices?.[0]?.message?.content);
  console.log('Group OpenAI finish reason:', aiData.choices?.[0]?.finish_reason);
  console.log('Group OpenAI usage:', JSON.stringify(aiData.usage));

  let parsed: any = {};
  try {
    const rawContent = aiData.choices?.[0]?.message?.content || '{}';
    console.log('Group parsing content:', rawContent);

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const stripped = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    console.log('Group parsed intent:', parsed.intent);
    console.log('Group parsed reply:', parsed.customer_reply);
    console.log('Group parsed line_items:', JSON.stringify(parsed.line_items));

  } catch (e) {
    console.error('Group JSON parse failed:', e);
    parsed = {
      intent: 'other',
      language: 'english',
      line_items: [],
      customer_reply: 'Sorry, I had trouble understanding that. Could you please repeat your order?',
      needs_escalation: false
    };
  }

  console.log('Group OpenAI parsed:', JSON.stringify(parsed));

  // Escalate if needed
  if (parsed.intent === 'complaint' || parsed.needs_escalation) {
    const managerHandle = await getManagerHandle(supabase);
    await supabase.from('dre_conversations').update({ control_status: 'escalated', updated_at: new Date().toISOString() }).eq('id', convo.id);
    await sendTelegramMessage(chatId, `${managerHandle} — a customer needs your attention here 🙏`);
    // Still send Dre's reply if there is one
    if (parsed.customer_reply) {
      await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'dre', content: parsed.customer_reply, media_type: 'text', language_detected: parsed.language || 'english' });
      await sendTelegramMessage(chatId, parsed.customer_reply);
    }
    return;
  }

  const reply = parsed.customer_reply && parsed.customer_reply !== 'Got it! Let me help you with that.'
    ? parsed.customer_reply
    : 'Sorry, I had trouble understanding that. Could you please repeat your order?';
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
      // Load products with aliases for matching
      const { data: products } = await supabase
        .from('distribution_products')
        .select('id, name, name_aliases, unit_options')
        .eq('is_active', true);

      for (const item of parsed.line_items) {
        let matchedProductId: string | null = null;
        const searchName = (item.product_name || '').toLowerCase().trim();

        for (const p of (products || [])) {
          if (p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase())) {
            matchedProductId = p.id;
            break;
          }
          const aliases = p.name_aliases || [];
          for (const alias of aliases) {
            if (alias.toLowerCase() === searchName || searchName.includes(alias.toLowerCase())) {
              matchedProductId = p.id;
              break;
            }
          }
          if (matchedProductId) break;
        }

        await supabase.from('distribution_order_items').insert({
          order_id: order.id,
          product_name_raw: item.product_name,
          product_id: matchedProductId,
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
}

async function getManagerHandle(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'manager_telegram_handle')
    .maybeSingle();
  return data?.value || '@FuikManager';
}

// ─── PRIVATE CHAT HANDLER (unchanged logic) ──────────────────────────
async function handlePrivateMessage(
  message: any,
  chatId: string,
  text: string,
  supabase: any,
  openaiKey: string,
) {
  // Identify customer
  const { data: customer } = await supabase
    .from('distribution_customers')
    .select('id, name, preferred_language')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!customer) {
    console.log('No customer found for chatId:', chatId, '— checking pending_customers');

    const { data: existingPending } = await supabase
      .from('pending_customers')
      .select('id, linked_customer_id, status')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (existingPending) {
      console.log('Existing pending customer found:', existingPending.id, 'status:', existingPending.status);

      if (existingPending.status === 'linked' && existingPending.linked_customer_id) {
        console.log('Pending customer is linked to:', existingPending.linked_customer_id);
        const { data: linkedCustomer } = await supabase
          .from('distribution_customers')
          .select('id, name, preferred_language')
          .eq('id', existingPending.linked_customer_id)
          .maybeSingle();

        if (linkedCustomer) {
          await supabase
            .from('distribution_customers')
            .update({ telegram_chat_id: chatId })
            .eq('id', linkedCustomer.id);
          console.log('Backfilled telegram_chat_id on customer:', linkedCustomer.id);
          await sendTelegramMessage(chatId, `Welcome back, ${linkedCustomer.name}! How can I help you today?`);
          return;
        }
      }

      console.log('Pending customer exists but not yet linked, skipping duplicate creation');
      return;
    }

    console.log('Creating new pending_customers row');
    const { data: newPending } = await supabase
      .from('pending_customers')
      .insert({ telegram_chat_id: chatId, first_message: text, detected_language: 'unknown', status: 'unlinked' })
      .select().single();
    await supabase.from('dre_conversations').insert({
      channel: 'telegram', external_chat_id: chatId,
      control_status: 'escalated', pending_customer_id: newPending?.id || null,
    });
    await sendTelegramMessage(chatId, "Hi! I don't recognize your account yet. What is your business name?");
    return;
  }

  console.log('Customer found:', customer.id, customer.name);

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

  console.log('Conversation:', convo?.id, convo?.control_status);

  if (!convo) return;

  if (convo.control_status === 'human_in_control') {
    console.log('Human in control — storing message only');
    await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });
    await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
    return;
  }

  // Store customer message
  await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });

  // Call GPT-4o
  console.log('Calling OpenAI...');
  const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: `You are Dre, the warm and professional AI sales assistant for Fuik, a fresh produce distributor in Curaçao. You communicate fluently in Papiamentu, Dutch, English, and Spanish. Always detect the language the customer is using and respond in that exact same language.

Papiamentu produce terms: kaha=case/box, bolsa=bag, kilo=kg, pampuna=pumpkin, peper=pepper, mango=mango, patia=watermelon, fresa=strawberry, pina=pineapple, papaja=papaya, komkommer=cucumber, sla=lettuce, tomaat=tomato.

You MUST respond with ONLY a valid JSON object. No text before or after. No markdown. No code blocks. Just the raw JSON object.

Required format:
{
  "intent": "order",
  "language": "papiamentu",
  "line_items": [{"product_name": "mango", "qty": 2, "unit": "kaha"}],
  "customer_reply": "Ta bon! Mi a konfirmá bo orde: 2 kaha di mango. Bo lo recibi e entrega oy!"
}

Intent values: "order" | "question" | "complaint" | "casual" | "other"
Language values: "english" | "dutch" | "papiamentu" | "spanish"
For casual messages set line_items to [].
The customer_reply must ALWAYS be in the same language as the customer's message.
Never use the fallback phrase "Got it! Let me help you with that." — always write a real, warm, specific reply.` },
        { role: 'user', content: text },
      ],
    }),
  });

  console.log('OpenAI raw response status:', aiResp.status);
  const aiData = await aiResp.json();
  console.log('OpenAI raw content:', aiData.choices?.[0]?.message?.content);
  console.log('OpenAI finish reason:', aiData.choices?.[0]?.finish_reason);
  console.log('OpenAI usage:', JSON.stringify(aiData.usage));

  let parsed: any = {};
  try {
    const rawContent = aiData.choices?.[0]?.message?.content || '{}';
    console.log('Parsing content:', rawContent);

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const stripped = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    console.log('Parsed intent:', parsed.intent);
    console.log('Parsed language:', parsed.language);
    console.log('Parsed reply:', parsed.customer_reply);
    console.log('Parsed line_items:', JSON.stringify(parsed.line_items));

  } catch (e) {
    console.error('JSON parse failed:', e);
    parsed = {
      intent: 'other',
      language: 'english',
      line_items: [],
      customer_reply: 'Sorry, I had trouble understanding that. Could you please repeat your order?'
    };
  }

  const reply = parsed.customer_reply && parsed.customer_reply !== 'Got it! Let me help you with that.'
    ? parsed.customer_reply
    : 'Sorry, I had trouble understanding that. Could you please repeat your order?';
  const language = parsed.language || 'english';

  console.log('Sending reply:', reply);

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
      // Load products with aliases for matching
      const { data: products } = await supabase
        .from('distribution_products')
        .select('id, name, name_aliases, unit_options')
        .eq('is_active', true);

      for (const item of parsed.line_items) {
        let matchedProductId: string | null = null;
        const searchName = (item.product_name || '').toLowerCase().trim();

        for (const p of (products || [])) {
          if (p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase())) {
            matchedProductId = p.id;
            break;
          }
          const aliases = p.name_aliases || [];
          for (const alias of aliases) {
            if (alias.toLowerCase() === searchName || searchName.includes(alias.toLowerCase())) {
              matchedProductId = p.id;
              break;
            }
          }
          if (matchedProductId) break;
        }

        await supabase.from('distribution_order_items').insert({
          order_id: order.id,
          product_name_raw: item.product_name,
          product_id: matchedProductId,
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
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = String(message.chat.id);
    const text = message.text || '';
    const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
    const senderName = message.from?.first_name || message.from?.username || 'Someone';

    console.log('telegram-webhook received:', { chatId, text, isGroup, senderName });

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
        `Chat type: ${message.chat.type}`,
        `Chat ID: ${chatId}`,
      ].join('\n'));
      return new Response('OK', { status: 200 });
    }

    if (!openaiKey) {
      await sendTelegramMessage(chatId, 'Bot is being configured, please try again in a few minutes.');
      return new Response('OK', { status: 200 });
    }

    const supabase = createClient(supabaseUrl!, serviceKey!);

    if (isGroup) {
      await handleGroupMessage(message, chatId, text, senderName, supabase, openaiKey);
    } else {
      await handlePrivateMessage(message, chatId, text, supabase, openaiKey);
    }

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('telegram-webhook fatal error:', err);
    return new Response('OK', { status: 200 });
  }
});
