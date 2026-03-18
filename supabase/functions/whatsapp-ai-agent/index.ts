import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// DRE - FUIK's AI Sales Agent
// Full conversational AI powered by Lovable AI (Gemini)
// Natural conversation flow with emotional intelligence & personality
// ============================================================================

// Dre's core personality and instructions for the AI
const DRE_SYSTEM_PROMPT = `You are DRE, the friendly WhatsApp sales assistant for FUIK Fresh Produce. You help customers order fresh fruits, vegetables, herbs, and juices in Curaçao.

## YOUR PERSONALITY
- You're warm, helpful, and genuinely care about customers
- You speak casually like a friend, not formally like a corporate bot
- You use emojis naturally but not excessively (1-2 per message max)
- You have a playful sense of humor but stay professional
- You're patient and never get frustrated, even with confused customers
- You celebrate with customers when orders are placed ("Got you covered! 🎉")

## LANGUAGE RULES
- ALWAYS respond in the same language the customer uses
- You speak Papiamento (primary), English, Dutch, and Spanish fluently
- For Papiamento: Use natural expressions like "Kon ta?", "Ta bon", "Danki", "Sin problema"
- Never mix languages in the same message unless the customer does
- If unsure of language, default to Papiamento

## CONVERSATION STYLE
- Keep messages SHORT and conversational (under 150 words usually)
- Never sound robotic or scripted - vary your phrasing naturally
- Ask clarifying questions naturally, not like a form
- Use the customer's name when you know it (but don't overuse it)
- Acknowledge what they said before responding
- If they're chatting casually, chat back briefly before steering to orders
- NEVER repeat the same phrase twice in a conversation

## EMOTIONAL INTELLIGENCE
- If customer seems frustrated → Be extra empathetic, apologize if needed, escalate to human
- If customer seems confused → Simplify, offer examples, be patient
- If customer seems happy → Match their energy, be enthusiastic
- If customer seems rushed → Be concise, skip the small talk
- If customer has a complaint → Take it seriously, acknowledge feelings, escalate immediately

## WHAT YOU SELL
FUIK sells ONLY fresh produce:
- Fresh fruits (banana, mango, papaya, pineapple, citrus, berries, etc.)
- Fresh vegetables (tomato, lettuce, cabbage, peppers, onions, carrots, etc.)
- Fresh herbs (cilantro, basil, mint, etc.)
- Fresh juices and coconut water
- NO fish, NO meat, NO seafood (despite company name)

## ORDER HANDLING
When customer mentions products with quantities:
1. Parse what they want (product + quantity + optional unit like kg/lb)
2. Match to our product catalog (I'll provide matches)
3. Show a friendly recap and ask for confirmation
4. On confirmation, create the order

For modifications to existing orders:
- If picking hasn't started → Handle automatically
- If picking has started → Escalate to the logistics team

## SPECIAL SITUATIONS
- NEW CUSTOMERS (no customer_id): Welcome them warmly, still take their order
- COMPLAINTS: Acknowledge, empathize, notify management IMMEDIATELY
- HUMAN REQUEST: If they want to talk to a person, connect them right away
- SAME-DAY ORDERS: If they already ordered today, ask if new items are for same order or tomorrow

## THINGS YOU CAN'T DO
- You cannot check inventory levels
- You cannot give price quotes (just take orders)
- You cannot process payments
- For these, offer to connect them with the team

## RESPONSE FORMAT
Always respond in JSON format:
{
  "response": "Your conversational message to the customer",
  "intent": "greeting|order|confirmation|cancellation|complaint|human_request|chitchat|unclear",
  "parsed_items": [{"product": "name", "quantity": 5, "unit": "kg"}],
  "detected_language": "pap|en|nl|es",
  "customer_mood": "neutral|happy|frustrated|confused|rushed",
  "needs_escalation": false,
  "escalation_type": null,
  "escalation_reason": null
}`;

// Send WhatsApp message via Meta API
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
          text: { body: message }
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

// Call Lovable AI Gateway for conversation processing
async function callLovableAI(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  productContext: string
): Promise<{ response: string; intent: string; parsed_items: unknown[]; detected_language: string; customer_mood: string; needs_escalation: boolean; escalation_type: string | null; escalation_reason: string | null }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    throw new Error('AI configuration missing');
  }
  
  // Build messages array with system prompt and conversation history
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `## AVAILABLE PRODUCTS\n${productContext}` },
    ...conversationHistory
  ];
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.7, // Some creativity for natural responses
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limited - please try again');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted');
      }
      throw new Error(`AI error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';
    
    console.log('AI raw response:', aiContent);
    
    // Parse JSON response from AI
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = aiContent;
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Try to find JSON object directly
        const objMatch = aiContent.match(/\{[\s\S]*\}/);
        if (objMatch) {
          jsonStr = objMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        response: parsed.response || aiContent,
        intent: parsed.intent || 'unclear',
        parsed_items: parsed.parsed_items || [],
        detected_language: parsed.detected_language || 'pap',
        customer_mood: parsed.customer_mood || 'neutral',
        needs_escalation: parsed.needs_escalation || false,
        escalation_type: parsed.escalation_type || null,
        escalation_reason: parsed.escalation_reason || null
      };
    } catch {
      // If JSON parsing fails, use the raw response as text
      console.warn('Could not parse AI response as JSON, using raw text');
      return {
        response: aiContent,
        intent: 'unclear',
        parsed_items: [],
        detected_language: 'pap',
        customer_mood: 'neutral',
        needs_escalation: false,
        escalation_type: null,
        escalation_reason: null
      };
    }
  } catch (error) {
    console.error('Lovable AI request failed:', error);
    throw error;
  }
}

// Get team member by role from profiles
// deno-lint-ignore no-explicit-any
async function getTeamMemberByRole(supabase: any, role: string): Promise<{ name: string; phone: string } | null> {
  const { data: teamMember } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_phone')
    .eq('is_fuik_team', true)
    .eq('team_role', role)
    .limit(1)
    .single();
  
  if (teamMember && (teamMember as { whatsapp_phone?: string }).whatsapp_phone) {
    const tm = teamMember as { full_name?: string; whatsapp_phone: string };
    return { name: tm.full_name || role, phone: tm.whatsapp_phone };
  }
  
  return null;
}

// Check if order has items being picked
// deno-lint-ignore no-explicit-any
async function checkOrderPickingStatus(supabase: any, orderId: string): Promise<boolean> {
  const { data: items } = await supabase
    .from('distribution_order_items')
    .select('picked_quantity')
    .eq('order_id', orderId)
    .eq('is_cancelled', false);
  
  if (!items) return false;
  return (items as Array<{ picked_quantity?: number }>).some(item => (item.picked_quantity || 0) > 0);
}

// Build conversation context for AI
function buildConversationContext(
  messages: Array<{ direction: string; message_text: string; created_at: string }>,
  currentMessage: string
): Array<{ role: string; content: string }> {
  const history: Array<{ role: string; content: string }> = [];
  
  // Add recent conversation history (last 20 messages)
  for (const msg of messages.slice(-20)) {
    const role = msg.direction === 'inbound' ? 'user' : 'assistant';
    history.push({ role, content: msg.message_text });
  }
  
  // Add current message
  history.push({ role: 'user', content: currentMessage });
  
  return history;
}

// Build product context for AI
function buildProductContext(
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>,
  aliases: Array<{ alias: string; product_id: string }>,
  dictionary: Array<{ word: string; meaning: string; word_type: string }>
): string {
  // Group products with their aliases
  const productInfo = products.map(p => {
    const productAliases = aliases.filter(a => a.product_id === p.id).map(a => a.alias);
    const names = [p.name, p.name_pap, p.name_nl, p.name_es].filter(Boolean);
    return `- ${p.name} (${p.code}): ${names.join(', ')}${productAliases.length > 0 ? ` | Aliases: ${productAliases.join(', ')}` : ''} | Unit: ${p.unit || 'piece'}`;
  });
  
  // Add common translations from dictionary
  const translations = dictionary.slice(0, 50).map(d => `${d.word} = ${d.meaning}`);
  
  return `### Product Catalog (${products.length} products)
${productInfo.slice(0, 100).join('\n')}

### Common Local Terms
${translations.join(', ')}`;
}

// Match products from AI parsed items to database
// deno-lint-ignore no-explicit-any
async function matchProducts(
  supabase: any,
  parsedItems: Array<{ product: string; quantity: number; unit?: string }>,
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>,
  aliases: Array<{ alias: string; product_id: string }>,
  customerId: string | null,
  language: string
): Promise<{ matched: Array<{ product_id: string; product_name: string; quantity: number; unit?: string; unit_price: number; confidence: number }>; unmatched: string[] }> {
  const matched: Array<{ product_id: string; product_name: string; quantity: number; unit?: string; unit_price: number; confidence: number }> = [];
  const unmatched: string[] = [];
  
  for (const item of parsedItems) {
    const searchText = item.product.toLowerCase().trim();
    let bestMatch: typeof products[0] | null = null;
    let bestConfidence = 0;
    let matchSource = 'none';
    
    // 1. Check aliases first (highest priority)
    for (const alias of aliases) {
      if (alias.alias.toLowerCase() === searchText || 
          searchText.includes(alias.alias.toLowerCase()) || 
          alias.alias.toLowerCase().includes(searchText)) {
        const product = products.find(p => p.id === alias.product_id);
        if (product) {
          bestMatch = product;
          bestConfidence = 1.0;
          matchSource = 'alias';
          break;
        }
      }
    }
    
    // 2. Direct product name match
    if (!bestMatch) {
      for (const product of products) {
        const names = [
          product.name?.toLowerCase(),
          product.name_pap?.toLowerCase(),
          product.name_nl?.toLowerCase(),
          product.name_es?.toLowerCase(),
          product.code?.toLowerCase()
        ].filter(Boolean) as string[];
        
        for (const name of names) {
          if (name === searchText) {
            bestMatch = product;
            bestConfidence = 1.0;
            matchSource = 'exact';
            break;
          } else if (name.includes(searchText) || searchText.includes(name)) {
            if (!bestMatch || name.length < (bestMatch.name?.length || 999)) {
              bestMatch = product;
              bestConfidence = 0.85;
              matchSource = 'partial';
            }
          }
        }
        if (bestConfidence === 1.0) break;
      }
    }
    
    // 3. Fuzzy word matching
    if (!bestMatch) {
      const searchWords = searchText.split(/\s+/);
      for (const product of products) {
        const nameWords = product.name.toLowerCase().split(/\s+/);
        const matchCount = searchWords.filter(sw => 
          nameWords.some(nw => nw.includes(sw) || sw.includes(nw))
        ).length;
        const score = matchCount / Math.max(searchWords.length, nameWords.length);
        if (score > bestConfidence && score >= 0.5) {
          bestMatch = product;
          bestConfidence = score;
          matchSource = 'fuzzy';
        }
      }
    }
    
    if (bestMatch && bestConfidence >= 0.5) {
      matched.push({
        product_id: bestMatch.id,
        product_name: bestMatch.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: bestMatch.price_xcg || 0,
        confidence: bestConfidence
      });
      
      // Log the match
      await supabase.from('distribution_ai_match_logs').insert({
        raw_text: item.product,
        matched_product_id: bestMatch.id,
        customer_id: customerId || null,
        confidence: bestConfidence >= 0.8 ? 'high' : bestConfidence >= 0.6 ? 'medium' : 'low',
        detected_quantity: item.quantity,
        detected_unit: item.unit,
        detected_language: language,
        needs_review: bestConfidence < 0.7 && matchSource !== 'alias',
        match_source: matchSource
      });
      
      console.log(`Matched "${item.product}" → "${bestMatch.name}" (${matchSource}, ${(bestConfidence * 100).toFixed(0)}%)`);
    } else {
      unmatched.push(item.product);
      console.log(`No match for "${item.product}"`);
    }
  }
  
  return { matched, unmatched };
}

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
      preferred_language 
    } = await req.json();

    console.log('=== DRE AI Processing ===');
    console.log('Customer:', customer_name || customer_phone);
    console.log('Message:', message_text);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load products, aliases, and dictionary in parallel
    const [productsResult, aliasesResult, dictionaryResult, conversationResult, recentOrdersResult] = await Promise.all([
      supabase
        .from('distribution_products')
        .select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit')
        .eq('is_active', true),
      supabase
        .from('distribution_product_aliases')
        .select('alias, product_id, language'),
      supabase
        .from('distribution_context_words')
        .select('word, meaning, word_type')
        .limit(200),
      // Get conversation history
      supabase
        .from('whatsapp_messages')
        .select('direction, message_text, created_at')
        .eq('phone_number', customer_phone)
        .order('created_at', { ascending: true })
        .limit(30),
      // Get recent orders
      supabase
        .from('distribution_orders')
        .select('id, order_number, status, created_at, total_xcg')
        .or(customer_id ? `customer_id.eq.${customer_id},customer_phone.eq.${customer_phone}` : `customer_phone.eq.${customer_phone}`)
        .in('status', ['pending', 'confirmed', 'picking'])
        .order('created_at', { ascending: false })
        .limit(1)
    ]);
    
    const products = productsResult.data || [];
    const aliases = (aliasesResult.data || []) as Array<{ alias: string; product_id: string; language?: string }>;
    const dictionary = (dictionaryResult.data || []) as Array<{ word: string; meaning: string; word_type: string }>;
    const conversationHistory = (conversationResult.data || []) as Array<{ direction: string; message_text: string; created_at: string }>;
    const recentOrder = (recentOrdersResult.data?.[0] || null) as { id: string; order_number: string; status: string; created_at: string; total_xcg: number } | null;
    
    console.log(`Loaded: ${products.length} products, ${aliases.length} aliases, ${dictionary.length} dictionary words, ${conversationHistory.length} messages`);

    if (products.length === 0) {
      console.error('No products found in database');
      return new Response(JSON.stringify({ error: 'No products available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context for AI
    const productContext = buildProductContext(products, aliases, dictionary);
    const conversation = buildConversationContext(conversationHistory, message_text);
    
    // Add customer context to system prompt
    const isNewCustomer = !customer_id;
    const customerContext = `
## CURRENT CUSTOMER CONTEXT
- Name: ${customer_name || 'Unknown (new customer)'}
- Phone: ${customer_phone}
- Is new customer: ${isNewCustomer}
- Has active order: ${recentOrder ? `Yes - ${recentOrder.order_number} (${recentOrder.status})` : 'No'}
- Preferred language: ${preferred_language || 'Not set'}`;
    
    const fullSystemPrompt = DRE_SYSTEM_PROMPT + customerContext;
    
    // Call Lovable AI for natural conversation processing
    console.log('Calling Lovable AI...');
    let aiResponse;
    try {
      aiResponse = await callLovableAI(fullSystemPrompt, conversation, productContext);
    } catch (error) {
      console.error('AI call failed:', error);
      // Fallback response
      const fallbackMsg = preferred_language === 'en' 
        ? "Sorry, I'm having a moment! 🙈 Please try again or say 'hello' to start fresh."
        : "Sorry, mi tin un problemita! 🙈 Purba atrobe òf bisa 'hola' pa kuminsá di nobo.";
      await sendWhatsAppMessage(customer_phone, fallbackMsg);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'AI processing failed',
        fallback_sent: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));
    
    const { 
      response: responseMessage, 
      intent, 
      parsed_items, 
      detected_language, 
      customer_mood,
      needs_escalation, 
      escalation_type, 
      escalation_reason 
    } = aiResponse;

    // === DRE SYNC HELPER — runs for ALL code paths ===
    async function syncToDre(dreReplyText: string, dreIntent: string, orderId?: string) {
      const externalChatId = customer_phone?.replace(/\D/g, '') || customer_phone || 'unknown';
      // Map short language codes to full names for dre_conversations check constraint
      const langMap: Record<string, string> = { pap: 'papiamentu', en: 'english', nl: 'dutch', es: 'spanish' };
      const dreLang = langMap[detected_language] || (
        ['papiamentu','english','dutch','spanish'].includes(detected_language) ? detected_language : null
      );
      console.log('DRE sync: starting for chat', externalChatId, 'lang:', detected_language, '→', dreLang);
      
      // Find or create dre_conversations
      let { data: dreConvo, error: findError } = await supabase
        .from('dre_conversations')
        .select('id')
        .eq('external_chat_id', externalChatId)
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error('DRE sync: find conversation error:', JSON.stringify(findError));
      }

      if (!dreConvo) {
        console.log('DRE sync: creating new conversation');
        const controlStatus = needs_escalation ? 'escalated' : 'dre_active';
        const { data: newDreConvo, error: insertError } = await supabase.from('dre_conversations').insert({
          channel: 'whatsapp',
          external_chat_id: externalChatId,
          control_status: controlStatus,
          customer_id: customer_id || null,
          language_detected: dreLang,
        }).select().single();
        
        if (insertError) {
          console.error('DRE sync: insert conversation error:', JSON.stringify(insertError));
          return;
        }
        dreConvo = newDreConvo;
        console.log('DRE sync: created conversation', dreConvo?.id);
      }

      if (!dreConvo) {
        console.error('DRE sync: no conversation available after find/create');
        return;
      }

      // Store customer inbound message
      const { error: inboundErr } = await supabase.from('dre_messages').insert({
        conversation_id: dreConvo.id,
        role: 'customer',
        content: message_text,
        media_type: 'text',
        language_detected: detected_language,
      });
      if (inboundErr) console.error('DRE sync: inbound message error:', JSON.stringify(inboundErr));

      // Store Dre's reply
      const { error: outboundErr } = await supabase.from('dre_messages').insert({
        conversation_id: dreConvo.id,
        role: 'dre',
        content: dreReplyText,
        media_type: 'text',
        language_detected: detected_language,
      });
      if (outboundErr) console.error('DRE sync: outbound message error:', JSON.stringify(outboundErr));

      // Update conversation metadata
      const updateData: any = {
        language_detected: detected_language,
        updated_at: new Date().toISOString(),
      };
      if (orderId) updateData.order_id = orderId;
      if (needs_escalation) updateData.control_status = 'escalated';

      const { error: updateErr } = await supabase.from('dre_conversations')
        .update(updateData)
        .eq('id', dreConvo.id);
      if (updateErr) console.error('DRE sync: update error:', JSON.stringify(updateErr));
      
      console.log('DRE sync: completed for conversation', dreConvo.id);
    }

    // Handle escalations first
    if (needs_escalation) {
      console.log(`Escalation needed: ${escalation_type} - ${escalation_reason}`);
      
      // Determine team role
      const teamRole = escalation_type === 'complaint' ? 'management' : 
                       escalation_type === 'human_request' ? 'management' : 
                       'logistics';
      
      const teamMember = await getTeamMemberByRole(supabase, teamRole);
      
      // Send customer response
      await sendWhatsAppMessage(customer_phone, responseMessage);
      
      // Notify team if available
      if (teamMember) {
        const teamNotification = `🔔 *${escalation_type?.toUpperCase()}*
Customer: ${customer_name || customer_phone}
Phone: ${customer_phone}
Mood: ${customer_mood}

*Message:*
"${message_text}"

*Reason:*
${escalation_reason}

*Order:* ${recentOrder?.order_number || 'No active order'}`;
        
        await sendWhatsAppMessage(teamMember.phone, teamNotification);
        
        // Log team notification
        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: teamMember.phone,
          message_text: teamNotification,
          customer_id: null,
          status: 'sent'
        });
      }
      
      // Create in-app notification
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'management']);
      
      if (admins && admins.length > 0) {
        const notifications = (admins as Array<{ user_id: string }>).map(admin => ({
          user_id: admin.user_id,
          type: escalation_type || 'escalation',
          title: `${escalation_type === 'complaint' ? '⚠️ Complaint' : '👤 Human Request'}: ${customer_name || customer_phone}`,
          message: `${message_text.substring(0, 150)}... | Mood: ${customer_mood}`,
          is_read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }
      
      // Log messages
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_text: responseMessage,
        customer_id: customer_id || null,
        status: 'sent'
      });
      
      await supabase.from('distribution_conversations').insert({
        customer_id: customer_id || null,
        direction: 'outbound',
        message_text: responseMessage,
        detected_language: detected_language,
        parsed_intent: escalation_type || 'escalation'
      });
      
      // Sync to DRE tables before returning
      await syncToDre(responseMessage, 'escalation');
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'escalation',
        escalation_type,
        escalation_reason,
        customer_mood,
        notified_team: !!teamMember
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle order confirmation
    if (intent === 'confirmation') {
      console.log('Processing order confirmation');
      
      // Get recent parsed items from conversations
      const { data: recentConvo } = await supabase
        .from('distribution_conversations')
        .select('parsed_items, parsed_intent')
        .or(customer_id ? `customer_id.eq.${customer_id}` : `message_text.ilike.%${customer_phone}%`)
        .eq('direction', 'outbound')
        .in('parsed_intent', ['order_recap', 'addition_recap'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      const previousItems = recentConvo?.[0]?.parsed_items as Array<{ product_id: string; product_name: string; quantity: number; unit?: string; unit_price: number }> | undefined;
      
      if (previousItems && previousItems.length > 0) {
        // Create order
        const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = previousItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        // Build conversation snapshot
        const snapshot = conversationHistory.slice(-10).map(m => 
          `[${new Date(m.created_at).toLocaleTimeString()}] ${m.direction === 'inbound' ? '👤' : '🤖'}: ${m.message_text}`
        ).join('\n');
        
        // Check if customer requested specific delivery time
        const deliveryTimeMatch = message_text.match(/(?:before|by|at|around|voor|om)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|u|uur)?)/i);
        const requestedDeliveryTime = deliveryTimeMatch ? deliveryTimeMatch[0] : null;
        
        const { data: order, error: orderError } = await supabase
          .from('distribution_orders')
          .insert({
            order_number: orderNumber,
            customer_id: customer_id || null,
            customer_phone: customer_phone,
            status: 'pending',
            source: 'whatsapp',
            total_xcg: totalAmount,
            source_conversation: snapshot,
            requested_delivery_time: requestedDeliveryTime,
            has_special_requirements: !!requestedDeliveryTime,
            notes: isNewCustomer ? `New WhatsApp customer - needs assignment. Phone: ${customer_phone}` : null
          })
          .select()
          .single();
        
        if (!orderError && order) {
          // Create order items
          const orderItems = previousItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            order_unit: item.unit || null,
            unit_price_xcg: item.unit_price,
            total_xcg: item.quantity * item.unit_price
          }));
          
          await supabase.from('distribution_order_items').insert(orderItems);
          
          console.log('Order created:', order.id);
          
          // NOTIFY TEAM MEMBERS IMMEDIATELY
          try {
            console.log('Notifying team about new order...');
            await supabase.functions.invoke('notify-team-order', {
              body: {
                order_id: order.id,
                order_number: orderNumber,
                customer_name: customer_name || null,
                customer_phone: customer_phone,
                total_xcg: totalAmount,
                items: previousItems.map(item => ({
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price_xcg: item.unit_price
                })),
                requested_delivery_time: requestedDeliveryTime,
                has_special_requirements: !!requestedDeliveryTime,
                notification_type: 'new_order'
              }
            });
            console.log('Team notification sent');
          } catch (notifyError) {
            console.error('Failed to notify team:', notifyError);
          }
          
          // Send confirmation
          await sendWhatsAppMessage(customer_phone, responseMessage);
          
          // Log messages
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: responseMessage,
            customer_id: customer_id || null,
            status: 'sent'
          });
          
          await supabase.from('distribution_conversations').insert({
            customer_id: customer_id || null,
            direction: 'outbound',
            message_text: responseMessage,
            detected_language: detected_language,
            parsed_intent: 'order_confirmed',
            order_id: order.id
          });
          
          // Clear any pending sessions
          await supabase
            .from('distribution_order_sessions')
            .update({ status: 'confirmed' })
            .eq('customer_phone', customer_phone)
            .eq('status', 'pending_confirmation');
          
          // Sync to DRE tables before returning
          await syncToDre(responseMessage, 'order_confirmed', order.id);
          
          return new Response(JSON.stringify({ 
            success: true, 
            action: 'order_confirmed',
            order_id: order.id,
            order_number: orderNumber,
            total: totalAmount,
            is_new_customer: isNewCustomer,
            requested_delivery_time: requestedDeliveryTime,
            team_notified: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Handle order intent - match products and create recap
    if (intent === 'order' && Array.isArray(parsed_items) && parsed_items.length > 0) {
      console.log('Processing order with', parsed_items.length, 'items');
      
      // Match products from AI parsed items
      const { matched, unmatched } = await matchProducts(
        supabase,
        parsed_items as Array<{ product: string; quantity: number; unit?: string }>,
        products,
        aliases,
        customer_id,
        detected_language
      );
      
      if (matched.length > 0) {
        // Store parsed items for confirmation
        await supabase.from('distribution_conversations').insert({
          customer_id: customer_id || null,
          direction: 'outbound',
          message_text: responseMessage,
          detected_language: detected_language,
          parsed_intent: 'order_recap',
          parsed_items: matched
        });
        
        // Create/update order session for reminders
        const conversationSnapshot = conversationHistory.slice(-10).map(m => ({
          direction: m.direction,
          message_text: m.message_text,
          created_at: m.created_at
        }));
        
        await supabase
          .from('distribution_order_sessions')
          .upsert({
            customer_id: customer_id || null,
            customer_phone: customer_phone,
            customer_name: customer_name || null,
            parsed_items: matched,
            detected_language: detected_language,
            conversation_snapshot: conversationSnapshot,
            status: 'pending_confirmation',
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'customer_phone',
            ignoreDuplicates: false
          });
      }
    }

    // Send the AI's response
    await sendWhatsAppMessage(customer_phone, responseMessage);
    
    // Log outbound message
    await supabase.from('whatsapp_messages').insert({
      direction: 'outbound',
      phone_number: customer_phone,
      message_text: responseMessage,
      customer_id: customer_id || null,
      status: 'sent'
    });
    
    // Store conversation
    await supabase.from('distribution_conversations').insert({
      customer_id: customer_id || null,
      direction: 'outbound',
      message_text: responseMessage,
      detected_language: detected_language,
      parsed_intent: intent
    });

    // Sync to DRE tables
    await syncToDre(responseMessage, intent);

    return new Response(JSON.stringify({ 
      success: true, 
      action: intent,
      detected_language,
      customer_mood,
      parsed_items_count: Array.isArray(parsed_items) ? parsed_items.length : 0,
      is_new_customer: isNewCustomer
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('DRE AI Agent error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
