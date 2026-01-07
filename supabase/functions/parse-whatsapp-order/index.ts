import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationText, products, customerMappings } = await req.json();

    if (!conversationText || typeof conversationText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'conversationText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build product context for the AI
    const productList = products?.map((p: any) => 
      `${p.code}: ${p.name}${p.name_pap ? ` (Pap: ${p.name_pap})` : ''}${p.name_nl ? ` (NL: ${p.name_nl})` : ''}${p.name_es ? ` (ES: ${p.name_es})` : ''}`
    ).join('\n') || '';

    // Build customer mapping context
    const mappingContext = customerMappings?.length > 0
      ? `Known customer-specific product names:\n${customerMappings.map((m: any) => 
          `"${m.customer_product_name}" = ${m.product_name}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are an expert order parser for a food & beverage distribution company in Curaçao. 
Your job is to extract order information from WhatsApp conversations that may be in Papiamento, English, Dutch, or Spanish (often mixed).

IMPORTANT CONTEXT:
- Common Papiamento food terms: siboyo (onion), yerba (cilantro/herbs), komkommer (cucumber), tomati (tomato), piña (pineapple), papaya, mango, lechuga (lettuce), sla (salad/lettuce), pampuna (pumpkin), batata (sweet potato), yuca, etc.
- Units: kg, lb, gram, tros (bunch), case/kashi, stuk/pcs/pieces
- Numbers might be written as words: un/uno/een=1, dos/twee=2, tres/drei=3, etc.

Available products in the system:
${productList}

${mappingContext}

Extract ALL order items mentioned in the conversation, even if spread across multiple messages.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this WhatsApp conversation and extract the order:\n\n${conversationText}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_order",
              description: "Extract order details from a WhatsApp conversation",
              parameters: {
                type: "object",
                properties: {
                  customer_name: { 
                    type: "string",
                    description: "Customer name if mentioned in the conversation"
                  },
                  customer_phone: { 
                    type: "string",
                    description: "WhatsApp phone number if visible"
                  },
                  detected_language: { 
                    type: "string", 
                    enum: ["pap", "en", "nl", "es", "mixed"],
                    description: "Primary language of the conversation"
                  },
                  delivery_date: { 
                    type: "string",
                    description: "Requested delivery date in YYYY-MM-DD format if mentioned"
                  },
                  special_instructions: { 
                    type: "string",
                    description: "Any special requests or notes"
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        raw_text: { 
                          type: "string",
                          description: "Original text from the conversation for this item"
                        },
                        interpreted_product: { 
                          type: "string",
                          description: "Your best interpretation of what product they want"
                        },
                        matched_product_code: {
                          type: "string",
                          description: "The product code from the available products list that best matches, or null if unsure"
                        },
                        quantity: { 
                          type: "number",
                          description: "Quantity ordered"
                        },
                        unit: { 
                          type: "string",
                          description: "Unit of measurement (kg, lb, pcs, tros, case, etc.)"
                        },
                        confidence: { 
                          type: "string", 
                          enum: ["high", "medium", "low"],
                          description: "How confident you are in this interpretation"
                        }
                      },
                      required: ["raw_text", "interpreted_product", "quantity", "unit", "confidence"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["detected_language", "items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_order" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limited by AI gateway');
        return new Response(
          JSON.stringify({ error: 'Too many requests. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('Payment required for AI gateway');
        return new Response(
          JSON.stringify({ error: 'AI service requires payment. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_order') {
      console.error('Unexpected response format:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Failed to parse conversation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedOrder = JSON.parse(toolCall.function.arguments);
    
    console.log('Successfully extracted order:', JSON.stringify(extractedOrder));

    return new Response(
      JSON.stringify(extractedOrder),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-whatsapp-order:', error);
    // Return generic error message to client
    return new Response(
      JSON.stringify({ error: 'Failed to parse order. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
