import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-language response templates
const RESPONSE_TEMPLATES = {
  welcome_new: {
    pap: "Bon bini na FUIK! 🐟 Mi ta e asistente di bestellings. Ki kos bo ke pidi awe?",
    en: "Welcome to FUIK! 🐟 I'm the order assistant. What would you like to order today?",
    nl: "Welkom bij FUIK! 🐟 Ik ben de bestelassistent. Wat wilt u vandaag bestellen?",
    es: "¡Bienvenido a FUIK! 🐟 Soy el asistente de pedidos. ¿Qué te gustaría pedir hoy?"
  },
  order_recap: {
    pap: "📋 Bo orden:\n{items}\n\n💰 Total: {total} XCG\n\nTur kos ta bon? Bisa 'Si' pa konfirmá.",
    en: "📋 Your order:\n{items}\n\n💰 Total: {total} XCG\n\nEverything correct? Say 'Yes' to confirm.",
    nl: "📋 Uw bestelling:\n{items}\n\n💰 Totaal: {total} XCG\n\nKlopt alles? Zeg 'Ja' om te bevestigen.",
    es: "📋 Tu pedido:\n{items}\n\n💰 Total: {total} XCG\n\n¿Todo correcto? Di 'Sí' para confirmar."
  },
  order_confirmed: {
    pap: "✅ Danki! Bo orden a wordo plasá. Nos lo entregá esaki pronto. 🚚",
    en: "✅ Thank you! Your order has been placed. We'll deliver it soon. 🚚",
    nl: "✅ Bedankt! Uw bestelling is geplaatst. We bezorgen het snel. 🚚",
    es: "✅ ¡Gracias! Tu pedido ha sido registrado. Lo entregaremos pronto. 🚚"
  },
  suggestions: {
    pap: "💡 Bo tabata order tambe: {products}. Bo ke agrega un di nan?",
    en: "💡 You've also ordered before: {products}. Would you like to add any?",
    nl: "💡 U heeft eerder ook besteld: {products}. Wilt u iets toevoegen?",
    es: "💡 También has pedido antes: {products}. ¿Te gustaría agregar alguno?"
  },
  no_match: {
    pap: "🤔 Mi no por haña e produkto '{item}'. Por fabor purba otro nomber òf mira nos lista di produktonan.",
    en: "🤔 I couldn't find the product '{item}'. Please try another name or check our product list.",
    nl: "🤔 Ik kon het product '{item}' niet vinden. Probeer een andere naam of bekijk onze productlijst.",
    es: "🤔 No pude encontrar el producto '{item}'. Por favor intenta con otro nombre o revisa nuestra lista de productos."
  },
  greeting_response: {
    pap: "Bon dia! 🐟 Ki kos bo ke pidi awe?",
    en: "Good day! 🐟 What would you like to order today?",
    nl: "Goedendag! 🐟 Wat wilt u vandaag bestellen?",
    es: "¡Buen día! 🐟 ¿Qué te gustaría pedir hoy?"
  }
};

// Language detection patterns
const LANGUAGE_PATTERNS = {
  pap: ['bon', 'dia', 'tardi', 'nochi', 'danki', 'por', 'fabor', 'mi', 'ke', 'pidi', 'awe', 'kico', 'tur', 'si', 'no', 'mas', 'awa', 'piska', 'karni', 'e', 'ta', 'un', 'dos', 'tres'],
  nl: ['goedemorgen', 'goedemiddag', 'goedenavond', 'bedankt', 'alstublieft', 'graag', 'bestellen', 'wil', 'hebben', 'ja', 'nee', 'meer', 'water', 'vis', 'vlees', 'de', 'het', 'een', 'twee', 'drie'],
  es: ['buenos', 'dias', 'tardes', 'noches', 'gracias', 'favor', 'quiero', 'pedir', 'hoy', 'sí', 'no', 'más', 'agua', 'pescado', 'carne', 'el', 'la', 'uno', 'dos', 'tres'],
  en: ['good', 'morning', 'afternoon', 'evening', 'thanks', 'please', 'want', 'order', 'today', 'yes', 'no', 'more', 'water', 'fish', 'meat', 'the', 'a', 'one', 'two', 'three']
};

// Detect language from text
function detectLanguage(text: string, customerPreference?: string | null): string {
  if (customerPreference && ['pap', 'en', 'nl', 'es'].includes(customerPreference)) {
    return customerPreference;
  }
  
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = { pap: 0, nl: 0, es: 0, en: 0 };
  
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        scores[lang]++;
      }
    }
  }
  
  // Boost Papiamento as it's most common in Curaçao
  scores.pap *= 1.2;
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'pap'; // Default to Papiamento
  
  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || 'pap';
}

// Detect intent from message
function detectIntent(text: string): { intent: string; isConfirmation: boolean; isGreeting: boolean } {
  const lowerText = text.toLowerCase().trim();
  
  // Check for confirmation
  const confirmPatterns = ['si', 'sí', 'yes', 'ja', 'ok', 'okay', 'confirma', 'confirm', 'bevestig', 'ta bon', 'correcto', 'correct'];
  const isConfirmation = confirmPatterns.some(p => lowerText === p || lowerText.startsWith(p + ' ') || lowerText.endsWith(' ' + p));
  
  // Check for greeting
  const greetingPatterns = ['bon dia', 'bon tardi', 'bon nochi', 'hola', 'hello', 'hi', 'hallo', 'buenos', 'good morning', 'good afternoon', 'goedemorgen', 'goedemiddag'];
  const isGreeting = greetingPatterns.some(p => lowerText.includes(p));
  
  // Determine primary intent
  let intent = 'order';
  if (isConfirmation) intent = 'confirm';
  else if (isGreeting && lowerText.length < 30) intent = 'greeting';
  
  return { intent, isConfirmation, isGreeting };
}

// Parse order items from text
function parseOrderItems(text: string): Array<{ rawText: string; quantity: number; unit?: string }> {
  const items: Array<{ rawText: string; quantity: number; unit?: string }> = [];
  
  // Split by common delimiters
  const lines = text.split(/[,\n;]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Match patterns like "5 salmon", "10x tuna", "2 kg shrimp", "salmon 3"
    const patterns = [
      /^(\d+)\s*[xX]?\s*(.+)$/,           // "5 salmon" or "5x salmon"
      /^(.+?)\s+(\d+)\s*$/,                // "salmon 5"
      /^(\d+)\s*(kg|lb|pcs|box|case|caja|doos|stuk)?\s*(.+)$/i,  // "2 kg shrimp"
    ];
    
    let matched = false;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (pattern === patterns[0]) {
          items.push({ rawText: match[2].trim(), quantity: parseInt(match[1]) });
        } else if (pattern === patterns[1]) {
          items.push({ rawText: match[1].trim(), quantity: parseInt(match[2]) });
        } else {
          items.push({ 
            rawText: match[3]?.trim() || match[2]?.trim() || '', 
            quantity: parseInt(match[1]),
            unit: match[2]?.toLowerCase()
          });
        }
        matched = true;
        break;
      }
    }
    
    // If no quantity found, assume 1
    if (!matched && line.length > 1) {
      items.push({ rawText: line, quantity: 1 });
    }
  }
  
  return items;
}

// Fuzzy match product name
function fuzzyMatchProduct(
  searchText: string, 
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>
): { product: typeof products[0] | null; confidence: number } {
  const search = searchText.toLowerCase().trim();
  
  let bestMatch: typeof products[0] | null = null;
  let bestScore = 0;
  
  for (const product of products) {
    const names = [
      product.name?.toLowerCase() || '',
      product.name_pap?.toLowerCase() || '',
      product.name_nl?.toLowerCase() || '',
      product.name_es?.toLowerCase() || '',
      product.code?.toLowerCase() || ''
    ].filter(n => n.length > 0);
    
    for (const name of names) {
      let score = 0;
      
      // Exact match
      if (name === search) {
        score = 1;
      }
      // Contains full search term
      else if (name.includes(search)) {
        score = 0.9;
      }
      // Search contains product name
      else if (search.includes(name)) {
        score = 0.85;
      }
      // Word-level matching
      else {
        const searchWords = search.split(/\s+/);
        const nameWords = name.split(/\s+/);
        const matchedWords = searchWords.filter(sw => 
          nameWords.some(nw => nw.includes(sw) || sw.includes(nw))
        );
        score = matchedWords.length / Math.max(searchWords.length, nameWords.length) * 0.7;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
  }
  
  return { product: bestMatch, confidence: bestScore };
}

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
      preferred_language 
    } = await req.json();

    console.log('AI Agent processing:', { customer_id, customer_phone, message_text, preferred_language });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Detect language
    const language = detectLanguage(message_text, preferred_language);
    console.log('Detected language:', language);

    // Detect intent
    const { intent, isConfirmation, isGreeting } = detectIntent(message_text);
    console.log('Detected intent:', intent, { isConfirmation, isGreeting });

    // Get products for matching
    const { data: products } = await supabase
      .from('distribution_products')
      .select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit')
      .eq('is_active', true);

    if (!products || products.length === 0) {
      console.error('No products found in database');
      return new Response(JSON.stringify({ error: 'No products available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a NEW customer (no customer_id)
    const isNewCustomer = !customer_id;

    // Handle confirmation - create order from previous conversation
    if (isConfirmation) {
      console.log('Processing order confirmation');
      
      // Get recent conversation to find parsed items - filter by phone number
      const { data: recentMessages } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('phone_number', customer_phone)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Get conversations linked to this phone's messages
      const { data: recentConvo } = await supabase
        .from('distribution_conversations')
        .select('parsed_items')
        .eq('direction', 'outbound')
        .eq('parsed_intent', 'order_recap')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Find the most recent recap with parsed items
      let parsedItems: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }> = [];
      for (const convo of recentConvo || []) {
        if (convo.parsed_items && Array.isArray(convo.parsed_items) && convo.parsed_items.length > 0) {
          parsedItems = convo.parsed_items as Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }>;
          break;
        }
      }
      
      if (parsedItems.length > 0) {
        // Create the order
        const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = parsedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        const { data: order, error: orderError } = await supabase
          .from('distribution_orders')
          .insert({
            order_number: orderNumber,
            customer_id: customer_id || null, // null for new customers - manager assigns later
            customer_phone: customer_phone,
            status: 'pending',
            source: 'whatsapp',
            total_xcg: totalAmount,
            notes: isNewCustomer ? `New WhatsApp customer - needs customer assignment. Phone: ${customer_phone}` : null
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
        } else {
          console.log('Order created:', order.id);
          
          // Create order items
          const orderItems = parsedItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price_xcg: item.unit_price,
            total_xcg: item.quantity * item.unit_price
          }));
          
          const { error: itemsError } = await supabase
            .from('distribution_order_items')
            .insert(orderItems);
          
          if (itemsError) {
            console.error('Error creating order items:', itemsError);
          }
          
          // Send confirmation
          const confirmMsg = RESPONSE_TEMPLATES.order_confirmed[language as keyof typeof RESPONSE_TEMPLATES.order_confirmed];
          await sendWhatsAppMessage(customer_phone, confirmMsg);
          
          // Store outbound message
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: confirmMsg,
            customer_id: customer_id || null,
            status: 'sent'
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            action: 'order_confirmed',
            order_id: order.id,
            order_number: orderNumber,
            customer_id: customer_id || null,
            is_new_customer: isNewCustomer
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Handle greeting
    if (isGreeting && !message_text.match(/\d/)) {
      let response: string;
      
      if (isNewCustomer) {
        // Welcome new customer
        response = RESPONSE_TEMPLATES.welcome_new[language as keyof typeof RESPONSE_TEMPLATES.welcome_new];
      } else {
        response = RESPONSE_TEMPLATES.greeting_response[language as keyof typeof RESPONSE_TEMPLATES.greeting_response];
      }
      
      await sendWhatsAppMessage(customer_phone, response);
      
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_text: response,
        customer_id: customer_id || null,
        status: 'sent'
      });
      
      // Store conversation
      await supabase.from('distribution_conversations').insert({
        customer_id: customer_id || null,
        direction: 'outbound',
        message_text: response,
        detected_language: language,
        parsed_intent: 'greeting'
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'greeting',
        is_new_customer: isNewCustomer
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse order items
    const parsedItems = parseOrderItems(message_text);
    console.log('Parsed items:', parsedItems);

    if (parsedItems.length === 0) {
      // No items found, send welcome/help message
      let response: string;
      if (isNewCustomer) {
        response = RESPONSE_TEMPLATES.welcome_new[language as keyof typeof RESPONSE_TEMPLATES.welcome_new];
      } else {
        response = RESPONSE_TEMPLATES.greeting_response[language as keyof typeof RESPONSE_TEMPLATES.greeting_response];
      }
      
      await sendWhatsAppMessage(customer_phone, response);
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'help',
        is_new_customer: isNewCustomer
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Match products
    const matchedItems: Array<{ 
      product_id: string; 
      product_name: string; 
      quantity: number; 
      unit_price: number;
      confidence: number;
    }> = [];
    const unmatchedItems: string[] = [];

    for (const item of parsedItems) {
      const { product, confidence } = fuzzyMatchProduct(item.rawText, products);
      
      if (product && confidence >= 0.5) {
        matchedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price_xcg || 0,
          confidence
        });
        
        // Log AI match
        await supabase.from('distribution_ai_match_logs').insert({
          raw_text: item.rawText,
          matched_product_id: product.id,
          customer_id: customer_id || null,
          confidence: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low',
          detected_quantity: item.quantity,
          detected_language: language,
          needs_review: confidence < 0.7
        });
      } else {
        unmatchedItems.push(item.rawText);
      }
    }

    // Build response
    let responseMessage = '';
    
    if (matchedItems.length > 0) {
      // Build order recap
      const itemsList = matchedItems.map(item => 
        `• ${item.quantity}x ${item.product_name} - ${(item.quantity * item.unit_price).toFixed(2)} XCG`
      ).join('\n');
      
      const total = matchedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      responseMessage = RESPONSE_TEMPLATES.order_recap[language as keyof typeof RESPONSE_TEMPLATES.order_recap]
        .replace('{items}', itemsList)
        .replace('{total}', total.toFixed(2));
      
      // Add unmatched items warning
      if (unmatchedItems.length > 0) {
        const noMatchMsg = unmatchedItems.map(item => 
          RESPONSE_TEMPLATES.no_match[language as keyof typeof RESPONSE_TEMPLATES.no_match].replace('{item}', item)
        ).join('\n');
        responseMessage += '\n\n' + noMatchMsg;
      }
    } else {
      // No products matched
      responseMessage = unmatchedItems.map(item => 
        RESPONSE_TEMPLATES.no_match[language as keyof typeof RESPONSE_TEMPLATES.no_match].replace('{item}', item)
      ).join('\n');
    }

    // Send response
    await sendWhatsAppMessage(customer_phone, responseMessage);
    
    // Store outbound message with parsed items for later confirmation
    await supabase.from('whatsapp_messages').insert({
      direction: 'outbound',
      phone_number: customer_phone,
      message_text: responseMessage,
      customer_id: customer_id || null,
      status: 'sent'
    });
    
    // Store conversation with parsed items
    await supabase.from('distribution_conversations').insert({
      customer_id: customer_id || null,
      direction: 'outbound',
      message_text: responseMessage,
      detected_language: language,
      parsed_intent: 'order_recap',
      parsed_items: matchedItems
    });

    return new Response(JSON.stringify({ 
      success: true, 
      action: 'order_recap',
      matched_items: matchedItems.length,
      unmatched_items: unmatchedItems.length,
      is_new_customer: isNewCustomer,
      customer_id: customer_id || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
