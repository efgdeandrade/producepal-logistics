import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const CONFIRMATION_WORDS = [
  'tá bon', 'ta bon', 'yes', 'ya', 'si', 'ja', 'correct',
  'confirmed', 'oké', 'oke', 'ok', 'sure', 'go ahead',
  'korekt', 'ta asina', 'confirm', 'bevestig', 'klopt',
  'goed', 'perfecto', 'perfect', 'yep', 'yup', 'klaar',
];

// HARD CODED - GPT cannot override these ever
const FORBIDDEN_DELIVERY_PHRASES = [
  'deliver today', 'delivery today', 'today\'s delivery',
  'tomorrow', 'tonight', 'this morning', 'this afternoon',
  'will be delivered', 'on its way', 'out for delivery',
  'entrega oy', 'entrega mañan', 'lo recibi oy',
  'vandaag', 'morgen', 'vanmiddag', 'vanavond',
  'hoy', 'mañana', 'esta tarde', 'esta noche',
  'delivery date', 'delivered on', 'arrive',
  'schedule', 'dispatch',
];

// Safe replacements when forbidden phrases detected
const SAFE_FALLBACK: Record<string, string> = {
  papiamentu: 'E team di FUIK lo kontakta bo pa e detayenan di entrega. 🙏',
  english: 'The FUIK team will be in touch about delivery details. 🙏',
  dutch: 'Het FUIK team neemt contact op over de bezorgdetails. 🙏',
  spanish: 'El equipo de FUIK te contactará sobre los detalles de entrega. 🙏',
};

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface ParsedItem {
  product_name: string;
  qty: number | null;
  unit: string | null;
}

interface AgentState {
  phase: 'idle' | 'collecting' | 'clarifying' | 'confirming' | 'confirmed';
  pending_items: ParsedItem[];
  clarification_index: number;
  draft_order_id: string | null;
  language: string;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('sendTelegramMessage error:', e);
  }
}

function sanitizeReply(reply: string, language: string): string {
  const lower = reply.toLowerCase();
  for (const phrase of FORBIDDEN_DELIVERY_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      console.warn('DELIVERY PHRASE DETECTED AND STRIPPED:', phrase);
      const sentences = reply.split(/[.!?]+/).filter(s => {
        const sl = s.toLowerCase();
        return !FORBIDDEN_DELIVERY_PHRASES.some(p => sl.includes(p.toLowerCase()));
      });
      const cleaned = sentences.join('. ').trim();
      return cleaned
        ? cleaned + ' ' + (SAFE_FALLBACK[language] || SAFE_FALLBACK.english)
        : SAFE_FALLBACK[language] || SAFE_FALLBACK.english;
    }
  }
  return reply;
}

function isConfirmationMessage(text: string): boolean {
  const t = text.toLowerCase().trim();
  return CONFIRMATION_WORDS.some(w =>
    t === w || t === w + '.' || t === w + '!' || t.startsWith(w + ' ')
  );
}

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  jsonMode = false
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const body: any = {
    model: 'gpt-4o',
    messages,
    temperature: 0.4,
    max_tokens: 600,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// ═══════════════════════════════════════════════════════════
// STEP A — Detect language (fast, cheap call)
// ═══════════════════════════════════════════════════════════

async function detectLanguage(text: string): Promise<string> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: 'Detect the language of the message. Reply with ONLY one word: papiamentu, english, dutch, or spanish. Papiamentu examples: "mi ke", "ta bon", "kuantu", "danki", "bon dia", "pampuna", "kaha". If unsure between Papiamentu and another language, choose papiamentu.',
      },
      { role: 'user', content: text },
    ]);
    const lang = result.trim().toLowerCase();
    if (['papiamentu', 'english', 'dutch', 'spanish'].includes(lang)) return lang;
    return 'english';
  } catch {
    return 'english';
  }
}

// ═══════════════════════════════════════════════════════════
// STEP B — Parse order items from text
// ═══════════════════════════════════════════════════════════

async function parseOrderItems(text: string, language: string, contextWords: string): Promise<ParsedItem[]> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `You are an order parser for a fresh produce distributor in Curaçao.
Extract ALL products the customer wants to order.
Return ONLY valid JSON: {"items": [{"product_name": string, "qty": number | null, "unit": string | null}]}
Rules:
- product_name: the actual produce name in English (translate if needed)
- qty: the number they want. null if not mentioned.
- unit: "kg", "case", "bag", "piece", "bunch" or null if not mentioned
- If customer says "kaha" = case, "bolsa" or "saku" = bag, "kilo" = kg
- If customer says just a product name with no qty, set qty to null
- Produce terms: ${contextWords}
Examples:
"2 kaha di mango" → {"product_name":"mango","qty":2,"unit":"case"}
"1 bolsa di pampuna" → {"product_name":"pumpkin","qty":1,"unit":"bag"}
"I want mango and grapes" → [{"product_name":"mango","qty":null,"unit":null},{"product_name":"grapes","qty":null,"unit":null}]
"3 kg tomato" → {"product_name":"tomato","qty":3,"unit":"kg"}`,
      },
      { role: 'user', content: text },
    ], true);

    const parsed = JSON.parse(result);
    return parsed.items || [];
  } catch (e) {
    console.error('parseOrderItems error:', e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// STEP C — Generate natural reply in correct language
// ═══════════════════════════════════════════════════════════

async function generateReply(
  situation: string,
  language: string,
  customerName: string | null,
  extra: string = ''
): Promise<string> {
  const namePrefix = customerName ? ` Address them as "${customerName}".` : '';

  const languageGuide: Record<string, string> = {
    papiamentu: `Write in Curaçao Papiamentu (NOT Aruban). Natural, warm, island pace.
Real Curaçao examples:
- "Bon dia! Kon ta bo?" (Good morning, how are you?)
- "Ta bon, mi a risibí bo orde." (Ok, I received your order.)
- "Kuantu kaha di mango bo ke?" (How many cases of mango do you want?)
- "E team di FUIK lo yama bo." (The FUIK team will call you.)
- "Danki, ayo!" (Thanks, bye!)
Keep it short. Max 2 sentences. 1 emoji max.`,
    english: 'Write in casual but professional English. Short, warm, friendly. Max 2 sentences. 1 emoji max.',
    dutch: 'Write in casual Dutch. Short, warm, friendly. Max 2 sentences. 1 emoji max.',
    spanish: 'Write in casual Latin American Spanish. Short, warm, friendly. Max 2 sentences. 1 emoji max.',
  };

  try {
    const reply = await callOpenAI([
      {
        role: 'system',
        content: `You are Dre, a calm and friendly sales assistant for FUIK fresh produce in Curaçao.${namePrefix}
${languageGuide[language] || languageGuide.english}
ABSOLUTE RULE: Never mention delivery times, dates, or schedules. Never say "today", "tomorrow", "tonight", or any delivery promise. The team handles this.
${extra}`,
      },
      { role: 'user', content: situation },
    ]);
    return sanitizeReply(reply.trim(), language);
  } catch {
    return SAFE_FALLBACK[language] || SAFE_FALLBACK.english;
  }
}

// ═══════════════════════════════════════════════════════════
// STEP D — Build order summary message
// ═══════════════════════════════════════════════════════════

function buildOrderSummary(items: ParsedItem[], language: string): string {
  const lines = items.map(item => `• ${item.qty} ${item.unit || ''} ${item.product_name}`.trim());
  const itemList = lines.join('\n');

  const templates: Record<string, string> = {
    papiamentu: `✅ Ta bon! Aki ta loke mi tin:\n${itemList}\n\nTa korekt? Manda <b>SI</b> pa konfirmá. 🙏`,
    english: `✅ Got it! Here's your order:\n${itemList}\n\nIs this correct? Reply <b>YES</b> to confirm. 🙏`,
    dutch: `✅ Begrepen! Dit is je bestelling:\n${itemList}\n\nKlopt dit? Stuur <b>JA</b> om te bevestigen. 🙏`,
    spanish: `✅ ¡Listo! Aquí está tu pedido:\n${itemList}\n\n¿Es correcto? Responde <b>SÍ</b> para confirmar. 🙏`,
  };
  return templates[language] || templates.english;
}

// ═══════════════════════════════════════════════════════════
// STEP E — Build clarification question
// ═══════════════════════════════════════════════════════════

function buildClarificationQuestion(item: ParsedItem, language: string): string {
  const hasQty = item.qty !== null && item.qty > 0;
  const hasUnit = item.unit !== null;

  if (!hasQty && !hasUnit) {
    const templates: Record<string, string> = {
      papiamentu: `Kuantu <b>${item.product_name}</b> bo ke? (p.e. 2 kaha, 5 kg, 1 bolsa)`,
      english: `How much <b>${item.product_name}</b> would you like? (e.g. 2 cases, 5 kg, 1 bag)`,
      dutch: `Hoeveel <b>${item.product_name}</b> wil je? (bijv. 2 dozen, 5 kg, 1 zak)`,
      spanish: `¿Cuánto <b>${item.product_name}</b> quieres? (ej. 2 cajas, 5 kg, 1 bolsa)`,
    };
    return templates[language] || templates.english;
  }

  if (!hasUnit) {
    const templates: Record<string, string> = {
      papiamentu: `Bo ke ${item.qty} di <b>${item.product_name}</b> — den kg, kaha, of bolsa?`,
      english: `For the <b>${item.product_name}</b> — by kg, by the case, or by bag?`,
      dutch: `Voor de <b>${item.product_name}</b> — per kg, per doos, of per zak?`,
      spanish: `Para el <b>${item.product_name}</b> — ¿en kg, por caja o por bolsa?`,
    };
    return templates[language] || templates.english;
  }

  if (!hasQty) {
    const templates: Record<string, string> = {
      papiamentu: `Kuantu <b>${item.unit}</b> di <b>${item.product_name}</b>?`,
      english: `How many <b>${item.unit}</b> of <b>${item.product_name}</b>?`,
      dutch: `Hoeveel <b>${item.unit}</b> van de <b>${item.product_name}</b>?`,
      spanish: `¿Cuántos <b>${item.unit}</b> de <b>${item.product_name}</b>?`,
    };
    return templates[language] || templates.english;
  }

  return '';
}

// ═══════════════════════════════════════════════════════════
// STEP F — Apply clarification answer to pending item
// ═══════════════════════════════════════════════════════════

async function parseClarificationAnswer(
  answer: string,
  item: ParsedItem,
  language: string
): Promise<ParsedItem> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `Extract quantity and unit from the customer's answer about "${item.product_name}".
Return ONLY JSON: {"qty": number | null, "unit": string | null}
Unit options: kg, case, bag, piece, bunch
Papiamentu: kaha=case, bolsa=bag, saku=bag, kilo=kg
Current known: qty=${item.qty}, unit=${item.unit}
Only extract what is NEW information in this answer.`,
      },
      { role: 'user', content: answer },
    ], true);

    const parsed = JSON.parse(result);
    return {
      ...item,
      qty: parsed.qty ?? item.qty,
      unit: parsed.unit ?? item.unit,
    };
  } catch {
    return item;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════

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

    console.log('Received:', { chatId, text: text.substring(0, 50), isGroup });

    if (!text) return new Response('OK', { status: 200 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── /ping debug ──────────────────────────────────────
    if (text === '/ping') {
      await sendTelegramMessage(chatId, [
        '🤖 Dre Agent v2:',
        `OPENAI_API_KEY: ${Deno.env.get('OPENAI_API_KEY') ? '✅' : '❌'}`,
        `TELEGRAM_BOT_TOKEN: ${Deno.env.get('TELEGRAM_BOT_TOKEN') ? '✅' : '❌'}`,
        `SUPABASE_URL: ${Deno.env.get('SUPABASE_URL') ? '✅' : '❌'}`,
        `SERVICE_ROLE_KEY: ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✅' : '❌'}`,
        'Architecture: State Machine v2 ✅',
      ].join('\n'));
      return new Response('OK', { status: 200 });
    }

    // ── Identify customer ────────────────────────────────
    const lookupId = isGroup ? String(message.chat.id) : chatId;

    const { data: customer } = await supabase
      .from('distribution_customers')
      .select('id, name, preferred_language')
      .eq('telegram_chat_id', lookupId)
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
          .insert({ telegram_chat_id: chatId, first_message: text, status: 'unlinked' })
          .select().single();
        await supabase.from('dre_conversations').insert({
          channel: 'telegram', external_chat_id: chatId,
          control_status: 'escalated', pending_customer_id: newPending?.id,
        });
        await sendTelegramMessage(chatId,
          "Hi! I don't recognize your account yet. What is your business name? 🌿"
        );
      }
      return new Response('OK', { status: 200 });
    }

    // ── Find or create conversation ──────────────────────
    let { data: convo } = await supabase
      .from('dre_conversations')
      .select('id, control_status, agent_state')
      .eq('external_chat_id', lookupId)
      .eq('channel', 'telegram')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo } = await supabase
        .from('dre_conversations')
        .insert({
          customer_id: customer.id,
          channel: 'telegram',
          external_chat_id: lookupId,
          control_status: 'dre_active',
          agent_state: { phase: 'idle', pending_items: [], clarification_index: 0, draft_order_id: null, language: customer.preferred_language || 'papiamentu' },
        })
        .select().single();
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

    // ── Load agent state ─────────────────────────────────
    const state: AgentState = {
      phase: 'idle',
      pending_items: [],
      clarification_index: 0,
      draft_order_id: null,
      language: customer.preferred_language || 'papiamentu',
      ...(convo.agent_state || {}),
    };

    // ── Detect language ──────────────────────────────────
    const detectedLanguage = await detectLanguage(text);
    state.language = detectedLanguage;

    // ── Load context words for parser ────────────────────
    const { data: contextWords } = await supabase
      .from('distribution_context_words')
      .select('word, meaning')
      .eq('language', 'papiamentu')
      .limit(50);
    const contextString = (contextWords || []).map(w => `${w.word}=${w.meaning}`).join(', ');

    // ── Store customer message ───────────────────────────
    await supabase.from('dre_messages').insert({
      conversation_id: convo.id, role: 'customer',
      content: text, media_type: 'text', language_detected: detectedLanguage,
    });

    let reply = '';

    // ════════════════════════════════════════════════════
    // STATE MACHINE
    // ════════════════════════════════════════════════════

    // ── PHASE: confirming — waiting for YES/NO ───────────
    if (state.phase === 'confirming') {
      if (isConfirmationMessage(text)) {
        // CONFIRMED — create real order
        const orderNumber = `TG-${Date.now().toString(36).toUpperCase()}`;
        const { data: order } = await supabase.from('distribution_orders').insert({
          order_number: orderNumber,
          customer_id: customer.id,
          source_channel: 'telegram',
          status: 'confirmed',
          awaiting_customer_confirmation: false,
          confirmed_by_customer_at: new Date().toISOString(),
          agent_state_snapshot: state,
        }).select().single();

        if (order) {
          // Match and insert items
          const { data: products } = await supabase
            .from('distribution_products')
            .select('id, name, name_aliases')
            .eq('is_active', true);

          for (const item of state.pending_items) {
            let matchedId: string | null = null;
            const search = item.product_name.toLowerCase();
            for (const p of (products || [])) {
              if (p.name.toLowerCase().includes(search) || search.includes(p.name.toLowerCase())) {
                matchedId = p.id; break;
              }
              for (const alias of (p.name_aliases || [])) {
                if (alias.toLowerCase().includes(search) || search.includes(alias.toLowerCase())) {
                  matchedId = p.id; break;
                }
              }
              if (matchedId) break;
            }

            await supabase.from('distribution_order_items').insert({
              order_id: order.id,
              product_id: matchedId,
              product_name_raw: item.product_name,
              quantity: item.qty || 0,
              order_unit: item.unit || 'kg',
            });

            // Log to training
            await supabase.from('distribution_ai_match_logs').insert({
              raw_text: item.product_name,
              detected_language: detectedLanguage,
              matched_product_id: matchedId,
              confidence: matchedId ? 0.9 : 0.3,
              needs_review: !matchedId,
              source_channel: 'telegram',
              conversation_id: convo.id,
            }).catch(() => {});
          }

          await supabase.from('dre_conversations').update({
            order_id: order.id,
          }).eq('id', convo.id);
        }

        // Reset state
        state.phase = 'idle';
        state.pending_items = [];
        state.draft_order_id = null;
        state.clarification_index = 0;

        const confirmReplies: Record<string, string> = {
          papiamentu: `Perfekto! 🌿 Bo orde #${order?.order_number || 'TG'} ta aden. E team di FUIK lo kontakta bo pa e detayenan di entrega.`,
          english: `Perfect! 🌿 Order #${order?.order_number || 'TG'} is in. The FUIK team will reach out about delivery details.`,
          dutch: `Perfect! 🌿 Bestelling #${order?.order_number || 'TG'} is ontvangen. Het FUIK team neemt contact op over de bezorging.`,
          spanish: `¡Perfecto! 🌿 Pedido #${order?.order_number || 'TG'} registrado. El equipo de FUIK te contactará sobre la entrega.`,
        };
        reply = confirmReplies[detectedLanguage] || confirmReplies.english;

      } else {
        // NOT a confirmation — maybe they changed the order
        const newItems = await parseOrderItems(text, detectedLanguage, contextString);
        if (newItems.length > 0) {
          // They modified the order
          state.pending_items = newItems;
          state.clarification_index = 0;

          // Check for missing info
          const missingIndex = newItems.findIndex(i => !i.qty || !i.unit);
          if (missingIndex >= 0) {
            state.phase = 'clarifying';
            state.clarification_index = missingIndex;
            reply = buildClarificationQuestion(newItems[missingIndex], detectedLanguage);
          } else {
            reply = buildOrderSummary(state.pending_items, detectedLanguage);
          }
        } else {
          // They said something else — re-show the summary
          reply = buildOrderSummary(state.pending_items, detectedLanguage);
        }
      }
    }

    // ── PHASE: clarifying — waiting for qty/unit answer ──
    else if (state.phase === 'clarifying') {
      const currentItem = state.pending_items[state.clarification_index];
      const updatedItem = await parseClarificationAnswer(text, currentItem, detectedLanguage);
      state.pending_items[state.clarification_index] = updatedItem;

      // Find next item needing clarification
      const nextMissing = state.pending_items.findIndex(
        (item, idx) => idx > state.clarification_index && (!item.qty || !item.unit)
      );

      if (nextMissing >= 0) {
        state.clarification_index = nextMissing;
        reply = buildClarificationQuestion(state.pending_items[nextMissing], detectedLanguage);
      } else {
        // All items complete — show summary
        state.phase = 'confirming';
        reply = buildOrderSummary(state.pending_items, detectedLanguage);
      }
    }

    // ── PHASE: idle — new message ────────────────────────
    else {
      // Try to parse as order first
      const items = await parseOrderItems(text, detectedLanguage, contextString);

      if (items.length > 0) {
        state.pending_items = items;
        state.clarification_index = 0;

        // Check for missing qty or unit
        const missingIndex = items.findIndex(i => !i.qty || !i.unit);
        if (missingIndex >= 0) {
          state.phase = 'clarifying';
          state.clarification_index = missingIndex;
          reply = buildClarificationQuestion(items[missingIndex], detectedLanguage);
        } else {
          // All complete — show summary
          state.phase = 'confirming';
          reply = buildOrderSummary(items, detectedLanguage);
        }
      } else {
        // Not an order — generate conversational reply
        state.phase = 'idle';
        const customerNameStr = senderName || customer.name || null;
        reply = await generateReply(
          text,
          detectedLanguage,
          customerNameStr,
          'You can help with: placing orders, product questions, pricing questions. For complaints, delivery issues, or anything you cannot handle — say you will connect them with the team.'
        );
      }
    }

    // ════════════════════════════════════════════════════
    // SEND REPLY
    // ════════════════════════════════════════════════════

    if (reply) {
      // Final safety check — strip any delivery promises
      reply = sanitizeReply(reply, detectedLanguage);

      await sendTelegramMessage(chatId, reply);

      await supabase.from('dre_messages').insert({
        conversation_id: convo.id,
        role: 'dre',
        content: reply,
        media_type: 'text',
        language_detected: detectedLanguage,
      });

      // Log reply for training review
      await supabase.from('distribution_ai_match_logs').insert({
        raw_text: text,
        detected_language: detectedLanguage,
        dre_reply: reply,
        needs_language_review: true,
        source_channel: 'telegram',
        conversation_id: convo.id,
      }).catch(() => {});
    }

    // Save updated state
    await supabase.from('dre_conversations').update({
      agent_state: state,
      language_detected: detectedLanguage,
      last_agent_state_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', convo.id);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('telegram-webhook fatal error:', err);
    return new Response('OK', { status: 200 });
  }
});
