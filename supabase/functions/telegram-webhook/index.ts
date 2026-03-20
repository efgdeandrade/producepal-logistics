// Dre AI Agent v4 — Telegram Webhook
// GPT-4o function calling with Gemini Flash language detection
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  detectLanguage, runDreAgent, sanitizeReply, loadCustomerMemory,
  type DreContext, type OrderDraft,
} from '../_shared/dre-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string, token: string): Promise<void> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const result = await resp.json();
    if (!result.ok) console.error('Telegram send failed:', JSON.stringify(result));
  } catch (e) {
    console.error('sendTelegramMessage error:', e);
  }
}

// ═══════════════════════════════════════════════════
// BOLENGA TRAINING RESPONSE HANDLER (preserved from v3)
// ═══════════════════════════════════════════════════

async function handleBolengaResponse(
  supabase: any,
  chatId: string,
  message: any,
  text: string,
  telegramToken: string
): Promise<void> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

  const { data: latestSession } = await supabase
    .from('papiamentu_training_sessions')
    .select('id')
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) {
    await sendTelegramMessage(chatId, 'No active training session found. Training starts automatically each morning! 🌿', telegramToken);
    return;
  }

  const { data: nextQuestion } = await supabase
    .from('papiamentu_training_questions')
    .select('*')
    .eq('session_id', latestSession.id)
    .eq('status', 'sent')
    .order('question_number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextQuestion) {
    await sendTelegramMessage(chatId, '✅ All questions for today are answered! Danki Bolenga 🙏 Dre is getting smarter!', telegramToken);
    await supabase.from('papiamentu_training_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', latestSession.id);
    return;
  }

  let responseText = text;
  let responseAudioUrl: string | null = null;

  // Handle voice response from Bolenga
  if (message.voice || message.audio) {
    const fileId = message.voice?.file_id || message.audio?.file_id;
    try {
      const fileResp = await fetch(
        `https://api.telegram.org/bot${telegramToken}/getFile`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: fileId }) }
      );
      const fileData = await fileResp.json();
      const filePath = fileData.result?.file_path;
      if (filePath) {
        const dlResp = await fetch(`https://api.telegram.org/file/bot${telegramToken}/${filePath}`);
        const audioData = new Uint8Array(await dlResp.arrayBuffer());

        const storagePath = `training/responses/${nextQuestion.id}.ogg`;
        await supabase.storage.from('order-media').upload(storagePath, audioData, {
          contentType: 'audio/ogg', upsert: true,
        });
        const { data: urlData } = supabase.storage.from('order-media').getPublicUrl(storagePath);
        responseAudioUrl = urlData?.publicUrl || null;

        const formData = new FormData();
        formData.append('file', new Blob([audioData], { type: 'audio/ogg' }), 'response.ogg');
        formData.append('model', 'whisper-1');
        formData.append('language', 'nl');

        const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          body: formData,
        });
        const whisperData = await whisperResp.json();
        responseText = whisperData.text || '[voice response - transcription failed]';
      }
    } catch (e) {
      console.error('Voice processing error:', e);
    }
  }

  await supabase.from('papiamentu_training_questions').update({
    kathy_response_text: responseText,
    kathy_response_audio_url: responseAudioUrl,
    kathy_response_transcription: responseAudioUrl ? responseText : null,
    responded_at: new Date().toISOString(),
    status: 'responded',
  }).eq('id', nextQuestion.id);

  const { data: entry } = await supabase.from('papiamentu_training_entries').insert({
    original_question: nextQuestion.question_text,
    kathy_response: responseText,
    corrected_phrase: responseText,
    category: nextQuestion.category,
    example_context: nextQuestion.context,
    audio_url: responseAudioUrl,
    transcription: responseAudioUrl ? responseText : null,
    confidence_score: 0.7,
    added_by: 'bolenga',
  }).select().single();

  if (entry) {
    await supabase.from('papiamentu_training_questions').update({
      entry_id: entry.id,
      status: 'entry_created',
    }).eq('id', nextQuestion.id);
  }

  const { count } = await supabase
    .from('papiamentu_training_questions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', latestSession.id)
    .eq('status', 'sent');

  const remaining = (count || 1) - 1;
  const ackMsg = remaining > 0
    ? `✅ Saved! ${remaining} question${remaining !== 1 ? 's' : ''} remaining today.`
    : '✅ Last one done! Danki Bolenga 🙏 Training complete for today!';

  await sendTelegramMessage(chatId, ackMsg, telegramToken);

  if (remaining === 0) {
    await supabase.from('papiamentu_training_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      responses_received: nextQuestion.question_number,
      entries_created: nextQuestion.question_number,
    }).eq('id', latestSession.id);
  }
}

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = String(message.chat.id);
    const text = (message.text || '').trim();
    const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
    const senderName = message.from?.first_name || null;

    console.log('Received:', JSON.stringify({ chatId, text: text.substring(0, 50), isGroup, chatType: message.chat.type }));

    if (!text && !message.voice && !message.audio) return new Response('OK', { status: 200 });

    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Activation code detection (before anything else) ──
    console.log('CHECKPOINT 1: activation code check, text starts with FUIK-?', text.startsWith('FUIK-'));
    if (text.startsWith('FUIK-') && isGroup) {
      console.log('Activation code detected in group:', text, 'chat:', chatId);

      const { data: pending } = await supabase
        .from('customer_telegram_groups')
        .select('*, distribution_customers(id, name, preferred_language)')
        .eq('activation_code', text.trim())
        .eq('status', 'pending')
        .maybeSingle();

      if (pending) {
        const activationCustomer = pending.distribution_customers as any;
        const groupName = message.chat.title || `FUIK | ${activationCustomer.name}`;

        await supabase.from('customer_telegram_groups').update({
          group_chat_id: chatId,
          group_name: groupName,
          status: 'activated',
          activated_at: new Date().toISOString(),
        }).eq('id', pending.id);

        await supabase.from('distribution_customers').update({
          telegram_chat_id: chatId,
        }).eq('id', activationCustomer.id);

        const curacaoHour = new Date(Date.now() - 4 * 60 * 60 * 1000).getUTCHours();
        const greeting = curacaoHour < 12 ? 'Bon dia' : curacaoHour < 18 ? 'Bon tardi' : 'Bon nochi';

        await sendTelegramMessage(chatId, `${greeting}! 🌿

<b>Papiamentu:</b>
Bon bini na bo grupo di FUIK, ${activationCustomer.name}! Mi ta Dre, bo asistente dijital pa tur bo orde di fruta i berdura fresco. Simplemente dimi kiko bo ke i mi ta yuda bo mes ora. 🥭

<b>English:</b>
Welcome to your FUIK ordering group, ${activationCustomer.name}! I'm Dre, your digital assistant for all fresh produce orders. Just tell me what you need and I'll take care of it right away. 🌿

<b>Español:</b>
¡Bienvenido al grupo de pedidos de FUIK, ${activationCustomer.name}! Soy Dre, tu asistente digital para todos tus pedidos de frutas y verduras frescas. 🍍

<b>Nederlands:</b>
Welkom in je FUIK bestelgroep, ${activationCustomer.name}! Ik ben Dre, je digitale assistent voor al je bestellingen. 🥦

━━━━━━━━━━━━━━━
💬 Papiamentu: Mi ke 2 kaha di mango
💬 English: I want 2 cases of mango
💬 Español: Quiero 2 cajas de mango
💬 Nederlands: Ik wil 2 dozen mango`, telegramToken);

        await supabase.from('customer_telegram_groups').update({
          welcome_sent_at: new Date().toISOString(),
        }).eq('id', pending.id);

        // Notify manager
        const { data: managerSetting } = await supabase
          .from('app_settings').select('value').eq('key', 'manager_telegram_chat_id').maybeSingle();
        if (managerSetting?.value) {
          await sendTelegramMessage(managerSetting.value,
            `✅ Telegram group activated for ${activationCustomer.name}!\nGroup: ${groupName}\nDre is ready to take orders. 🌿`,
            telegramToken);
        }

        return new Response('OK', { status: 200 });
      } else {
        await sendTelegramMessage(chatId, '⚠️ Invalid or expired activation code. Please generate a new one from the FUIK ERP.', telegramToken);
        return new Response('OK', { status: 200 });
      }
    }

    // ── Group chat filtering ──────────────────────────────
    console.log('CHECKPOINT 2: group filtering, isGroup?', isGroup);
    if (isGroup) {
      const botUsername = 'FuikOrdersBot';
      const textLowerGroup = text.toLowerCase();
      const isMentioned = textLowerGroup.includes(`@${botUsername.toLowerCase()}`);
      const isReplyToBot = message.reply_to_message?.from?.username === botUsername;

      const BUSINESS_KEYWORDS = [
        'kaha', 'bolsa', 'saku', 'kilo', 'kg', 'mi ke', 'mi kier', 'order', 'orde',
        'mango', 'pampuna', 'tomaat', 'wortel', 'papaja', 'fresa', 'patia',
        'want', 'need', 'quiero', 'wil', 'bestelling',
        'price', 'precio', 'prijs', 'available', 'stock',
        'bon dia', 'bon tardi', 'bon nochi', 'hello', 'halo', 'hi ',
        'tambe', 'otro kos', 'adishonal', 'ta bon', 'si', 'yes', 'ja',
      ];

      const hasBusinessContent = BUSINESS_KEYWORDS.some(kw => textLowerGroup.includes(kw));
      console.log('CHECKPOINT 2b: group filter result:', JSON.stringify({ isMentioned, isReplyToBot, hasBusinessContent }));
      if (!isMentioned && !isReplyToBot && !hasBusinessContent) {
        console.log('CHECKPOINT 2c: FILTERED OUT — no business content, returning');
        return new Response('OK', { status: 200 });
      }
      console.log('CHECKPOINT 2d: passed group filter');
    }

    // ── Route Bolenga training responses ─────────────────
    console.log('CHECKPOINT 3: bolenga check');
    const { data: bolengaSetting } = await supabase
      .from('app_settings').select('value').eq('key', 'bolenga_telegram_chat_id').maybeSingle();

    if (bolengaSetting?.value && chatId === bolengaSetting.value) {
      await handleBolengaResponse(supabase, chatId, message, text, telegramToken);
      return new Response('OK', { status: 200 });
    }

    // ── /ping debug ──────────────────────────────────────
    if (text === '/ping') {
      await sendTelegramMessage(chatId, [
        '🤖 Dre Agent v4 (Function Calling):',
        `OPENAI_API_KEY: ${openaiKey ? '✅' : '❌'}`,
        `LOVABLE_API_KEY: ${lovableKey ? '✅' : '❌'}`,
        `TELEGRAM_BOT_TOKEN: ${telegramToken ? '✅' : '❌'}`,
        `SUPABASE_URL: ${Deno.env.get('SUPABASE_URL') ? '✅' : '❌'}`,
        'Architecture: Function Calling v4 ✅',
      ].join('\n'), telegramToken);
      return new Response('OK', { status: 200 });
    }

    // ── Identify customer ────────────────────────────────
    const lookupId = chatId;
    console.log('CHECKPOINT 4: customer lookup for', lookupId);

    const { data: customer, error: customerError } = await supabase
      .from('distribution_customers')
      .select('id, name, preferred_language, telegram_chat_id, whatsapp_phone')
      .eq('telegram_chat_id', lookupId)
      .maybeSingle();

    if (!customer) {
      console.log('UNRECOGNIZED CONTACT chat_id:', chatId);

      const { data: pending } = await supabase
        .from('pending_customers')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .eq('status', 'unlinked')
        .maybeSingle();

      if (!pending) {
        const { data: newPending } = await supabase
          .from('pending_customers')
          .insert({ telegram_chat_id: chatId, first_message: text, status: 'unlinked' })
          .select().single();

        await supabase.from('dre_conversations').insert({
          channel: 'telegram', external_chat_id: chatId,
          control_status: 'escalated', pending_customer_id: newPending?.id,
        });

        await sendTelegramMessage(chatId,
          "Hi! I don't recognize your account yet. What is your business name? 🌿", telegramToken);
      }
      return new Response('OK', { status: 200 });
    }

    // ── Find or create conversation ──────────────────────
    let { data: convo } = await supabase
      .from('dre_conversations')
      .select('id, control_status, agent_state, language_detected')
      .eq('external_chat_id', lookupId)
      .eq('channel', 'telegram')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo } = await supabase
        .from('dre_conversations')
        .insert({
          customer_id: customer.id, channel: 'telegram',
          external_chat_id: lookupId, control_status: 'dre_active',
          agent_state: { order_draft: { items: [] } },
        }).select().single();
      convo = newConvo;
    }

    if (!convo) return new Response('OK', { status: 200 });

    // Human in control — just store message
    if (convo.control_status === 'human_in_control') {
      await supabase.from('dre_messages').insert({
        conversation_id: convo.id, role: 'customer', content: text, media_type: 'text',
      });
      await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
      return new Response('OK', { status: 200 });
    }

    // ── Load all context in parallel ─────────────────────
    const [
      langResult,
      productsResult,
      aliasesResult,
      dictResult,
      trainingResult,
      historyResult,
      pendingOrderResult,
      memoryResult,
    ] = await Promise.all([
      detectLanguage(text, lovableKey),
      supabase.from('distribution_products')
        .select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit, name_aliases')
        .eq('is_active', true),
      supabase.from('distribution_product_aliases')
        .select('alias, product_id, language'),
      supabase.from('distribution_context_words')
        .select('word, meaning')
        .eq('language', 'papiamentu')
        .limit(50),
      supabase.from('papiamentu_training_entries')
        .select('corrected_phrase, category, example_context')
        .gte('confidence_score', 0.65)
        .eq('is_active', true)
        .neq('category', 'vocabulary')
        .order('times_used', { ascending: false })
        .limit(20),
      supabase.from('dre_messages')
        .select('role, content, created_at')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('distribution_orders')
        .select('id, order_number, created_at, awaiting_customer_confirmation, distribution_order_items(product_name_raw, quantity, order_unit, product_id, unit_price_xcg)')
        .eq('customer_id', customer.id)
        .eq('awaiting_customer_confirmation', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadCustomerMemory(supabase, customer.id),
    ]);

    const language = langResult;
    const products = productsResult.data || [];
    const productAliases = aliasesResult.data || [];
    const contextWords = (dictResult.data || []).map((w: any) => `${w.word}=${w.meaning}`).join(', ');
    const trainingPhrases = (trainingResult.data || [])
      .map((e: any) => `[${e.category}] "${e.corrected_phrase}"${e.example_context ? ` — ${e.example_context}` : ''}`)
      .join('\n');

    const allMessages = (historyResult.data || []).reverse();

    // Session detection
    const GREETING_WORDS = [
      'hi', 'hello', 'hey', 'halo', 'bon dia', 'bon tardi', 'bon nochi',
      'ayo', 'good morning', 'goedemorgen', 'hola', 'buenos días', 'buenos dias',
    ];
    const textLowerTrim = text.toLowerCase().trim();
    const isGreeting = GREETING_WORDS.some(g =>
      textLowerTrim === g || textLowerTrim.startsWith(g + ' ') || textLowerTrim.startsWith(g + '!') || textLowerTrim.startsWith(g + ',')
    );

    const lastCustomerMsg = allMessages.filter(m => m.role === 'customer').pop();
    const hoursSinceLastMsg = lastCustomerMsg?.created_at
      ? (Date.now() - new Date(lastCustomerMsg.created_at).getTime()) / (1000 * 60 * 60)
      : 999;
    const isNewSession = hoursSinceLastMsg > 4 || isGreeting;

    let conversationHistory: Array<{ role: string; content: string }>;
    if (isNewSession) {
      conversationHistory = [];
    } else {
      const sessionStart = new Date(Date.now() - 4 * 60 * 60 * 1000);
      conversationHistory = allMessages
        .filter(m => new Date(m.created_at) > sessionStart)
        .slice(-10)
        .map(m => ({
          role: m.role === 'customer' ? 'user' : 'assistant',
          content: m.content,
        }));
    }

    const pendingOrder = pendingOrderResult.data;
    const customerMemory = memoryResult;

    // Get order draft from conversation state
    const agentState = convo.agent_state || {};
    const orderDraft: OrderDraft = agentState.order_draft || { items: [] };

    // Reset draft on new session greeting
    if (isNewSession) {
      orderDraft.items = [];
    }

    // Curaçao time (UTC-4)
    const curacaoNow = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const hours = curacaoNow.getUTCHours();
    const curacaoTime = `${String(hours).padStart(2, '0')}:${String(curacaoNow.getUTCMinutes()).padStart(2, '0')} (${hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'})`;

    // Store customer message
    await supabase.from('dre_messages').insert({
      conversation_id: convo.id, role: 'customer',
      content: text, media_type: 'text', language_detected: language,
    });

    // Push notification to managers
    if (['dre_active', 'escalated'].includes(convo.control_status || 'dre_active')) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          notify_all_managers: true,
          title: `New Telegram — ${customer.name || 'Customer'}`,
          message: text.substring(0, 100),
          url: '/intake/conversations',
        },
      }).catch(() => {});
    }

    // Build context
    const ctx: DreContext = {
      supabase, customer, conversationId: convo.id,
      language, customerMemory, pendingOrder,
      conversationHistory, products, productAliases,
      trainingPhrases, contextWords, curacaoTime,
      channel: 'telegram', chatId, isGroup,
    };

    // ── Run Dre Agent ─────────────────────────────────────
    const { reply, orderDraft: updatedDraft } = await runDreAgent(
      text, ctx, orderDraft, openaiKey, lovableKey
    );

    // ── Send reply ────────────────────────────────────────
    if (reply) {
      await sendTelegramMessage(chatId, reply, telegramToken);

      await supabase.from('dre_messages').insert({
        conversation_id: convo.id, role: 'dre',
        content: reply, media_type: 'text', language_detected: language,
      });

      // Log for training review
      await supabase.from('distribution_ai_match_logs').insert({
        raw_text: text,
        detected_language: language,
        dre_reply: reply,
        needs_language_review: true,
        source_channel: 'telegram',
        conversation_id: convo.id,
      }).catch(() => {});
    }

    // Save updated state
    await supabase.from('dre_conversations').update({
      agent_state: { order_draft: updatedDraft },
      language_detected: language,
      last_agent_state_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', convo.id);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('telegram-webhook fatal error:', err);
    return new Response('OK', { status: 200 });
  }
});
