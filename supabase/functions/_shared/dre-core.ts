// Dre AI Agent v4 — Shared Core Library
// GPT-4o function calling architecture with Gemini Flash language detection
// Used by both telegram-webhook and whatsapp-ai-agent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface DreContext {
  supabase: any;
  customer: any;
  conversationId: string;
  language: string;
  customerMemory: string;
  pendingOrder: any | null;
  conversationHistory: Array<{ role: string; content: string }>;
  products: any[];
  productAliases: any[];
  trainingPhrases: string;
  contextWords: string;
  curacaoTime: string;
  channel: 'telegram' | 'whatsapp';
  chatId: string;
  isGroup: boolean;
}

export interface OrderDraft {
  items: Array<{
    product_name: string;
    qty: number | null;
    unit: string | null;
    product_id: string | null;
    unit_price_xcg: number;
  }>;
}

// ═══════════════════════════════════════════════════
// DELIVERY GUARDRAILS — GPT CANNOT BYPASS THESE
// ═══════════════════════════════════════════════════

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

const SAFE_DELIVERY_FALLBACK: Record<string, string> = {
  papiamentu: 'E team di FUIK lo kontakta bo pa e detayenan di entrega. 🙏',
  english: 'The FUIK team will be in touch about delivery details. 🙏',
  dutch: 'Het FUIK team neemt contact op over de bezorgdetails. 🙏',
  spanish: 'El equipo de FUIK te contactará sobre los detalles de entrega. 🙏',
};

export function sanitizeReply(reply: string, language: string): string {
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
        ? cleaned + ' ' + (SAFE_DELIVERY_FALLBACK[language] || SAFE_DELIVERY_FALLBACK.english)
        : SAFE_DELIVERY_FALLBACK[language] || SAFE_DELIVERY_FALLBACK.english;
    }
  }
  return reply;
}

// ═══════════════════════════════════════════════════
// LANGUAGE DETECTION (Gemini Flash — fast, cheap)
// ═══════════════════════════════════════════════════

export async function detectLanguage(text: string, lovableKey: string): Promise<string> {
  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Detect the PRIMARY language of this message for a Curaçao business context.
Reply with ONLY one word: papiamentu, english, dutch, or spanish.

CRITICAL RULES:
- "si", "Si", "SI" alone = papiamentu (it means yes/confirmation in Curaçao, NOT Spanish)
- "ja" alone = papiamentu or dutch (confirmation)
- "ok", "okay", "yes", "no" = english
- Mixed messages = use the dominant language
- When in doubt = papiamentu (most common in Curaçao)

Papiamentu indicators: mi ke, ta bon, kaha, bolsa, danki, bon dia, bon tardi, bontardi, bondia, pampuna, wortel, tambe, otro kos, kiko, kuantu, kier, lamunchi, apelsin, fruta, berdura, perfekto, klaro, tur kos.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
    });
    const data = await resp.json();
    const lang = data.choices?.[0]?.message?.content?.trim().toLowerCase();
    return ['papiamentu', 'english', 'dutch', 'spanish'].includes(lang!) ? lang! : 'papiamentu';
  } catch {
    return 'papiamentu';
  }
}

// ═══════════════════════════════════════════════════
// PRODUCT MATCHING (four-tier, code-based)
// ═══════════════════════════════════════════════════

export function matchProduct(
  searchName: string,
  products: any[],
  aliases: any[]
): { product_id: string | null; confidence: number; match_type: string } {
  const search = searchName.toLowerCase().trim();

  // Tier 1: Alias exact match
  for (const alias of aliases) {
    if (alias.alias.toLowerCase() === search)
      return { product_id: alias.product_id, confidence: 0.95, match_type: 'alias_exact' };
  }
  // Tier 2: Alias partial match
  for (const alias of aliases) {
    if (search.includes(alias.alias.toLowerCase()) || alias.alias.toLowerCase().includes(search))
      return { product_id: alias.product_id, confidence: 0.80, match_type: 'alias_partial' };
  }
  // Tier 3: Product name exact/partial match
  for (const p of products) {
    const names = [p.name, p.name_pap, p.name_nl, p.name_es, ...(p.name_aliases || [])]
      .filter(Boolean).map((n: string) => n.toLowerCase());
    if (names.some(n => n === search))
      return { product_id: p.id, confidence: 0.90, match_type: 'name_exact' };
    if (names.some(n => n.includes(search) || search.includes(n)))
      return { product_id: p.id, confidence: 0.70, match_type: 'name_partial' };
  }
  // Tier 4: Fuzzy word match
  const searchWords = search.split(/\s+/);
  for (const p of products) {
    const names = [p.name, p.name_pap, p.name_nl, p.name_es, ...(p.name_aliases || [])]
      .filter(Boolean).map((n: string) => n.toLowerCase());
    const allWords = names.join(' ').split(/\s+/);
    const matches = searchWords.filter(w => allWords.some(aw => aw.includes(w) || w.includes(aw)));
    if (matches.length > 0 && matches.length >= searchWords.length * 0.6)
      return { product_id: p.id, confidence: 0.50, match_type: 'fuzzy' };
  }
  return { product_id: null, confidence: 0.20, match_type: 'no_match' };
}

// ═══════════════════════════════════════════════════
// GPT-4o FUNCTION DEFINITIONS
// ═══════════════════════════════════════════════════

export const DRE_FUNCTIONS = [
  {
    name: 'add_items',
    description: 'Add one or more products to the current order draft. Use when customer mentions products they want to order. Always extract product name, quantity, and unit from the message.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name: { type: 'string', description: 'Product name — translate to English if in another language. E.g. pampuna→pumpkin, wortel→carrot, apelsin→orange, patia→watermelon, lamunchi→lime, aarbei/fresa/strawberry→strawberry, piscado→fish, poleishi→chicken' },
              qty: { type: 'number', description: 'Quantity. Null if not specified.' },
              unit: { type: 'string', description: 'Unit: kg, case, bag, piece, bunch. Papiamentu mappings: kaha=case, bolsa=bag, saku=bag, kilo=kg, misa=head, pida=piece, stuks=piece. Null if not specified.' },
            },
            required: ['product_name'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'remove_item',
    description: 'Remove a product from the current order draft.',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'update_item',
    description: 'Update quantity or unit of an existing item in the draft.',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        qty: { type: 'number' },
        unit: { type: 'string' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'show_order_summary',
    description: 'Show the current order draft to the customer for review before confirming.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'confirm_order',
    description: 'Confirm and place the order. Only call this when customer explicitly says yes/confirmed/ta bon/si/ja/ok/correct/klopt etc.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_order',
    description: 'Cancel the current order draft.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'continue_pending_order',
    description: 'Continue with the existing unconfirmed order from a previous conversation.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'replace_pending_order',
    description: 'Cancel the pending order and start fresh with new items.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ask_clarification',
    description: 'Ask customer for missing information (quantity, unit, or which product they mean). Generate the question in the customer\'s language.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The clarification question in customer\'s language' },
      },
      required: ['question'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Hand over conversation to human agent. Use for complaints, complex issues, or when customer explicitly requests a human.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
      required: ['reason'],
    },
  },
];

// ═══════════════════════════════════════════════════
// BUILD DRE SYSTEM PROMPT
// ═══════════════════════════════════════════════════

export function buildDreSystemPrompt(ctx: DreContext): string {
  const { customer, language, customerMemory, pendingOrder, trainingPhrases, contextWords, curacaoTime, isGroup } = ctx;

  const pendingOrderSection = pendingOrder ? `
RECENT UNSCHEDULED ORDER (created ${Math.floor((Date.now() - new Date(pendingOrder.created_at).getTime()) / 60000)} minutes ago):
Order #${pendingOrder.order_number}
Items: ${(pendingOrder.distribution_order_items || pendingOrder.items || []).map((i: any) => `${i.quantity} ${i.order_unit} ${i.product_name_raw}`).join(', ')}
Status: ${pendingOrder.status}

→ If customer starts a new conversation or greeting, mention this order ONCE naturally.
  Example: "Bo tin un orde pendiente di anteriormente ku mango i wortel — bo ke kontinua ku dje of kuminsa nobo?"
→ If customer sends a completely new order, ask: want to add to existing order or start fresh?
→ If customer says "add" or "tambe" — call add_items (it will merge)
→ If customer says "new order" or "nobo" — call replace_pending_order first
→ If customer confirms — call continue_pending_order then confirm_order
` : 'NO PENDING ORDERS.';

  const languageGuide: Record<string, string> = {
    papiamentu: `PRIMARY LANGUAGE: Curaçao Papiamentu (NOT Aruban).
Natural phrases: "Ta bon 👌", "Mi ta registrá esaki", "Kiko mas?", "Tur kos?", "Danki, ayo!"
Time greeting: ${curacaoTime.includes('morning') ? 'Bon dia' : curacaoTime.includes('afternoon') ? 'Bon tardi' : 'Bon nochi'} — use ONLY on first message of a new session, never again.
Keep it short. Max 2 sentences for casual replies. One question per message.

When customer says "kumbai" or "ayo" — respond with a warm goodbye, nothing else. Do not ask about orders.

IMPORTANT PAPIAMENTU VOCABULARY:
- orde = pedido (order) — both correct, use orde in casual context
- bolsa = saku = bag
- pida = stuks = piece
- kaha = case/box
- tur kos = everything/that's all
- konta = tell me/what's up (NOT an order item)
- esey = that/that's it
- awor = now
- mas = more/also
- sin = without
- ku = with/and
- patia = watermelon, pampuna = pumpkin, wortel = carrot
- lamunchi = lime, apelsin = orange
- fruta = fruit, berdura = vegetable
- kumbai = goodbye/see you later
- ayo = bye/see you
- masha danki = thank you very much
- kon ta = how are you
- ta di bon = I'm fine/all good`,
    english: `PRIMARY LANGUAGE: Casual English. Short sentences. Never say "Good morning" after first message.`,
    dutch: `PRIMARY LANGUAGE: Casual Dutch. Kort en vriendelijk. Niet te formeel.`,
    spanish: `PRIMARY LANGUAGE: Casual Spanish. Corto y amigable. Sin formalidades.`,
  };

  const productCatalog = ctx.products.slice(0, 60).map(p => {
    const pAliases = ctx.productAliases.filter(a => a.product_id === p.id).map(a => a.alias);
    const allNames = [p.name, p.name_pap, p.name_nl, p.name_es, ...pAliases, ...(p.name_aliases || [])]
      .filter(Boolean).join(' / ');
    return `${p.name}: ${allNames}`;
  }).join('\n');

  return `You are Dre — the best salesperson FUIK has ever had. FUIK is a fresh produce distributor in Curaçao.
Current time in Curaçao: ${curacaoTime}
${customer?.name ? `Customer name: ${customer.name}` : ''}

WHO YOU ARE:
Warm, confident, slightly playful. You know every customer by name. You make them feel valued.
You never sound scripted. Every message feels typed by a real person on their phone.
You NEVER mention delivery times, dates, or schedules — the FUIK team handles this.
Max 2 sentences for casual chat. One question at a time. Always end with next step or warm closing.

${languageGuide[language] || languageGuide.english}

CURAÇAO CODE-SWITCHING — CRITICAL:
Curaçao customers naturally mix Papiamentu, Dutch, English and Spanish in the same message.
"Mi ke 2 kaha di strawberry please" = valid order.
"No tambien 5 appels en 2 kiwi pida" = valid order.
"Ok ta bon, pero also 3 mango" = confirmation + addition.
ALWAYS understand the full intent regardless of language mixing.
NEVER ask customer to repeat in one language.

CUSTOMER CONTEXT:
${customerMemory || 'New or unknown customer.'}

${pendingOrderSection}

${trainingPhrases ? `BOLENGA'S VERIFIED PAPIAMENTU PHRASES — use naturally when relevant:\n${trainingPhrases}` : ''}

${contextWords ? `LOCAL TERMINOLOGY: ${contextWords}` : ''}

HOW TO HANDLE ORDERS:
1. When customer mentions products → call add_items immediately with ALL items detected
2. If qty or unit is missing → the system will auto-ask; you can also call ask_clarification
3. When all items are clear → call show_order_summary
4. When customer confirms (ta bon, si, yes, ja, ok, correct, klopt, confirmed) → call confirm_order
5. When customer wants to add more (tambe, plus, also, otro kos) → call add_items with new items
6. When customer wants to change something → call update_item or remove_item
7. ALWAYS call add_items even for informal orders like "mi ke mango ku wortel"

PRODUCT CATALOG (use for matching):
${productCatalog}

PRODUCTS FUIK CARRIES:
Fresh produce — fruits and vegetables. Accept ANY product even if not in catalog — FUIK will source it.
NEVER say out of stock. NEVER refuse an order. NEVER give prices.

ABSOLUTE RULES:
- NEVER mention delivery times, dates, or schedules
- NEVER say "today", "tomorrow", "this afternoon" or any delivery promise
- NEVER repeat the same phrase twice in a conversation
- NEVER sound scripted — vary your phrasing naturally
- Max 2 sentences for casual chat
- One question per message
- After confirming an order, one warm closing line then stop

GROUP CHAT BEHAVIOR:
${isGroup ? 'You are in a GROUP chat. Respond to business messages and direct mentions. Stay silent on casual human chat between group members.' : 'PRIVATE chat — respond to everything.'}`;
}

// ═══════════════════════════════════════════════════
// BUILD ORDER SUMMARY TEXT
// ═══════════════════════════════════════════════════

export function buildOrderSummaryText(draft: OrderDraft, language: string): string {
  // Separate complete vs incomplete items
  const completeItems = draft.items.filter(i => i.qty && i.unit);
  const incompleteItems = draft.items.filter(i => !i.qty || !i.unit);

  if (incompleteItems.length > 0) {
    // Don't show summary yet — ask for missing info on first incomplete item
    const missing = incompleteItems[0];
    const clarify: Record<string, string> = {
      papiamentu: !missing.qty
        ? `Kuantu ${missing.product_name} bo ke? (p.e. 2 kaha, 5 kg, 1 bolsa)`
        : `Bo ke ${missing.product_name} den kg, kaha, of bolsa?`,
      english: !missing.qty
        ? `How much ${missing.product_name}? (e.g. 2 cases, 5 kg, 1 bag)`
        : `${missing.product_name} — by kg, case, or bag?`,
      dutch: !missing.qty
        ? `Hoeveel ${missing.product_name}? (bijv. 2 dozen, 5 kg)`
        : `${missing.product_name} — per kg, doos, of zak?`,
      spanish: !missing.qty
        ? `¿Cuánto ${missing.product_name}? (ej. 2 cajas, 5 kg)`
        : `${missing.product_name} — ¿en kg, cajas, o bolsas?`,
    };
    return clarify[language] || clarify.english;
  }

  const lines = completeItems.map(i =>
    `• ${i.qty} ${i.unit} ${i.product_name}`
  ).join('\n');

  const templates: Record<string, string> = {
    papiamentu: `✅ Ta bon! Aki ta loke mi tin:\n${lines}\n\nTa korekt? Manda <b>SI</b> pa konfirmá. 🙏`,
    english: `✅ Got it! Here's your order:\n${lines}\n\nIs this correct? Reply <b>YES</b> to confirm. 🙏`,
    dutch: `✅ Begrepen! Dit is je bestelling:\n${lines}\n\nKlopt dit? Stuur <b>JA</b> om te bevestigen. 🙏`,
    spanish: `✅ ¡Listo! Aquí está tu pedido:\n${lines}\n\n¿Es correcto? Responde <b>SÍ</b> para confirmar. 🙏`,
  };
  return templates[language] || templates.english;
}

// ═══════════════════════════════════════════════════
// EXECUTE FUNCTION CALLS
// ═══════════════════════════════════════════════════

export async function executeFunctionCall(
  functionName: string,
  args: any,
  ctx: DreContext,
  orderDraft: OrderDraft
): Promise<{ reply: string; orderDraft: OrderDraft; shouldEscalate: boolean }> {
  let reply = '';
  let shouldEscalate = false;
  const { supabase, customer, language, conversationId, products, productAliases } = ctx;

  switch (functionName) {

    case 'add_items': {
      const newItems = (args.items || []).map((item: any) => {
        const match = matchProduct(item.product_name, products, productAliases);
        const matchedProduct = match.product_id
          ? products.find(p => p.id === match.product_id)
          : null;
        return {
          product_name: item.product_name,
          qty: item.qty ?? null,
          unit: item.unit ?? null,
          product_id: match.product_id,
          unit_price_xcg: matchedProduct?.price_xcg || 0,
        };
      });

      // Merge with existing draft
      for (const ni of newItems) {
        const existingIdx = orderDraft.items.findIndex(
          ei => ei.product_name.toLowerCase() === ni.product_name.toLowerCase()
        );
        if (existingIdx >= 0) {
          if (ni.qty !== null) orderDraft.items[existingIdx].qty = ni.qty;
          if (ni.unit !== null) orderDraft.items[existingIdx].unit = ni.unit;
        } else {
          orderDraft.items.push(ni);
        }
      }

      // Check for missing info
      const missingItem = orderDraft.items.find(i => !i.qty || !i.unit);
      if (missingItem) {
        const missingType = !missingItem.qty ? 'quantity' : 'unit';
        const clarifyMessages: Record<string, string> = {
          papiamentu: missingType === 'quantity'
            ? `Kuantu ${missingItem.product_name} bo ke? (p.e. 2 kaha, 5 kg, 1 bolsa)`
            : `Bo ke ${missingItem.product_name} den kg, kaha, of bolsa?`,
          english: missingType === 'quantity'
            ? `How much ${missingItem.product_name} would you like? (e.g. 2 cases, 5 kg, 1 bag)`
            : `${missingItem.product_name} — by kg, case, or bag?`,
          dutch: missingType === 'quantity'
            ? `Hoeveel ${missingItem.product_name} wil je? (bijv. 2 dozen, 5 kg)`
            : `${missingItem.product_name} — per kg, doos, of zak?`,
          spanish: missingType === 'quantity'
            ? `¿Cuánto ${missingItem.product_name} quieres? (ej. 2 cajas, 5 kg)`
            : `${missingItem.product_name} — ¿en kg, cajas, o bolsas?`,
        };
        reply = clarifyMessages[language] || clarifyMessages.english;
      } else {
        // All complete — show summary
        reply = buildOrderSummaryText(orderDraft, language);
      }
      break;
    }

    case 'remove_item': {
      const name = args.product_name.toLowerCase();
      orderDraft.items = orderDraft.items.filter(
        i => !i.product_name.toLowerCase().includes(name)
      );
      if (orderDraft.items.length > 0) {
        reply = buildOrderSummaryText(orderDraft, language);
      } else {
        const emptyReplies: Record<string, string> = {
          papiamentu: 'Bo orde ta bashi awor. Kiko bo ke? 🌿',
          english: 'Your order is empty now. What would you like? 🌿',
          dutch: 'Je bestelling is nu leeg. Wat wil je bestellen? 🌿',
          spanish: 'Tu pedido está vacío ahora. ¿Qué quieres? 🌿',
        };
        reply = emptyReplies[language] || emptyReplies.english;
      }
      break;
    }

    case 'update_item': {
      const idx = orderDraft.items.findIndex(
        i => i.product_name.toLowerCase().includes(args.product_name.toLowerCase())
      );
      if (idx >= 0) {
        if (args.qty !== undefined) orderDraft.items[idx].qty = args.qty;
        if (args.unit !== undefined) orderDraft.items[idx].unit = args.unit;
      }
      reply = buildOrderSummaryText(orderDraft, language);
      break;
    }

    case 'show_order_summary': {
      if (orderDraft.items.length === 0) {
        const emptyReplies: Record<string, string> = {
          papiamentu: 'Bo orde ta bashi. Kiko bo ke? 🌿',
          english: 'Your order is empty. What would you like? 🌿',
          dutch: 'Je bestelling is leeg. Wat wil je? 🌿',
          spanish: 'Tu pedido está vacío. ¿Qué quieres? 🌿',
        };
        reply = emptyReplies[language] || emptyReplies.english;
      } else {
        reply = buildOrderSummaryText(orderDraft, language);
      }
      break;
    }

    case 'confirm_order': {
      console.log('CONFIRM_ORDER called, draft items:', JSON.stringify(orderDraft.items));
      if (orderDraft.items.length === 0) {
        console.log('CONFIRM_ORDER: draft is EMPTY — cannot confirm. Agent state may have been reset.');
        const noItemsReplies: Record<string, string> = {
          papiamentu: 'No tin item den bo orde ainda. Kiko bo ke? 🌿',
          english: 'No items in your order yet. What would you like? 🌿',
          dutch: 'Nog geen items in je bestelling. Wat wil je? 🌿',
          spanish: 'No hay artículos en tu pedido. ¿Qué quieres? 🌿',
        };
        reply = noItemsReplies[language] || noItemsReplies.english;
        break;
      }

      const orderNumber = `${ctx.channel === 'telegram' ? 'TG' : 'WA'}-${Date.now().toString(36).toUpperCase()}`;

      const { data: order } = await supabase.from('distribution_orders').insert({
        order_number: orderNumber,
        customer_id: customer.id,
        source_channel: ctx.channel,
        status: 'confirmed',
        awaiting_customer_confirmation: false,
        confirmed_by_customer_at: new Date().toISOString(),
        agent_state_snapshot: { version: 'v4', draft: orderDraft },
      }).select().single();

      if (order) {
        let totalXcg = 0;

        for (const item of orderDraft.items) {
          const lineTotal = (item.unit_price_xcg || 0) * (item.qty || 0);
          totalXcg += lineTotal;

          const { data: insertedItem, error: itemError } = await supabase
            .from('distribution_order_items')
            .insert({
              order_id: order.id,
              product_id: item.product_id,
              product_name_raw: item.product_name,
              quantity: item.qty || 0,
              order_unit: item.unit || 'piece',
              unit_price_xcg: item.unit_price_xcg || 0,
              total_xcg: lineTotal,
            });

          if (itemError) {
            console.error('ITEM INSERT ERROR:', JSON.stringify(itemError), 'item:', JSON.stringify(item));
          } else {
            console.log('ITEM INSERTED:', item.product_name, item.qty, item.unit);
          }

          // Log match for training
          await supabase.from('distribution_ai_match_logs').insert({
            raw_text: item.product_name,
            detected_language: language,
            matched_product_id: item.product_id,
            confidence: item.product_id ? 'high' : 'low',
            needs_review: !item.product_id,
            source_channel: ctx.channel,
            conversation_id: conversationId,
            match_source: item.product_id ? 'v4_function_call' : 'no_match',
          }).catch(() => {});
        }

        await supabase.from('distribution_orders')
          .update({ total_xcg: totalXcg, items_count: orderDraft.items.length })
          .eq('id', order.id);

        await supabase.from('dre_conversations')
          .update({ order_id: order.id })
          .eq('id', conversationId);

        // Notify team
        try {
          await supabase.functions.invoke('notify-team-order', {
            body: {
              order_id: order.id,
              order_number: orderNumber,
              customer_name: customer.name || null,
              total_xcg: totalXcg,
              items: orderDraft.items.map(i => ({
                product_name: i.product_name,
                quantity: i.qty,
                unit_price_xcg: i.unit_price_xcg,
              })),
              notification_type: 'new_order',
            },
          });
        } catch (e) {
          console.error('Team notification failed (non-blocking):', e);
        }

        // Clear draft
        orderDraft.items = [];

        // NUCLEAR CLEAR — completely reset agent_state after confirmation
        await supabase.from('dre_conversations')
          .update({ 
            agent_state: { order_draft: { items: [] }, last_confirmed_order: orderNumber, cleared_at: new Date().toISOString() },
            order_id: order.id,
          })
          .eq('id', conversationId);
        console.log('NUCLEAR CLEAR: agent_state reset after order', orderNumber);

        const confirmReplies: Record<string, string> = {
          papiamentu: `Perfekto! 🌿 Bo orde #${orderNumber} ta aden. E team di FUIK lo kontakta bo.`,
          english: `Perfect! 🌿 Order #${orderNumber} is in. The FUIK team will be in touch.`,
          dutch: `Perfect! 🌿 Bestelling #${orderNumber} ontvangen. Het FUIK team neemt contact op.`,
          spanish: `¡Perfecto! 🌿 Pedido #${orderNumber} registrado. El equipo de FUIK te contactará.`,
        };
        reply = confirmReplies[language] || confirmReplies.english;
      }
      break;
    }

    case 'cancel_order': {
      orderDraft.items = [];
      const cancelReplies: Record<string, string> = {
        papiamentu: 'Ta bon, mi a kansela bo orde. Tin algu otro mi por yuda bo ku? 🌿',
        english: 'Got it, order cancelled. Anything else I can help with? 🌿',
        dutch: 'Oké, bestelling geannuleerd. Kan ik je nog ergens mee helpen? 🌿',
        spanish: 'Entendido, pedido cancelado. ¿En qué más puedo ayudarte? 🌿',
      };
      reply = cancelReplies[language] || cancelReplies.english;
      break;
    }

    case 'continue_pending_order': {
      if (ctx.pendingOrder) {
        const items = ctx.pendingOrder.items || [];
        orderDraft.items = items.map((i: any) => ({
          product_name: i.product_name_raw,
          qty: i.quantity,
          unit: i.order_unit,
          product_id: i.product_id,
          unit_price_xcg: i.unit_price_xcg || 0,
        }));
        reply = buildOrderSummaryText(orderDraft, language);
      } else {
        const noOrderReplies: Record<string, string> = {
          papiamentu: 'No tin orde pendiente. Kiko bo ke ordená? 🌿',
          english: 'No pending order found. What would you like to order? 🌿',
          dutch: 'Geen openstaande bestelling gevonden. Wat wil je bestellen? 🌿',
          spanish: 'No hay pedido pendiente. ¿Qué quieres pedir? 🌿',
        };
        reply = noOrderReplies[language] || noOrderReplies.english;
      }
      break;
    }

    case 'replace_pending_order': {
      if (ctx.pendingOrder) {
        await supabase.from('distribution_orders')
          .update({ status: 'cancelled' })
          .eq('id', ctx.pendingOrder.id);
      }
      orderDraft.items = [];
      const replaceReplies: Record<string, string> = {
        papiamentu: 'Ta bon, mi a kansela e orde anterior. Manda bo nobo orde. 🌿',
        english: 'Got it, previous order cancelled. Send your new order. 🌿',
        dutch: 'Oké, vorige bestelling geannuleerd. Stuur je nieuwe bestelling. 🌿',
        spanish: 'Entendido, pedido anterior cancelado. Envía tu nuevo pedido. 🌿',
      };
      reply = replaceReplies[language] || replaceReplies.english;
      break;
    }

    case 'ask_clarification': {
      reply = args.question;
      break;
    }

    case 'escalate_to_human': {
      shouldEscalate = true;
      await supabase.from('dre_conversations')
        .update({ control_status: 'escalated' })
        .eq('id', conversationId);

      const escalateReplies: Record<string, string> = {
        papiamentu: 'Mi ta konekta bo ku un di nos kolega awor mismo. Un momento 🙏',
        english: 'Let me connect you with one of our team right now. One moment 🙏',
        dutch: 'Ik verbind je door met een van onze collega\'s. Eén moment 🙏',
        spanish: 'Te conecto con uno de nuestro equipo ahora mismo. Un momento 🙏',
      };
      reply = escalateReplies[language] || escalateReplies.english;

      // Notify manager via Telegram
      const { data: mgr } = await supabase.from('app_settings')
        .select('value').eq('key', 'manager_telegram_chat_id').maybeSingle();
      if (mgr?.value) {
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        if (telegramToken) {
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: mgr.value,
              text: `⚠️ Escalation needed\nCustomer: ${customer?.name || 'Unknown'}\nReason: ${args.reason}\nChannel: ${ctx.channel}`,
            }),
          });
        }
      }
      break;
    }
  }

  return { reply: sanitizeReply(reply, language), orderDraft, shouldEscalate };
}

// ═══════════════════════════════════════════════════
// CUSTOMER MEMORY LOADER
// ═══════════════════════════════════════════════════

export async function loadCustomerMemory(supabase: any, customerId: string): Promise<string> {
  try {
    const { data } = await supabase.rpc('get_customer_memory', { p_customer_id: customerId });
    if (!data) return '';

    const parts: string[] = [];
    if (data.customer_name) parts.push(`Customer: ${data.customer_name}`);
    if (data.customer_type) parts.push(`Type: ${data.customer_type}`);

    const totalOrders = data.total_orders || 0;
    if (totalOrders === 0) {
      parts.push('Status: NEW CUSTOMER — first order ever. Give extra warm welcome.');
    } else {
      parts.push(`Total orders: ${totalOrders}`);
    }

    if (data.last_order_days_ago !== null) {
      const days = data.last_order_days_ago;
      if (days === 0) parts.push('Last order: today');
      else if (days === 1) parts.push('Last order: yesterday');
      else if (days > 14) parts.push(`Last order: ${days} days ago — LONG TIME, acknowledge warmly`);
      else parts.push(`Last order: ${days} days ago`);
    }

    if (data.last_order_items && data.last_order_items.length > 0) {
      const items = data.last_order_items
        .map((i: any) => `${i.qty} ${i.unit || ''} ${i.product}`.trim())
        .join(', ');
      parts.push(`Last order: ${items}`);
    }

    if (data.most_ordered_product) parts.push(`Favorite: ${data.most_ordered_product}`);
    if (data.avg_order_frequency_days) parts.push(`Orders every ~${data.avg_order_frequency_days} days`);

    return parts.join(' | ');
  } catch (e) {
    console.error('loadCustomerMemory error:', e);
    return '';
  }
}

// ═══════════════════════════════════════════════════
// MAIN DRE AGENT — GPT-4o with function calling
// ═══════════════════════════════════════════════════

export async function runDreAgent(
  userMessage: string,
  ctx: DreContext,
  orderDraft: OrderDraft,
  openaiKey: string,
  lovableKey: string
): Promise<{ reply: string; orderDraft: OrderDraft }> {

  const systemPrompt = buildDreSystemPrompt(ctx);

  // Include current draft state in the conversation so GPT knows what's pending
  const draftContext = orderDraft.items.length > 0
    ? `\n[SYSTEM: Current order draft has ${orderDraft.items.length} items: ${orderDraft.items.map(i => `${i.qty || '?'} ${i.unit || '?'} ${i.product_name}`).join(', ')}. Customer may want to add, remove, or confirm.]`
    : '\n[SYSTEM: Order draft is empty. Customer may want to start a new order.]';

  const messages = [
    { role: 'system' as const, content: systemPrompt + draftContext },
    ...ctx.conversationHistory.slice(-10),
    { role: 'user' as const, content: userMessage },
  ];

  // Try GPT-4o with function calling via OpenAI directly
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        tools: DRE_FUNCTIONS.map(f => ({ type: 'function', function: f })),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`GPT-4o error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];

    if (!choice) throw new Error('No response from GPT-4o');

    // Handle function calls
    if (choice.message?.tool_calls?.length > 0) {
      let currentDraft: OrderDraft = { items: [...orderDraft.items.map(i => ({...i}))] };
      let finalReply = '';
      let shouldEscalate = false;

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          fnArgs = {};
        }

        console.log(`Dre v4 calling function: ${fnName}`, JSON.stringify(fnArgs));

        const result = await executeFunctionCall(fnName, fnArgs, ctx, currentDraft);
        currentDraft = result.orderDraft;
        if (result.reply) finalReply = result.reply;
        if (result.shouldEscalate) shouldEscalate = true;
      }

      // Generate natural varied confirmation if confirm_order succeeded
      const lastToolCall = choice.message.tool_calls[choice.message.tool_calls.length - 1];
      if (lastToolCall?.function?.name === 'confirm_order' && finalReply && !finalReply.includes('No items') && !finalReply.includes('No tin item')) {
        try {
          const orderNum = finalReply.match(/#[\w-]+/)?.[0] || '';
          const naturalClose = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{
                role: 'system',
                content: `You are Dre, a warm Curaçao fresh produce salesperson. Generate a SHORT, natural, varied order confirmation in ${ctx.language}. Include order number ${orderNum}. Sound like a real person texting — not a template. Max 2 sentences. NEVER mention delivery dates/times/schedules. Use 1 emoji max. Vary phrasing every time.`,
              }, {
                role: 'user',
                content: 'Generate confirmation now.',
              }],
              temperature: 0.95,
              max_tokens: 80,
            }),
          });
          const naturalData = await naturalClose.json();
          const naturalReply = naturalData.choices?.[0]?.message?.content?.trim();
          if (naturalReply) finalReply = sanitizeReply(naturalReply, ctx.language);
        } catch (e) {
          console.error('Natural confirmation generation failed, using template:', e);
        }
      }

      // If function call produced no reply, get GPT to generate one
      if (!finalReply) {
        const followUpResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              ...messages,
              choice.message,
              ...choice.message.tool_calls.map((tc: any) => ({
                role: 'tool',
                tool_call_id: tc.id,
                content: 'Done successfully.',
              })),
            ],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });
        const followUpData = await followUpResp.json();
        finalReply = followUpData.choices?.[0]?.message?.content || '';
      }

      return {
        reply: sanitizeReply(finalReply, ctx.language),
        orderDraft: currentDraft,
      };
    }

    // Direct text response (no function call needed — casual chat)
    const textReply = choice.message?.content || '';
    return {
      reply: sanitizeReply(textReply, ctx.language),
      orderDraft,
    };

  } catch (gptError) {
    console.error('GPT-4o failed, trying Lovable AI (Gemini) fallback:', gptError);

    // Fallback to Gemini via Lovable AI Gateway
    try {
      const fallbackResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt + '\n\nRespond naturally in the customer\'s language. Keep it short. Max 2 sentences.' },
            ...ctx.conversationHistory.slice(-6),
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });
      const fallbackData = await fallbackResp.json();
      const fallbackReply = fallbackData.choices?.[0]?.message?.content || '';
      return {
        reply: sanitizeReply(fallbackReply, ctx.language),
        orderDraft,
      };
    } catch {
      // Ultimate fallback — never go silent
      const neverSilent: Record<string, string> = {
        papiamentu: 'Mi no tabata kla di komprondé — por fabor repití? 🙏',
        english: 'Sorry, I didn\'t catch that — could you repeat? 🙏',
        dutch: 'Sorry, ik begreep dat niet — kun je herhalen? 🙏',
        spanish: 'Lo siento, no entendí — ¿puedes repetir? 🙏',
      };
      return {
        reply: neverSilent[ctx.language] || neverSilent.english,
        orderDraft,
      };
    }
  }
}
