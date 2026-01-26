import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

// Language-specific response templates
const RESPONSE_TEMPLATES = {
  order_confirmed: {
    pap: (name: string, items: string) => `Bon dia ${name}! ✅\n\nMi a risibi bo order:\n${items}\n\nDanki pa bo preferensia! Nos ta entrega pronto.`,
    en: (name: string, items: string) => `Good day ${name}! ✅\n\nI received your order:\n${items}\n\nThank you for your business! We'll deliver soon.`,
    nl: (name: string, items: string) => `Goedendag ${name}! ✅\n\nIk heb uw bestelling ontvangen:\n${items}\n\nBedankt voor uw bestelling! We leveren snel.`,
    es: (name: string, items: string) => `Buen día ${name}! ✅\n\nRecibí tu pedido:\n${items}\n\nGracias por tu preferencia! Entregaremos pronto.`,
    mixed: (name: string, items: string) => `Hello ${name}! ✅\n\nOrder received:\n${items}\n\nThank you! We'll deliver soon.`
  },
  clarification_needed: {
    pap: (name: string, unclear: string) => `Bon dia ${name}! 🤔\n\nMi no ta segur tocante: "${unclear}"\n\nPor fabor, splika un poco mas?`,
    en: (name: string, unclear: string) => `Hi ${name}! 🤔\n\nI'm not sure about: "${unclear}"\n\nCould you please clarify?`,
    nl: (name: string, unclear: string) => `Hallo ${name}! 🤔\n\nIk weet niet zeker wat u bedoelt met: "${unclear}"\n\nKunt u dit verduidelijken?`,
    es: (name: string, unclear: string) => `Hola ${name}! 🤔\n\nNo estoy seguro sobre: "${unclear}"\n\n¿Podrías aclarar?`,
    mixed: (name: string, unclear: string) => `Hi ${name}! 🤔\n\nI'm not sure about: "${unclear}"\n\nCould you please clarify?`
  },
  suggestion: {
    pap: (name: string, products: string) => `Bon dia ${name}! 💡\n\nSegun bo orders anterior, kizas bo ke:\n${products}\n\nBisa si bo ke agrega algo!`,
    en: (name: string, products: string) => `Hi ${name}! 💡\n\nBased on your previous orders, would you like:\n${products}\n\nLet me know if you'd like to add anything!`,
    nl: (name: string, products: string) => `Hallo ${name}! 💡\n\nOp basis van uw eerdere bestellingen, wilt u misschien:\n${products}\n\nLaat me weten als u iets wilt toevoegen!`,
    es: (name: string, products: string) => `Hola ${name}! 💡\n\nBasado en tus pedidos anteriores, ¿quieres:\n${products}\n\nDime si quieres agregar algo!`,
    mixed: (name: string, products: string) => `Hi ${name}! 💡\n\nBased on your orders, would you like:\n${products}\n\nLet me know!`
  },
  greeting: {
    pap: (name: string) => `Bon dia ${name}! 👋\n\nKon mi por yuda bo awe? Bo por manda bo order of puntra mi tocante nos produktonan.`,
    en: (name: string) => `Good day ${name}! 👋\n\nHow can I help you today? You can send your order or ask me about our products.`,
    nl: (name: string) => `Goedendag ${name}! 👋\n\nHoe kan ik u helpen? U kunt uw bestelling sturen of vragen over onze producten.`,
    es: (name: string) => `Buen día ${name}! 👋\n\nCómo puedo ayudarte hoy? Puedes enviar tu pedido o preguntarme sobre nuestros productos.`,
    mixed: (name: string) => `Hello ${name}! 👋\n\nHow can I help you today? You can send your order or ask about our products.`
  },
  ask_business_name: {
    pap: () => `Bon dia! 👋\n\nMi no tin bo negoshi registra ainda. Por fabor, bisa mi: Ki nomber di bo negoshi ta?`,
    en: () => `Hello! 👋\n\nI don't have your business registered yet. Please tell me: What is your business name?`,
    nl: () => `Hallo! 👋\n\nIk heb uw bedrijf nog niet geregistreerd. Vertel me alstublieft: Wat is uw bedrijfsnaam?`,
    es: () => `Hola! 👋\n\nNo tengo tu negocio registrado aún. Por favor dime: ¿Cuál es el nombre de tu negocio?`,
    mixed: () => `Hello! 👋\n\nI don't have your business registered yet. Please tell me: What is your business name?`
  }
};

// Simple language detection based on common words
function detectLanguageSimple(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Papiamento indicators
  if (/\b(bon dia|bon tardi|bon nochi|danki|por fabor|mi ta|mi ke|bo tin|esaki|negoshi)\b/.test(lowerText)) {
    return 'pap';
  }
  // Dutch indicators
  if (/\b(bedankt|alstublieft|goedemorgen|goedendag|bedrijf|hallo)\b/.test(lowerText)) {
    return 'nl';
  }
  // Spanish indicators
  if (/\b(gracias|por favor|buenos días|hola|negocio|quiero)\b/.test(lowerText)) {
    return 'es';
  }
  // Default to English
  return 'en';
}

// Get confirmation message when matching existing customer
function getBusinessNameConfirmation(lang: string, customerName: string): string {
  const messages: Record<string, string> = {
    pap: `Perfecto! 🎉\n\nMi a haña bo: ${customerName}\n\nBon bini bek! Ki bo ke pidi awe?`,
    en: `Perfect! 🎉\n\nI found you: ${customerName}\n\nWelcome back! What would you like to order today?`,
    nl: `Perfect! 🎉\n\nIk heb u gevonden: ${customerName}\n\nWelkom terug! Wat wilt u vandaag bestellen?`,
    es: `Perfecto! 🎉\n\nTe encontré: ${customerName}\n\n¡Bienvenido de vuelta! ¿Qué deseas pedir hoy?`
  };
  return messages[lang] || messages.en;
}

// Get welcome message for new customers
function getNewCustomerWelcome(lang: string, businessName: string): string {
  const messages: Record<string, string> = {
    pap: `Bon bini ${businessName}! 🎉\n\nMi a registra bo negoshi. Awo bo por manda bo order. Ki bo ke pidi?`,
    en: `Welcome ${businessName}! 🎉\n\nI've registered your business. You can now place orders. What would you like?`,
    nl: `Welkom ${businessName}! 🎉\n\nIk heb uw bedrijf geregistreerd. U kunt nu bestellingen plaatsen. Wat wilt u bestellen?`,
    es: `¡Bienvenido ${businessName}! 🎉\n\nHe registrado tu negocio. Ahora puedes hacer pedidos. ¿Qué deseas?`
  };
  return messages[lang] || messages.en;
}

// Send WhatsApp message via Meta API
async function sendWhatsAppMessage(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'Failed to send message' };
    }

    const messageId = data.messages?.[0]?.id;
    console.log(`WhatsApp message sent successfully: ${messageId}`);
    return { success: true, messageId };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get response template based on language
function getTemplate(type: keyof typeof RESPONSE_TEMPLATES, lang: string): Function {
  const templates = RESPONSE_TEMPLATES[type];
  return templates[lang as keyof typeof templates] || templates.mixed;
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
      message_id,
      preferred_language,
      awaiting_business_name
    } = await req.json();

    if (!customer_phone || !message_text) {
      return new Response(
        JSON.stringify({ error: 'customer_phone and message_text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // HANDLE UNKNOWN CUSTOMER: If no customer_id and we're awaiting business name
    if (!customer_id && awaiting_business_name) {
      // The user is responding with their business name
      const businessName = message_text.trim();
      
      // Try to find existing customer by name (fuzzy match)
      const { data: existingCustomers } = await supabase
        .from('distribution_customers')
        .select('id, name, whatsapp_phone')
        .ilike('name', `%${businessName}%`)
        .limit(5);
      
      let matchedCustomer = null;
      let responseText = '';
      const detectedLang = detectLanguageSimple(businessName);
      
      if (existingCustomers && existingCustomers.length > 0) {
        // Found potential matches - use the best one and update their phone
        matchedCustomer = existingCustomers[0];
        
        // Update the customer's phone number
        await supabase
          .from('distribution_customers')
          .update({ whatsapp_phone: customer_phone })
          .eq('id', matchedCustomer.id);
        
        responseText = getBusinessNameConfirmation(detectedLang, matchedCustomer.name);
        console.log(`Matched existing customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('distribution_customers')
          .insert({
            name: businessName,
            whatsapp_phone: customer_phone,
          })
          .select('id, name')
          .single();
        
        if (!createError && newCustomer) {
          matchedCustomer = newCustomer;
          responseText = getNewCustomerWelcome(detectedLang, businessName);
          console.log(`Created new customer: ${businessName} (${newCustomer.id})`);
        } else {
          console.error('Error creating customer:', createError);
          responseText = 'Sorry, there was an issue registering your business. Please try again.';
        }
      }
      
      // Send response
      const sendResult = await sendWhatsAppMessage(customer_phone, responseText);
      
      return new Response(
        JSON.stringify({
          success: true,
          detected_language: detectedLang,
          intent: 'business_name_provided',
          response_sent: sendResult.success,
          response_text: responseText,
          customer_created: !!matchedCustomer,
          customer_id: matchedCustomer?.id,
          customer_name: matchedCustomer?.name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // HANDLE UNKNOWN CUSTOMER: First contact - ask for business name
    if (!customer_id) {
      const detectedLang = detectLanguageSimple(message_text);
      const askTemplate = RESPONSE_TEMPLATES.ask_business_name[detectedLang as keyof typeof RESPONSE_TEMPLATES.ask_business_name] 
        || RESPONSE_TEMPLATES.ask_business_name.mixed;
      const responseText = askTemplate();
      
      // Send the "what is your business name" message
      const sendResult = await sendWhatsAppMessage(customer_phone, responseText);
      
      console.log(`Asked for business name from unknown phone: ${customer_phone}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          detected_language: detectedLang,
          intent: 'ask_business_name',
          response_sent: sendResult.success,
          response_text: responseText,
          awaiting_business_name: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch products for AI context
    const { data: products } = await supabase
      .from('distribution_products')
      .select('id, code, name, name_pap, name_nl, name_es, unit, price_xcg')
      .eq('is_active', true)
      .limit(200);

    // Fetch customer patterns for personalized suggestions
    const { data: patterns } = customer_id ? await supabase
      .from('distribution_customer_patterns')
      .select(`
        product_id,
        avg_quantity,
        order_count,
        distribution_products (code, name)
      `)
      .eq('customer_id', customer_id)
      .order('order_count', { ascending: false })
      .limit(10) : { data: null };

    // Fetch customer mappings (custom product names)
    const { data: mappings } = customer_id ? await supabase
      .from('distribution_customer_product_mappings')
      .select(`
        customer_product_name,
        customer_sku,
        distribution_products (code, name)
      `)
      .eq('customer_id', customer_id)
      .eq('is_verified', true)
      .limit(20) : { data: null };

    // Fetch recent conversation history for context
    const { data: recentMessages } = customer_id ? await supabase
      .from('whatsapp_messages')
      .select('message_text, direction, created_at, parsed_items')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(10) : { data: null };
    
    // Check for pending order items from previous messages (for confirmations)
    const pendingOrderItems = recentMessages?.find(m => 
      m.direction === 'outbound' && m.parsed_items
    )?.parsed_items;

    // Build product context
    const productList = products?.map(p => 
      `${p.code}: ${p.name}${p.name_pap ? ` (${p.name_pap})` : ''} - ${p.unit || 'unit'} @ ${p.price_xcg || 0} XCG`
    ).join('\n') || 'No products available';

    // Build pattern context
    const frequentItems = patterns?.map((p: any) => 
      `${p.distribution_products?.name} (~${Math.round(p.avg_quantity)} ${p.distribution_products?.code})`
    ).join(', ') || '';

    // Build mapping context  
    const customNames = mappings?.map((m: any) => 
      `"${m.customer_product_name}" = ${m.distribution_products?.name}`
    ).join(', ') || '';

    // Build conversation context
    const conversationHistory = recentMessages?.reverse().map(m => 
      `${m.direction === 'inbound' ? 'Customer' : 'AI'}: ${m.message_text}`
    ).join('\n') || '';

    // System prompt for the AI agent
    const systemPrompt = `You are a friendly WhatsApp order assistant for a produce distribution company in Curaçao.

LANGUAGE DETECTION:
- Detect the customer's language from their message
- ALWAYS respond in the SAME language they used
- Common languages: Papiamentu (pap), English (en), Dutch (nl), Spanish (es)
- Papiamentu greetings: "bon dia", "bon tardi", "bon nochi", "kon ta bai"

CUSTOMER CONTEXT:
- Name: ${customer_name || 'Customer'}
- Preferred language: ${preferred_language || 'unknown'}
${frequentItems ? `- Frequently ordered: ${frequentItems}` : ''}
${customNames ? `- Custom product names: ${customNames}` : ''}

AVAILABLE PRODUCTS:
${productList}

RECENT CONVERSATION:
${conversationHistory}

YOUR TASKS:
1. Parse order items from natural language (handle typos, slang, abbreviations)
2. Suggest products based on customer's ordering patterns
3. Confirm orders clearly with quantities and prices
4. Ask for clarification when unsure (be specific about what's unclear)
5. Handle greetings, questions about products, delivery times, etc.
6. Be warm, friendly, and professional

RESPONSE FORMAT:
Keep responses concise and mobile-friendly (short paragraphs, use emojis sparingly).
Always confirm understanding of orders before final confirmation.`;

    // AI request
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message_text }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "process_message",
              description: "Process the customer's WhatsApp message and determine the appropriate response",
              parameters: {
                type: "object",
                properties: {
                  detected_language: {
                    type: "string",
                    enum: ["pap", "en", "nl", "es", "mixed"],
                    description: "The language detected in the customer's message"
                  },
                  intent: {
                    type: "string",
                    enum: ["order", "greeting", "question", "confirmation", "modification", "cancellation", "unclear"],
                    description: "The customer's primary intent"
                  },
                  response_text: {
                    type: "string",
                    description: "The response to send to the customer in their detected language"
                  },
                  order_items: {
                    type: "array",
                    description: "Extracted order items (if intent is 'order')",
                    items: {
                      type: "object",
                      properties: {
                        product_code: { type: "string" },
                        product_name: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                        raw_text: { type: "string" }
                      },
                      required: ["product_name", "quantity", "unit", "confidence", "raw_text"]
                    }
                  },
                  suggestions: {
                    type: "array",
                    description: "Product suggestions based on customer patterns",
                    items: {
                      type: "object",
                      properties: {
                        product_code: { type: "string" },
                        product_name: { type: "string" },
                        typical_quantity: { type: "number" }
                      }
                    }
                  },
                  needs_clarification: {
                    type: "boolean",
                    description: "Whether clarification is needed from the customer"
                  },
                  unclear_items: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of items or phrases that need clarification"
                  },
                  create_order: {
                    type: "boolean",
                    description: "Whether to create a draft order from high-confidence items"
                  }
                },
                required: ["detected_language", "intent", "response_text"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "process_message" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits required. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in AI response');
      return new Response(
        JSON.stringify({ error: 'AI response format error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('AI processed message:', JSON.stringify(result));

    // Update customer's preferred language if detected
    if (customer_id && result.detected_language && result.detected_language !== 'mixed') {
      await supabase
        .from('distribution_customers')
        .update({ preferred_language: result.detected_language })
        .eq('id', customer_id);
    }

    // Create order when:
    // 1. AI says create_order=true, OR
    // 2. Intent is "confirmation" and we have order items from AI response or recent conversation
    let orderId = null;
    const shouldCreateOrder = customer_id && (
      (result.create_order && result.order_items?.length > 0) ||
      (result.intent === 'confirmation' && result.order_items?.length > 0)
    );

    if (shouldCreateOrder) {
      const itemsToProcess = result.order_items || [];
      
      if (itemsToProcess.length > 0) {
        // Fuzzy match products by name (not just code)
        const matchedItems: Array<{product_id: string, quantity: number, price: number, name: string}> = [];
        
        for (const item of itemsToProcess) {
          const searchName = (item.product_name || '').toLowerCase().trim();
          const searchCode = (item.product_code || '').toLowerCase().trim();
          
          // Find product by code, name, or fuzzy match
          let matchedProduct = products?.find(p => 
            p.code?.toLowerCase() === searchCode ||
            p.name?.toLowerCase() === searchName ||
            p.name_pap?.toLowerCase() === searchName ||
            p.name_nl?.toLowerCase() === searchName ||
            p.name_es?.toLowerCase() === searchName ||
            p.name?.toLowerCase().includes(searchName) ||
            searchName.includes(p.name?.toLowerCase() || '')
          );
          
          // If still no match, try partial matching
          if (!matchedProduct && searchName.length >= 3) {
            matchedProduct = products?.find(p => 
              p.name?.toLowerCase().includes(searchName.substring(0, 4)) ||
              p.code?.toLowerCase().includes(searchName.substring(0, 4))
            );
          }
          
          if (matchedProduct) {
            matchedItems.push({
              product_id: matchedProduct.id,
              quantity: item.quantity || 1,
              price: matchedProduct.price_xcg || 0,
              name: matchedProduct.name
            });
          } else {
            console.log(`Could not match product: "${searchName}"`);
          }
        }

        if (matchedItems.length > 0) {
          // Generate order number
          const orderNumber = `WA-${Date.now()}`;
          
          // Create order
          const { data: order, error: orderError } = await supabase
            .from('distribution_orders')
            .insert({
              customer_id,
              order_number: orderNumber,
              status: 'pending',
              language_used: result.detected_language,
              notes: `WhatsApp order. Original: "${message_text}"`,
              total_xcg: 0,
              order_date: new Date().toISOString().split('T')[0],
              delivery_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

          if (!orderError && order) {
            orderId = order.id;

            // Create order items
            const orderItems = matchedItems.map(item => ({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price_xcg: item.price,
              total_xcg: item.price * item.quantity
            }));

            const { error: itemsError } = await supabase
              .from('distribution_order_items')
              .insert(orderItems);

            if (!itemsError) {
              // Update order total
              const total = orderItems.reduce((sum, item) => sum + item.total_xcg, 0);
              await supabase
                .from('distribution_orders')
                .update({ total_xcg: total })
                .eq('id', order.id);

              console.log(`✅ Created order ${orderNumber} with ${orderItems.length} items, total: ${total} XCG`);
            } else {
              console.error('Failed to create order items:', itemsError);
            }
          } else {
            console.error('Failed to create order:', orderError);
          }
        } else {
          console.log('No products could be matched from order items');
        }
      }
    }

    // Log AI match results for training
    if (result.order_items?.length > 0 && customer_id) {
      for (const item of result.order_items) {
        await supabase.from('distribution_ai_match_logs').insert({
          customer_id,
          order_id: orderId,
          raw_text: item.raw_text,
          interpreted_text: item.product_name,
          matched_product_id: item.product_code ? 
            products?.find(p => p.code === item.product_code)?.id : null,
          detected_quantity: item.quantity,
          detected_unit: item.unit,
          confidence: item.confidence,
          detected_language: result.detected_language,
          needs_review: item.confidence !== 'high',
          match_source: 'ai_agent'
        });
      }
    }

    // Send WhatsApp reply
    const sendResult = await sendWhatsAppMessage(customer_phone, result.response_text);

    // Store outbound message
    if (sendResult.success) {
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_id: sendResult.messageId,
        message_text: result.response_text,
        customer_id: customer_id || null,
        status: 'sent'
      });
    }

    // Store conversation record
    await supabase.from('distribution_conversations').insert({
      customer_id: customer_id || null,
      message_id,
      direction: 'inbound',
      message_text,
      detected_language: result.detected_language,
      parsed_intent: result.intent,
      parsed_items: result.order_items || null,
      order_id: orderId
    });

    return new Response(
      JSON.stringify({
        success: true,
        detected_language: result.detected_language,
        intent: result.intent,
        response_sent: sendResult.success,
        response_text: result.response_text,
        order_created: !!orderId,
        order_id: orderId,
        items_parsed: result.order_items?.length || 0,
        needs_clarification: result.needs_clarification,
        suggestions: result.suggestions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WhatsApp AI agent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
