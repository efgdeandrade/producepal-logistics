import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── DRE SYSTEM PROMPT ──────────────────────────────────────────────
const DRE_SYSTEM_PROMPT = `
ABSOLUTE RULE — NEVER NEGOTIABLE: You NEVER mention delivery times, dates, or schedules. You NEVER say "you'll receive it today", "delivery tomorrow", "on its way", or ANY variation. The FUIK team handles all delivery communication. If you violate this rule, the entire system fails.

You are Dre — FUIK's sales person on Telegram. FUIK is a fresh produce distributor based in Curaçao.

## WHO YOU ARE
You are male, calm, reassuring, and casually professional. You feel like a trusted contact — not a bot, not a call center. You grew up on the island. You know the pace. You never rush, never panic, never make promises you cannot keep. You are the best salesperson FUIK has ever had.

## LANGUAGE RULES — CRITICAL
You speak Papiamentu (Curaçao dialect), English, Dutch, and Spanish.
Priority order: Papiamentu > English > Dutch > Spanish.
ALWAYS match the exact language the customer uses in their current message.
If they switch languages, you switch immediately without comment.
Curaçao Papiamentu is NOT the same as Aruban Papiamentu. Use Curaçao spelling and vocabulary.
Never mix languages in one reply unless the customer does it first.

Key Curaçao Papiamentu produce terms:
kaha=case/box | bolsa=bag | saku=sack | kilo=kg | misa=head (lettuce)
pampuna=pumpkin | peper=pepper | paprika=bell pepper | tomaat=tomato
patia=watermelon | papaja=papaya | fresa=strawberry | pina/ananas=pineapple
komkommer=cucumber | sla/lechuga=lettuce | wortel=carrot | repoyo=cabbage
ui/cebola=onion | sèl=celery | mango=mango

Confirmation words to recognize: tá bon / ya / si / yes / ja / correct / confirmed / ok / oké

PAPIAMENTU QUALITY STANDARD: The Curaçao Papiamentu you write must sound natural to someone born and raised in Curaçao. It is NOT the same as Aruban Papiamentu. Key differences: Curaçao uses "tá bon" not "ta bon di'e", uses "mi ke" and "mi kier" interchangeably, uses "danki" not "masha danki" for simple thanks, uses "ayo" for goodbye not "adios" in casual speech. When in doubt, write shorter and more natural rather than longer and formal. A Curaçao fisherman and a hotel manager both use the same casual Papiamentu with you.

## HOW YOU ADDRESS CUSTOMERS
Never use a name until the customer introduces themselves.
Once you know their name, use it naturally — not every message, just when it feels right.

## ORDER FLOW — THE MOST IMPORTANT RULE
FUIK accepts ALL orders. We never say something is out of stock. We never say we do not carry something. If a customer orders grapes, apples, or anything not on the standard list — we accept it and source it.

STEP 1 — When you receive an order, parse it and reply with a bullet-point summary asking to confirm:
"✅ Got it! Here's what I have:
- [qty] [unit] [product]
- [qty] [unit] [product]
Is this correct? Reply YES to confirm 🙏"

Reply in the customer's language. Always bullet points. Never mention delivery time.

STEP 2 — When customer confirms (tá bon / yes / si / ja / correct / oké):
Reply: "Perfect! Your order is in 🌿 The FUIK team will reach out to confirm delivery details."
Nothing more. No delivery promises. No time estimates.

If customer does NOT confirm but adds/changes items — update the summary and ask again.

## WHAT YOU NEVER DO
- Never confirm delivery times or dates — only the FUIK team does that
- Never say something is out of stock or unavailable
- Never negotiate prices — quote standard prices only if asked
- Never make promises about availability
- Never use Aruban Papiamentu
- Never write long paragraphs — short and clear always
- Never ignore a complaint

## PRICING
You can share standard prices if the customer asks. You cannot negotiate or offer discounts.
If they push for a discount say: "For pricing questions I'll connect you with the team 👌"

## COMPLAINTS
If a customer complains about a delivery or has a serious issue:
- Acknowledge warmly in 1 sentence
- Say the team will follow up
- Set intent to "complaint" so the manager gets tagged
Do NOT offer replacements or credits on your own.

## DIFFICULT CUSTOMERS
Stay calm. Acknowledge their feelings. One brief empathetic reply, then escalate.
Never match negative energy. Never argue.

## PROACTIVE MESSAGES
When reaching out proactively (customer hasn't ordered in a while):
- Keep it warm and natural, like a friend checking in
- Max 1 message per week per customer
- Never pushy, never salesy — just genuine
- Example: "Hey! Haven't seen an order from you lately 🌿 Everything going well? Need anything this week?"

## MEMORY
You remember previous orders. When relevant, reference them naturally:
"Last time you got 3 cases of mango — want the same again?"
Suggest reorders proactively when it makes sense.

## GROUP CHAT BEHAVIOR
In group chats, only respond when:
- The message is clearly an order, question, or complaint about products/delivery
- You are directly mentioned or tagged
- Someone replies directly to one of your messages
Stay completely silent for casual conversation, greetings between staff, or unrelated topics.
After an order is confirmed, post the full order summary in the group so everyone can see.

## WHEN YOU CANNOT HELP
Say: "Let me connect you with the team 👌" and set intent to "escalate".
Never leave a customer without acknowledgment.

## AI DISCLOSURE
If a customer directly asks if you are a bot or AI — be honest:
"I'm FUIK's digital assistant 😊 But the team is always here if you need a human."

## RESPONSE FORMAT
You MUST respond with ONLY valid JSON. No text before or after. No markdown. No code blocks.

{
  "intent": "order_step1" | "order_confirmed" | "order_modified" | "question" | "complaint" | "escalate" | "casual" | "proactive_response" | "other",
  "language": "papiamentu" | "english" | "dutch" | "spanish",
  "line_items": [{"product_name": string, "qty": number, "unit": string}],
  "customer_reply": string,
  "customer_name_detected": string | null,
  "requires_escalation": boolean
}

intent values:
- order_step1: customer sent an order, Dre is sending summary for confirmation
- order_confirmed: customer confirmed the order summary
- order_modified: customer changed something in the order
- question: customer asked a question (not an order)
- complaint: customer has a complaint
- escalate: Dre cannot handle this, tag manager
- casual: small talk, greeting, not business-related — stay silent or brief warm reply
- proactive_response: customer replied to a proactive outreach message
- other: anything else

line_items: only populated for order_step1, order_confirmed, order_modified
customer_reply: always in the customer's detected language
customer_name_detected: if the customer mentioned their name in this message, extract it — otherwise null
requires_escalation: true if manager should be tagged
`;

// ─── CONFIRMATION DETECTION ─────────────────────────────────────────
const CONFIRMATION_WORDS = ['tá bon', 'ta bon', 'yes', 'ya', 'si', 'ja', 'correct',
  'confirmed', 'oké', 'oke', 'ok', 'sure', 'go ahead', 'korekt', 'ta asina',
  'confirm', 'bevestig', 'klopt', 'goed'];

function isConfirmationMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return CONFIRMATION_WORDS.some(word =>
    lower === word ||
    lower.startsWith(word + ' ') ||
    lower.endsWith(' ' + word)
  );
}

const CONFIRM_REPLIES: Record<string, string> = {
  papiamentu: 'Perfekto! 🌿 Bo orde ta aden. E team di FUIK lo kontakta bo pa konfirmá e detayenan di entrega.',
  english: 'Perfect! 🌿 Your order is in. The FUIK team will reach out to confirm delivery details.',
  dutch: 'Perfect! 🌿 Je bestelling is ontvangen. Het FUIK team neemt contact op voor de bezorgdetails.',
  spanish: '¡Perfecto! 🌿 Tu pedido está registrado. El equipo de FUIK se pondrá en contacto para confirmar los detalles de entrega.',
};

// ─── HELPERS ─────────────────────────────────────────────────────────

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

async function getManagerHandle(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'manager_telegram_handle')
    .maybeSingle();
  return data?.value || '@FuikManager';
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

async function loadLanguageTerms(supabase: any): Promise<string> {
  const { data: langTerms } = await supabase
    .from('distribution_context_words')
    .select('word, meaning, language, word_type')
    .in('language', ['papiamentu', 'dutch'])
    .order('word_type');

  return (langTerms || [])
    .map((t: any) => `${t.word}=${t.meaning}`)
    .join(' | ');
}

function buildFullSystemPrompt(termsList: string, extraContext?: string): string {
  let prompt = DRE_SYSTEM_PROMPT;
  if (termsList) {
    prompt += `\n\nLIVE LANGUAGE TERMS FROM DATABASE:\n${termsList}`;
  }
  if (extraContext) {
    prompt += `\n\n${extraContext}`;
  }
  return prompt;
}

function parseAIResponse(aiData: any): any {
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
    console.log('Parsed customer_name_detected:', parsed.customer_name_detected);
    console.log('Parsed requires_escalation:', parsed.requires_escalation);

  } catch (e) {
    console.error('JSON parse failed:', e);
    parsed = {
      intent: 'other',
      language: 'english',
      line_items: [],
      customer_reply: 'Sorry, I had trouble understanding that. Could you please repeat your order?',
      customer_name_detected: null,
      requires_escalation: false,
    };
  }

  return parsed;
}

function getSafeReply(parsed: any): string {
  return parsed.customer_reply && parsed.customer_reply !== 'Got it! Let me help you with that.'
    ? parsed.customer_reply
    : 'Sorry, I had trouble understanding that. Could you please repeat your order?';
}

async function matchProduct(searchName: string, products: any[]): Promise<string | null> {
  const lower = searchName.toLowerCase().trim();
  for (const p of products) {
    if (p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())) {
      return p.id;
    }
    const aliases = p.name_aliases || [];
    for (const alias of aliases) {
      if (alias.toLowerCase() === lower || lower.includes(alias.toLowerCase())) {
        return p.id;
      }
    }
  }
  return null;
}

// ─── TRAINING LOG HELPERS ────────────────────────────────────────────

async function logMatchToTraining(
  supabase: any,
  item: any,
  matchedProductId: string | null,
  language: string,
  convoId: string,
  orderId: string | null,
  customerId: string | null,
) {
  try {
    await supabase.from('distribution_ai_match_logs').insert({
      raw_text: item.product_name,
      detected_language: language === 'papiamentu' ? 'pap' : language === 'dutch' ? 'nl' : language === 'spanish' ? 'es' : 'en',
      matched_product_id: matchedProductId,
      confidence: matchedProductId ? 'high' : 'low',
      needs_review: !matchedProductId,
      source_channel: 'telegram',
      conversation_id: convoId,
      order_id: orderId,
      customer_id: customerId,
      detected_quantity: item.qty || null,
      detected_unit: item.unit || null,
    });
  } catch (e) {
    console.error('logMatchToTraining error:', e);
  }
}

async function logDreReplyForReview(
  supabase: any,
  customerMessage: string,
  dreReply: string,
  language: string,
  convoId: string,
  customerId: string | null,
) {
  try {
    await supabase.from('distribution_ai_match_logs').insert({
      raw_text: customerMessage,
      detected_language: language === 'papiamentu' ? 'pap' : language === 'dutch' ? 'nl' : language === 'spanish' ? 'es' : 'en',
      dre_reply: dreReply,
      needs_language_review: true,
      needs_review: false,
      source_channel: 'telegram',
      conversation_id: convoId,
      customer_id: customerId,
    });
  } catch (e) {
    console.error('logDreReplyForReview error:', e);
  }
}

// ─── ORDER FLOW ──────────────────────────────────────────────────────

async function handleOrderFlow(
  parsed: any,
  customer: any,
  convo: any,
  products: any[],
  supabase: any,
) {
  if (parsed.intent === 'order_step1' && parsed.line_items?.length > 0) {
    const { data: order } = await supabase.from('distribution_orders').insert({
      order_number: `TG-${Date.now().toString(36).toUpperCase()}`,
      customer_id: customer.id,
      source_channel: 'telegram',
      status: 'draft',
      awaiting_customer_confirmation: true,
      confirmation_requested_at: new Date().toISOString(),
    }).select().single();

    if (order) {
      for (const item of parsed.line_items) {
        const matchedProductId = await matchProduct(item.product_name || '', products);
        await supabase.from('distribution_order_items').insert({
          order_id: order.id,
          product_id: matchedProductId,
          product_name_raw: item.product_name,
          quantity: item.qty,
          order_unit: item.unit || 'kg',
        });
        // Log to training
        await logMatchToTraining(supabase, item, matchedProductId, parsed.language || 'english', convo.id, order.id, customer.id);
      }
      await supabase.from('dre_conversations').update({
        order_id: order.id,
        updated_at: new Date().toISOString(),
      }).eq('id', convo.id);
      console.log('Draft order created:', order.id, order.order_number);
    }
  }

  if (parsed.intent === 'order_confirmed') {
    const { data: existingConvo } = await supabase
      .from('dre_conversations')
      .select('order_id')
      .eq('id', convo.id)
      .single();

    if (existingConvo?.order_id) {
      await supabase.from('distribution_orders').update({
        status: 'confirmed',
        awaiting_customer_confirmation: false,
        confirmed_by_customer_at: new Date().toISOString(),
      }).eq('id', existingConvo.order_id);
      console.log('Order confirmed:', existingConvo.order_id);
    }
  }

  if (parsed.intent === 'order_modified' && parsed.line_items?.length > 0) {
    const { data: existingConvo } = await supabase
      .from('dre_conversations')
      .select('order_id')
      .eq('id', convo.id)
      .single();

    if (existingConvo?.order_id) {
      await supabase.from('distribution_order_items').delete().eq('order_id', existingConvo.order_id);
      for (const item of parsed.line_items) {
        const matchedProductId = await matchProduct(item.product_name || '', products);
        await supabase.from('distribution_order_items').insert({
          order_id: existingConvo.order_id,
          product_id: matchedProductId,
          product_name_raw: item.product_name,
          quantity: item.qty,
          order_unit: item.unit || 'kg',
        });
        await logMatchToTraining(supabase, item, matchedProductId, parsed.language || 'english', convo.id, existingConvo.order_id, customer.id);
      }
      await supabase.from('distribution_orders').update({
        awaiting_customer_confirmation: true,
        confirmation_requested_at: new Date().toISOString(),
      }).eq('id', existingConvo.order_id);
      console.log('Order modified:', existingConvo.order_id);
    }
  }
}

async function handlePostAI(parsed: any, customer: any, convo: any, supabase: any) {
  if (parsed.customer_name_detected && customer?.id) {
    await supabase.from('distribution_customers')
      .update({ contact_name: parsed.customer_name_detected })
      .eq('id', customer.id)
      .is('contact_name', null);
  }

  if (parsed.requires_escalation || parsed.intent === 'escalate' || parsed.intent === 'complaint') {
    await supabase.from('dre_conversations').update({
      control_status: 'escalated',
      updated_at: new Date().toISOString(),
    }).eq('id', convo.id);
  }
}

// ─── CONFIRMATION SHORTCUT (before OpenAI) ──────────────────────────

async function tryConfirmDraft(
  text: string,
  customer: any,
  convo: any,
  chatId: string,
  supabase: any,
): Promise<boolean> {
  if (!isConfirmationMessage(text)) return false;

  const { data: draftOrder } = await supabase
    .from('distribution_orders')
    .select('id, awaiting_customer_confirmation')
    .eq('awaiting_customer_confirmation', true)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draftOrder) return false;

  // Confirm without calling OpenAI
  await supabase.from('distribution_orders').update({
    status: 'confirmed',
    awaiting_customer_confirmation: false,
    confirmed_by_customer_at: new Date().toISOString(),
  }).eq('id', draftOrder.id);

  await supabase.from('dre_conversations').update({
    updated_at: new Date().toISOString(),
  }).eq('id', convo.id);

  // Get language from last Dre message
  const { data: lastMsg } = await supabase
    .from('dre_messages')
    .select('language_detected')
    .eq('conversation_id', convo.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lang = lastMsg?.language_detected || 'english';
  const confirmReply = CONFIRM_REPLIES[lang] || CONFIRM_REPLIES.english;

  await sendTelegramMessage(chatId, confirmReply);
  await supabase.from('dre_messages').insert({
    conversation_id: convo.id,
    role: 'dre',
    content: confirmReply,
    media_type: 'text',
    language_detected: lang,
  });

  console.log('Draft order confirmed via shortcut:', draftOrder.id);
  return true;
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

  const { data: customer } = await supabase
    .from('distribution_customers')
    .select('id, name, preferred_language, contact_name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!customer) {
    console.log('Group not linked to any customer:', chatId);
    await sendTelegramMessage(chatId, "Hi! I'm Dre from FUIK 🌿 This group hasn't been linked to a customer account yet. Please contact us to get set up.");
    return;
  }

  console.log('Group customer found:', customer.id, customer.name);

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

  const prefixedContent = `[${senderName}]: ${text}`;
  await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: prefixedContent, media_type: 'text' });

  if (convo.control_status === 'human_in_control') {
    await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
    return;
  }

  if (convo.control_status === 'escalated') {
    const managerHandle = await getManagerHandle(supabase);
    await sendTelegramMessage(chatId, `${managerHandle} — a customer needs your attention here 🙏`);
    return;
  }

  // Check for draft confirmation shortcut
  const confirmed = await tryConfirmDraft(text, customer, convo, chatId, supabase);
  if (confirmed) return;

  // Load products and language terms
  const { data: products } = await supabase
    .from('distribution_products')
    .select('id, name, name_aliases, unit_options')
    .eq('is_active', true);

  const termsList = await loadLanguageTerms(supabase);
  const fullPrompt = buildFullSystemPrompt(termsList, `This is a group chat. The sender is "${senderName}".`);

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
        { role: 'system', content: fullPrompt },
        { role: 'user', content: text },
      ],
    }),
  });

  console.log('Group OpenAI status:', aiResp.status);
  const aiData = await aiResp.json();
  console.log('Group OpenAI raw content:', aiData.choices?.[0]?.message?.content);

  const parsed = parseAIResponse(aiData);
  const reply = getSafeReply(parsed);
  const language = parsed.language || 'english';

  // Escalate if needed
  if (parsed.requires_escalation || parsed.intent === 'complaint' || parsed.intent === 'escalate') {
    const managerHandle = await getManagerHandle(supabase);
    await supabase.from('dre_conversations').update({ control_status: 'escalated', updated_at: new Date().toISOString() }).eq('id', convo.id);
    await sendTelegramMessage(chatId, `${managerHandle} — a customer needs your attention here 🙏`);
  }

  // Handle order flow
  await handleOrderFlow(parsed, customer, convo, products || [], supabase);
  await handlePostAI(parsed, customer, convo, supabase);

  // Log Dre reply for language review
  await logDreReplyForReview(supabase, text, reply, language, convo.id, customer.id);

  // Update conversation language
  await supabase.from('dre_conversations').update({ language_detected: language, updated_at: new Date().toISOString() }).eq('id', convo.id);

  // Store and send reply
  await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'dre', content: reply, media_type: 'text', language_detected: language });
  await sendTelegramMessage(chatId, reply);
}

// ─── PRIVATE CHAT HANDLER ────────────────────────────────────────────
async function handlePrivateMessage(
  message: any,
  chatId: string,
  text: string,
  supabase: any,
  openaiKey: string,
) {
  const { data: customer } = await supabase
    .from('distribution_customers')
    .select('id, name, preferred_language, contact_name')
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

      console.log('Pending customer exists but not yet linked');
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

  if (convo.control_status === 'human_in_control') {
    console.log('Human in control — storing message only');
    await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });
    await supabase.from('dre_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convo.id);
    return;
  }

  // Store customer message
  await supabase.from('dre_messages').insert({ conversation_id: convo.id, role: 'customer', content: text, media_type: 'text' });

  // Check for draft confirmation shortcut BEFORE calling OpenAI
  const confirmed = await tryConfirmDraft(text, customer, convo, chatId, supabase);
  if (confirmed) return;

  // Load products and language terms
  const { data: products } = await supabase
    .from('distribution_products')
    .select('id, name, name_aliases, unit_options')
    .eq('is_active', true);

  const termsList = await loadLanguageTerms(supabase);
  const fullPrompt = buildFullSystemPrompt(termsList);

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
        { role: 'system', content: fullPrompt },
        { role: 'user', content: text },
      ],
    }),
  });

  console.log('OpenAI raw response status:', aiResp.status);
  const aiData = await aiResp.json();
  console.log('OpenAI raw content:', aiData.choices?.[0]?.message?.content);
  console.log('OpenAI finish reason:', aiData.choices?.[0]?.finish_reason);
  console.log('OpenAI usage:', JSON.stringify(aiData.usage));

  const parsed = parseAIResponse(aiData);
  const reply = getSafeReply(parsed);
  const language = parsed.language || 'english';

  console.log('Sending reply:', reply);

  // Handle order flow (two-step confirmation)
  await handleOrderFlow(parsed, customer, convo, products || [], supabase);
  await handlePostAI(parsed, customer, convo, supabase);

  // Log Dre reply for language review
  await logDreReplyForReview(supabase, text, reply, language, convo.id, customer.id);

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
