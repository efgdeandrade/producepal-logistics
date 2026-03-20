// Dre AI Agent v4 — WhatsApp AI Agent
// GPT-4o function calling with Gemini Flash language detection
// Parity with telegram-webhook using shared dre-core library
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  detectLanguage, runDreAgent, sanitizeReply, loadCustomerMemory,
  type DreContext, type OrderDraft,
} from '../_shared/dre-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════
// WHATSAPP MESSAGE SENDING (preserved from v3)
// ═══════════════════════════════════════════════════

async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    console.error('WhatsApp credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    console.log('WhatsApp message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════
// GREETING DETECTION
// ═══════════════════════════════════════════════════

const GREETING_WORDS = [
  'hi', 'hello', 'hey', 'halo', 'bon dia', 'bon tardi', 'bon nochi',
  'ayo', 'good morning', 'good afternoon', 'good evening', 'goedemorgen',
  'goedemiddag', 'hola', 'buenos días', 'buenas tardes', 'buenos dias',
];

function isGreetingMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return GREETING_WORDS.some(g =>
    lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!') || lower.startsWith(g + ',')
  );
}

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      customer_id,
      customer_name,
      customer_phone,
      message_text,
      preferred_language,
    } = await req.json();

    console.log('=== DRE AI v4 (WhatsApp) ===');
    console.log('Customer:', customer_name || customer_phone);
    console.log('Message:', message_text);

    if (!message_text || !customer_phone) {
      return new Response(JSON.stringify({ error: 'Missing message_text or customer_phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const externalChatId = customer_phone.replace(/\D/g, '') || customer_phone;

    // ── Load customer ─────────────────────────────────────
    let customer: any = null;
    if (customer_id) {
      const { data } = await supabase
        .from('distribution_customers')
        .select('id, name, preferred_language, whatsapp_phone, telegram_chat_id')
        .eq('id', customer_id)
        .maybeSingle();
      customer = data;
    }

    if (!customer) {
      // Try finding by phone
      const { data } = await supabase
        .from('distribution_customers')
        .select('id, name, preferred_language, whatsapp_phone, telegram_chat_id')
        .eq('whatsapp_phone', customer_phone)
        .maybeSingle();
      customer = data;
    }

    // ── Find or create DRE conversation ───────────────────
    let { data: convo } = await supabase
      .from('dre_conversations')
      .select('id, control_status, agent_state, language_detected')
      .eq('external_chat_id', externalChatId)
      .eq('channel', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo } = await supabase.from('dre_conversations').insert({
        channel: 'whatsapp',
        external_chat_id: externalChatId,
        control_status: 'dre_active',
        customer_id: customer?.id || null,
        agent_state: { order_draft: { items: [] } },
      }).select().single();
      convo = newConvo;
    }

    if (!convo) {
      console.error('Could not create conversation');
      await sendWhatsAppMessage(customer_phone, 'Sorry, something went wrong. Please try again! 🙏');
      return new Response(JSON.stringify({ error: 'Conversation error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Human in control — just store message
    if (convo.control_status === 'human_in_control') {
      await supabase.from('dre_messages').insert({
        conversation_id: convo.id, role: 'customer',
        content: message_text, media_type: 'text',
      });
      // Also store in whatsapp_messages for backward compat
      await supabase.from('whatsapp_messages').insert({
        direction: 'inbound', phone_number: customer_phone,
        message_text, customer_id: customer?.id || null, status: 'received',
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, action: 'human_in_control' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      waHistoryResult,
    ] = await Promise.all([
      detectLanguage(message_text, lovableKey),
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
      customer?.id ? supabase.from('distribution_orders')
        .select('id, order_number, created_at, awaiting_customer_confirmation, distribution_order_items(product_name_raw, quantity, order_unit, product_id, unit_price_xcg)')
        .eq('customer_id', customer.id)
        .eq('awaiting_customer_confirmation', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() : Promise.resolve({ data: null }),
      customer?.id ? loadCustomerMemory(supabase, customer.id) : Promise.resolve('New WhatsApp customer.'),
      supabase.from('whatsapp_messages')
        .select('direction, message_text, created_at')
        .eq('phone_number', customer_phone)
        .order('created_at', { ascending: true })
        .limit(30),
    ]);

    const language = langResult;
    const products = productsResult.data || [];
    const productAliases = aliasesResult.data || [];
    const contextWords = (dictResult.data || []).map((w: any) => `${w.word}=${w.meaning}`).join(', ');
    const trainingPhrases = (trainingResult.data || [])
      .map((e: any) => `[${e.category}] "${e.corrected_phrase}"${e.example_context ? ` — ${e.example_context}` : ''}`)
      .join('\n');

    const allMessages = (historyResult.data || []).reverse();

    // Session detection using dre_messages
    const isGreeting = isGreetingMessage(message_text);
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

    // Reset draft on new session
    if (isNewSession) {
      orderDraft.items = [];
    }

    // Curaçao time (UTC-4)
    const curacaoNow = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const hours = curacaoNow.getUTCHours();
    const curacaoTime = `${String(hours).padStart(2, '0')}:${String(curacaoNow.getUTCMinutes()).padStart(2, '0')} (${hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'})`;

    // Store customer message in dre_messages
    await supabase.from('dre_messages').insert({
      conversation_id: convo.id, role: 'customer',
      content: message_text, media_type: 'text', language_detected: language,
    });

    // Also store in whatsapp_messages for backward compat
    await supabase.from('whatsapp_messages').insert({
      direction: 'inbound', phone_number: customer_phone,
      message_text, customer_id: customer?.id || null, status: 'received',
    }).catch(() => {});

    // Push notification to managers
    supabase.functions.invoke('send-push-notification', {
      body: {
        notify_all_managers: true,
        title: `New WhatsApp — ${customer?.name || customer_name || customer_phone}`,
        message: message_text.substring(0, 100),
        url: '/intake/conversations',
      },
    }).catch(() => {});

    // Build context
    const ctx: DreContext = {
      supabase,
      customer: customer || { id: null, name: customer_name || 'Unknown', preferred_language: preferred_language || null },
      conversationId: convo.id,
      language,
      customerMemory,
      pendingOrder,
      conversationHistory,
      products,
      productAliases,
      trainingPhrases,
      contextWords,
      curacaoTime,
      channel: 'whatsapp',
      chatId: externalChatId,
      isGroup: false,
    };

    // ── Run Dre Agent ─────────────────────────────────────
    const { reply, orderDraft: updatedDraft } = await runDreAgent(
      message_text, ctx, orderDraft, openaiKey, lovableKey
    );

    // ── Send reply ────────────────────────────────────────
    if (reply) {
      // Strip HTML tags for WhatsApp (WhatsApp uses its own formatting)
      const waReply = reply
        .replace(/<b>/g, '*').replace(/<\/b>/g, '*')
        .replace(/<i>/g, '_').replace(/<\/i>/g, '_')
        .replace(/<[^>]+>/g, '');

      await sendWhatsAppMessage(customer_phone, waReply);

      // Store outbound in dre_messages
      await supabase.from('dre_messages').insert({
        conversation_id: convo.id, role: 'dre',
        content: reply, media_type: 'text', language_detected: language,
      });

      // Store in whatsapp_messages for backward compat
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound', phone_number: customer_phone,
        message_text: waReply, customer_id: customer?.id || null, status: 'sent',
      }).catch(() => {});

      // Log for training review
      await supabase.from('distribution_ai_match_logs').insert({
        raw_text: message_text,
        detected_language: language,
        dre_reply: reply,
        needs_language_review: true,
        source_channel: 'whatsapp',
        conversation_id: convo.id,
      }).catch(() => {});
    }

    // Save updated state
    const langMap: Record<string, string> = { pap: 'papiamentu', en: 'english', nl: 'dutch', es: 'spanish' };
    const dreLang = langMap[language] || (['papiamentu', 'english', 'dutch', 'spanish'].includes(language) ? language : null);

    await supabase.from('dre_conversations').update({
      agent_state: { order_draft: updatedDraft },
      language_detected: dreLang,
      updated_at: new Date().toISOString(),
    }).eq('id', convo.id);

    return new Response(JSON.stringify({
      success: true,
      action: 'v4_agent',
      detected_language: language,
      draft_items: updatedDraft.items.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('DRE AI v4 (WhatsApp) error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
