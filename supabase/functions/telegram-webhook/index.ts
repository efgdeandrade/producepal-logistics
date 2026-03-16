import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dre's system prompt for Telegram
const DRE_SYSTEM_PROMPT = `You are Dre, the warm and professional AI sales assistant for Fuik, a fresh produce distributor in Curaçao. You communicate fluently in Papiamentu, Dutch, English, and Spanish.
Always detect the language the customer is using and respond in that exact same language.
If the customer switches language mid-conversation, switch with them immediately.

Papiamentu is a creole language spoken in Curaçao — treat it as a primary language, not a dialect. Common Papiamentu produce terms: kaha=case/box, bolsa=bag, kilo=kg, pampuna=pumpkin, peper=pepper, tomaat=tomato, mango=mango, papaya=papaya, komkommer=cucumber, sla/lechuga=lettuce, patia=watermelon, fresa=strawberry, pina/ananas=pineapple.

You handle orders AND general customer questions. You are a full customer service agent, not only an order taker. Be warm, human, and never robotic.

When you receive an order (any format — text, transcribed voice, or image OCR), parse it and return ONLY this JSON, no other text:
{
  "intent": "order",
  "language": "english" | "dutch" | "papiamentu" | "spanish",
  "line_items": [{ "product_name": "string", "qty": number, "unit": "string" }],
  "customer_reply": "string"
}
For non-order messages return:
{
  "intent": "question" | "complaint" | "other",
  "language": "english" | "dutch" | "papiamentu" | "spanish",
  "line_items": [],
  "customer_reply": "string"
}
Never fabricate product names — use exactly what the customer said. The customer_reply is what you send back to the customer.`;

// Late order hold messages by language
const LATE_HOLD_MESSAGES: Record<string, string> = {
  english: "The cut-off for same-day delivery was 7am, but let me check with my manager to see if we can still get this to you today!",
  papiamentu: "E ora di kòrtementu pa entrega mesun dia tabata 7am, pero laga mi kontrola ku mi manager si nos por tòg entregá bo oi!",
  dutch: "De besteldeadline voor dezelfde dag was 7 uur, maar ik check even met mijn manager of we het vandaag nog kunnen leveren!",
  spanish: "El plazo de pedido para entrega el mismo día era las 7am, pero déjame consultar con mi gerente si aún podemos entregártelo hoy.",
};

// Next-day messages by language
const NEXT_DAY_MESSAGES: Record<string, string> = {
  english: "Got it! Since it's past the stock window, I've scheduled this for delivery tomorrow. You'll be all set! 🚛",
  papiamentu: "Ta bon! Pasobra e ora di stock a pasa kaba, mi a programá esaki pa entrega mañan. Bo ta kla! 🚛",
  dutch: "Begrepen! Omdat het voorbij het voorraadvenster is, heb ik dit voor morgen gepland. Je bent helemaal geregeld! 🚛",
  spanish: "¡Entendido! Como ya pasó la ventana de stock, lo he programado para entrega mañana. ¡Todo listo! 🚛",
};

function getCuracaoTime(): Date {
  const now = new Date();
  const curacaoOffset = -4 * 60;
  const localOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (localOffset - curacaoOffset) * 60000);
}

function getCuracaoDateStr(): string {
  return getCuracaoTime().toISOString().split('T')[0];
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hours: parseInt(m[1]), minutes: parseInt(m[2]) };
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) { console.error('TELEGRAM_BOT_TOKEN not set'); return false; }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!resp.ok) { console.error('Telegram send error:', await resp.text()); return false; }
    return true;
  } catch (e) { console.error('Telegram send exception:', e); return false; }
}

async function downloadTelegramFile(fileId: string): Promise<{ data: Uint8Array; filePath: string } | null> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  try {
    const fileResp = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileResp.json();
    if (!fileData.ok) return null;
    const filePath = fileData.result.file_path;
    const dlResp = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!dlResp.ok) return null;
    const data = new Uint8Array(await dlResp.arrayBuffer());
    return { data, filePath };
  } catch (e) { console.error('File download error:', e); return null; }
}

async function callOpenAI(messages: Array<{ role: string; content: any }>): Promise<{
  intent: string;
  language: string;
  line_items: Array<{ product_name: string; qty: number; unit: string }>;
  customer_reply: string;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      intent: parsed.intent || 'other',
      language: parsed.language || 'english',
      line_items: parsed.line_items || [],
      customer_reply: parsed.customer_reply || 'I understood your message.',
    };
  } catch {
    return { intent: 'other', language: 'english', line_items: [], customer_reply: content };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const update = await req.json();
    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = String(message.chat.id);
    const messageText = message.text || '';

    // /ping debug command
    if (messageText === '/ping') {
      const hasOpenAI = !!Deno.env.get('OPENAI_API_KEY');
      const hasTelegramToken = !!Deno.env.get('TELEGRAM_BOT_TOKEN');
      const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
      const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      const debugMsg = [
        '🤖 Dre Debug Report:',
        `OPENAI_API_KEY: ${hasOpenAI ? '✅' : '❌ MISSING'}`,
        `TELEGRAM_BOT_TOKEN: ${hasTelegramToken ? '✅' : '❌ MISSING'}`,
        `SUPABASE_URL: ${hasSupabaseUrl ? '✅' : '❌ MISSING'}`,
        `SERVICE_ROLE_KEY: ${hasServiceKey ? '✅' : '❌ MISSING'}`,
      ].join('\n');

      await sendTelegramMessage(chatId, debugMsg);
      return new Response('OK', { status: 200 });
    }

    // Check if OPENAI_API_KEY is configured before doing anything
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not set — cannot process message');
      await sendTelegramMessage(chatId, 'Bot is being configured, please try again in a few minutes.');
      return new Response('OK', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // STEP 2 — Identify the customer
    let customerId: string | null = null;
    let customerName: string | null = null;

    const { data: customer } = await supabase
      .from('distribution_customers')
      .select('id, name, preferred_language')
      .eq('telegram_chat_id', chatId)
      .limit(1)
      .single();

    if (customer) {
      customerId = customer.id;
      customerName = customer.name;
    } else {
      // Check pending_customers
      const { data: pending } = await supabase
        .from('pending_customers')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .eq('status', 'unlinked')
        .limit(1)
        .single();

      if (!pending) {
        // Create pending customer
        const { data: newPending } = await supabase.from('pending_customers').insert({
          telegram_chat_id: chatId,
          first_message: messageText || '[media]',
          detected_language: 'unknown',
          status: 'unlinked',
        }).select().single();

        // Create escalated conversation
        await supabase.from('dre_conversations').insert({
          channel: 'telegram',
          external_chat_id: chatId,
          control_status: 'escalated',
          pending_customer_id: newPending?.id || null,
        });

        await sendTelegramMessage(chatId, "Hi! I don't recognize your account yet. What is your business name?");
        return new Response('OK', { status: 200 });
      }

      // Pending customer exists but not linked — still escalated
      const { data: existingConvo } = await supabase
        .from('dre_conversations')
        .select('id')
        .eq('external_chat_id', chatId)
        .eq('channel', 'telegram')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingConvo) {
        await supabase.from('dre_messages').insert({
          conversation_id: existingConvo.id,
          role: 'customer',
          content: messageText || '[media]',
          media_type: 'text',
        });
        await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', existingConvo.id);
      }
      return new Response('OK', { status: 200 });
    }

    // STEP 3 — Check/create conversation
    let { data: conversation } = await supabase
      .from('dre_conversations')
      .select('id, control_status')
      .eq('external_chat_id', chatId)
      .eq('channel', 'telegram')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConvo } = await supabase.from('dre_conversations').insert({
        customer_id: customerId,
        channel: 'telegram',
        external_chat_id: chatId,
        control_status: 'dre_active',
      }).select().single();
      conversation = newConvo;
    }

    if (!conversation) return new Response('OK', { status: 200 });

    // If human in control, store message and exit
    if (conversation.control_status === 'human_in_control') {
      await supabase.from('dre_messages').insert({
        conversation_id: conversation.id,
        role: 'customer',
        content: messageText || '[media]',
        media_type: 'text',
      });
      await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id);
      return new Response('OK', { status: 200 });
    }

    // STEP 4 — Process media
    let processedText = messageText;
    let mediaType = 'text';
    let mediaUrl: string | null = null;

    // Voice message
    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      const downloaded = await downloadTelegramFile(fileId);
      if (downloaded) {
        // Upload to storage
        const storagePath = `voice/${chatId}/${Date.now()}.ogg`;
        await supabase.storage.from('order-media').upload(storagePath, downloaded.data, { contentType: 'audio/ogg' });
        const { data: urlData } = supabase.storage.from('order-media').getPublicUrl(storagePath);
        mediaUrl = urlData.publicUrl;

        // Use OpenAI Whisper for transcription
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        try {
          const formData = new FormData();
          const blob = new Blob([downloaded.data], { type: 'audio/ogg' });
          formData.append('file', blob, 'voice.ogg');
          formData.append('model', 'whisper-1');
          const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
          });
          const whisperData = await whisperResp.json();
          processedText = whisperData.text || '[transcription failed]';
        } catch {
          processedText = messageText || '[voice note - transcription failed]';
        }
        mediaType = 'voice';
      }
    }

    // Photo
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const downloaded = await downloadTelegramFile(largestPhoto.file_id);
      if (downloaded) {
        const storagePath = `photo/${chatId}/${Date.now()}.jpg`;
        await supabase.storage.from('order-media').upload(storagePath, downloaded.data, { contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('order-media').getPublicUrl(storagePath);
        mediaUrl = urlData.publicUrl;
        mediaType = 'image';
        if (message.caption) processedText = message.caption;
      }
    }

    // STEP 5 — Load product context and call AI
    const [productsResult, aliasesResult] = await Promise.all([
      supabase.from('distribution_products').select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit').eq('is_active', true),
      supabase.from('distribution_product_aliases').select('alias, product_id'),
    ]);

    const products = productsResult.data || [];
    const aliases = aliasesResult.data || [];

    // Build product context
    const productList = products.slice(0, 80).map(p => {
      const prodAliases = aliases.filter(a => a.product_id === p.id).map(a => a.alias);
      return `- ${p.name} (${p.code}): ${[p.name_pap, p.name_nl, p.name_es].filter(Boolean).join(', ')}${prodAliases.length ? ` | Aliases: ${prodAliases.join(', ')}` : ''}`;
    }).join('\n');

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from('dre_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20);

    const chatHistory: Array<{ role: string; content: string }> = (recentMessages || []).map(m => ({
      role: m.role === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }));

    const aiMessages: Array<{ role: string; content: any }> = [
      { role: 'system', content: DRE_SYSTEM_PROMPT + `\n\n## AVAILABLE PRODUCTS\n${productList}` },
      ...chatHistory,
    ];

    // Add current message
    if (mediaType === 'image' && mediaUrl) {
      aiMessages.push({ role: 'user', content: [
        { type: 'text', text: processedText || 'What is in this image? If it contains an order, parse it.' },
        { type: 'image_url', image_url: { url: mediaUrl } },
      ] as any });
    } else {
      aiMessages.push({ role: 'user', content: processedText });
    }

    const aiResponse = await callOpenAI(aiMessages);

    // STEP 6 — Store customer message
    await supabase.from('dre_messages').insert({
      conversation_id: conversation.id,
      role: 'customer',
      content: processedText || '[media]',
      media_type: mediaType,
      media_url: mediaUrl,
      language_detected: aiResponse.language,
    });

    await supabase.from('dre_conversations').update({
      language_detected: aiResponse.language,
      updated_at: new Date().toISOString(),
    }).eq('id', conversation.id);

    let replyText = aiResponse.customer_reply;

    if (aiResponse.intent === 'order' && aiResponse.line_items.length > 0) {
      // Read cutoff/stock times from app_settings
      const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['cutoff_time', 'stock_window_time']);
      const settingsMap: Record<string, string> = {};
      (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

      const cutoff = parseTime(settingsMap.cutoff_time || '07:00');
      const stockWindow = parseTime(settingsMap.stock_window_time || '09:00');
      const curacaoNow = getCuracaoTime();
      const nowMinutes = curacaoNow.getHours() * 60 + curacaoNow.getMinutes();
      const cutoffMinutes = cutoff ? cutoff.hours * 60 + cutoff.minutes : 420;
      const stockMinutes = stockWindow ? stockWindow.hours * 60 + stockWindow.minutes : 540;

      const orderNumber = `TG-${Date.now().toString(36).toUpperCase()}`;
      let orderStatus = 'confirmed';
      let isLateOrder = false;
      let lateDecision: string | null = null;
      let deliveryDate = getCuracaoDateStr();

      if (nowMinutes <= cutoffMinutes) {
        orderStatus = 'confirmed';
      } else if (nowMinutes <= stockMinutes) {
        orderStatus = 'draft';
        isLateOrder = true;
        lateDecision = 'pending';
        replyText = LATE_HOLD_MESSAGES[aiResponse.language] || LATE_HOLD_MESSAGES.english;
      } else {
        isLateOrder = true;
        orderStatus = 'confirmed';
        const tomorrow = new Date(curacaoNow);
        tomorrow.setDate(tomorrow.getDate() + 1);
        deliveryDate = tomorrow.toISOString().split('T')[0];
        replyText = NEXT_DAY_MESSAGES[aiResponse.language] || NEXT_DAY_MESSAGES.english;
      }

      // Create order
      const { data: order } = await supabase.from('distribution_orders').insert({
        order_number: orderNumber,
        customer_id: customerId,
        source_channel: 'telegram',
        status: orderStatus,
        delivery_date: deliveryDate,
        is_late_order: isLateOrder,
        late_order_manager_decision: lateDecision,
        language_used: aiResponse.language,
      }).select().single();

      if (order) {
        for (const item of aiResponse.line_items) {
          const searchName = item.product_name.toLowerCase().trim();
          let matchedProductId: string | null = null;

          // Check aliases
          for (const alias of aliases) {
            if (alias.alias.toLowerCase() === searchName || searchName.includes(alias.alias.toLowerCase())) {
              matchedProductId = alias.product_id;
              break;
            }
          }

          // Check product names
          if (!matchedProductId) {
            for (const p of products) {
              const names = [p.name, p.name_pap, p.name_nl, p.name_es].filter(Boolean).map(n => (n as string).toLowerCase());
              if (names.some(n => n === searchName || n.includes(searchName) || searchName.includes(n))) {
                matchedProductId = p.id;
                break;
              }
            }
          }

          await supabase.from('distribution_order_items').insert({
            order_id: order.id,
            product_id: matchedProductId,
            product_name_raw: item.product_name,
            quantity: item.qty,
            order_unit: item.unit || null,
          });
        }

        await supabase.from('dre_conversations').update({
          order_id: order.id,
          updated_at: new Date().toISOString(),
        }).eq('id', conversation.id);
      }
    }

    // If escalation needed
    if (aiResponse.intent === 'complaint' || (aiResponse.intent === 'other' && aiResponse.customer_reply.toLowerCase().includes('cannot help'))) {
      await supabase.from('dre_conversations').update({
        control_status: 'escalated',
        updated_at: new Date().toISOString(),
      }).eq('id', conversation.id);
    }

    // STEP 7 — Send reply via Telegram
    await sendTelegramMessage(chatId, replyText);

    // Store Dre's reply
    await supabase.from('dre_messages').insert({
      conversation_id: conversation.id,
      role: 'dre',
      content: replyText,
      media_type: 'text',
      language_detected: aiResponse.language,
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('telegram-webhook error:', error);
    return new Response('OK', { status: 200 }); // Always return 200 to Telegram
  }
});
