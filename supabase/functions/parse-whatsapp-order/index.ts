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

    const { conversationText, products, customerMappings, customerId, customerPatterns, isSimpleOrder } = await req.json();

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

    // Simple model selection - no retries, fail fast
    const isSimple = isSimpleOrder || (!customerMappings?.length && !customerPatterns?.length);

    // Fetch verified context words - only essential ones with usage
    const { data: contextWords } = await supabase
      .from('distribution_context_words')
      .select('word, word_type, meaning')
      .eq('is_verified', true)
      .gt('usage_count', 0)
      .order('usage_count', { ascending: false })
      .limit(50);

    // Build compact product context
    const productList = products?.map((p: any) => 
      `${p.code}:${p.name}${p.name_pap ? `/${p.name_pap}` : ''}`
    ).join(', ') || '';

    // Build compact customer mapping context - only include if there are mappings
    const mappingContext = customerMappings?.length > 0
      ? `Customer terms: ${customerMappings.map((m: any) => `${m.customer_product_name}=${m.product_name}`).join(', ')}`
      : '';

    // Build compact pattern context - only include if there are patterns
    const patternContext = customerPatterns?.length > 0
      ? `Frequent: ${customerPatterns.map((p: any) => `${p.product_name}(~${p.avg_quantity})`).join(', ')}`
      : '';

    // Organize context words by category for better AI understanding
    const wordsByType: Record<string, any[]> = {};
    if (contextWords && contextWords.length > 0) {
      for (const word of contextWords) {
        if (!wordsByType[word.word_type]) {
          wordsByType[word.word_type] = [];
        }
        wordsByType[word.word_type].push(word);
      }
    }

    // Build compact context words (only units and quantities matter most)
    const buildCompactContext = (type: string) => {
      const words = wordsByType[type];
      if (!words || words.length === 0) return '';
      return words.slice(0, 10).map((w: any) => `${w.word}=${w.meaning}`).join(',');
    };

    const unitsCtx = buildCompactContext('unit');
    const qtyCtx = buildCompactContext('quantity_phrase');

    // Compact system prompt for speed
    const systemPrompt = `Parse WhatsApp orders from Curaçao (Papiamentu/EN/NL/ES mix).

DICTIONARY: ${unitsCtx ? `Units:${unitsCtx}` : ''} ${qtyCtx ? `Qty:${qtyCtx}` : ''}
Numbers: un=1,dos=2,tres=3,kuater=4,sinku=5,seis=6,siete=7,ocho=8,nuebe=9,dies=10
Units: kaha/kashi=case,saku=bag,tros=bunch,stuk=pc,pon=lb

PRODUCTS: ${productList}
${mappingContext}
${patternContext}

Extract items with: raw_text, interpreted_product, matched_product_code (from list above), quantity, unit, confidence.`;

    const requestBody = JSON.stringify({
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
                },
                context_words: {
                  type: "array",
                  description: "Any new Papiamentu/local slang words discovered that would help future parsing. Only include words NOT already in the dictionary provided.",
                  items: {
                    type: "object",
                    properties: {
                      word: { 
                        type: "string",
                        description: "The word or short phrase"
                      },
                      word_type: { 
                        type: "string", 
                        enum: ["unit", "quantity_phrase", "product_modifier", "action", "connector", "time_reference"],
                        description: "Category of the word"
                      },
                      meaning: { 
                        type: "string",
                        description: "English meaning of the word"
                      },
                      example: {
                        type: "string",
                        description: "Example usage from the conversation"
                      }
                    },
                    required: ["word", "word_type", "meaning"],
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
    });

    // Single attempt with fast timeout - fail fast to manual input
    const TIMEOUT_MS = 8000; // 8 second timeout - fail fast
    const model = isSimpleOrder ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
    
    console.log(`AI parsing with model: ${model}, timeout: ${TIMEOUT_MS}ms`);
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    let response: Response | null = null;
    let timedOut = false;

    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: requestBody.replace('"messages":', `"model":"${model}","messages":`),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      console.log(`AI responded in ${elapsed}ms with status ${response.status}`);
      
    } catch (error) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`AI timed out after ${elapsed}ms`);
        timedOut = true;
      } else {
        console.error('AI request error:', error);
      }
    }

    // If timed out or failed, return empty result with flag for client-side fallback
    if (timedOut || !response || !response.ok) {
      const elapsed = Date.now() - startTime;
      console.log(`AI failed/timed out after ${elapsed}ms, returning fallback response`);
      return new Response(
        JSON.stringify({ 
          items: [],
          detected_language: 'mixed',
          timedOut: timedOut,
          error: timedOut ? 'AI parsing timed out' : 'AI parsing failed'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Save newly discovered context words (if any) - mark as unverified for review
    if (extractedOrder.context_words?.length > 0) {
      console.log(`AI discovered ${extractedOrder.context_words.length} new context words`);
      
      for (const word of extractedOrder.context_words) {
        try {
          // Try to upsert - increment usage_count if already exists
          const { error: upsertError } = await supabase
            .from('distribution_context_words')
            .upsert({
              word: word.word.toLowerCase().trim(),
              word_type: word.word_type,
              meaning: word.meaning,
              language: extractedOrder.detected_language === 'mixed' ? 'pap' : extractedOrder.detected_language,
              usage_count: 1,
              is_verified: false,
              examples: word.example ? [word.example] : []
            }, {
              onConflict: 'word',
              ignoreDuplicates: false
            });
          
          if (upsertError) {
            // Word already exists - that's fine, just log it
            console.log('Context word already exists:', word.word);
          }
        } catch (e) {
          console.error('Failed to save context word:', word.word, e);
        }
      }
    }

    return new Response(
      JSON.stringify(extractedOrder),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-whatsapp-order:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
