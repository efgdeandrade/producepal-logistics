import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductInfo {
  productCode: string;
  productName: string;
  currentCIFPrice: number;
  quantity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products } = await req.json() as { products: ProductInfo[] };
    
    if (!products || products.length === 0) {
      throw new Error('No products provided');
    }

    console.log('Analyzing market prices for products:', products.map(p => p.productName));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create a detailed prompt for the AI to search for market prices
    const productList = products.map(p => 
      `- ${p.productName} (${p.productCode}): Current CIF price Cg ${p.currentCIFPrice.toFixed(2)}, Quantity: ${p.quantity} units`
    ).join('\n');

    const prompt = `Analyze current market prices for fresh produce in Curaçao and the Caribbean region.

Products to analyze:
${productList}

Based on typical Caribbean market conditions, import costs, and wholesale pricing patterns:
1. Estimate realistic wholesale market price ranges (low, average, high) in Curaçao Guilders (Cg)
2. Compare each product's current CIF price against estimated market benchmarks
3. Identify pricing opportunities and competitive positioning
4. Consider factors like perishability, import competition, and local demand

Return ONLY valid JSON in this exact format (no other text):
{
  "marketAnalysis": [
    {
      "productCode": "string",
      "productName": "string", 
      "currentPrice": number,
      "marketLow": number,
      "marketAverage": number,
      "marketHigh": number,
      "position": "UNDERPRICED" | "COMPETITIVE" | "OVERPRICED",
      "priceOpportunity": number,
      "recommendation": "string",
      "confidence": "MEDIUM",
      "sources": "Market estimates based on Caribbean wholesale pricing patterns"
    }
  ],
  "overallInsights": "string"
}`;

    // Call Lovable AI to generate market analysis
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a market pricing expert for Caribbean fresh produce wholesale markets. Provide realistic price estimates based on typical import costs, logistics, and local market conditions. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service quota exceeded. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    console.log('AI Response:', aiMessage);

    // Parse the AI response
    let analysis;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedMessage = aiMessage.trim();
      
      // Remove markdown code fences
      cleanedMessage = cleanedMessage.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to parse as JSON
      analysis = JSON.parse(cleanedMessage);
      
      // Validate the structure
      if (!analysis.marketAnalysis || !Array.isArray(analysis.marketAnalysis)) {
        throw new Error('Invalid analysis structure');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw AI message:', aiMessage);
      throw new Error('Invalid AI response format');
    }

    // Store snapshots in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const snapshots = analysis.marketAnalysis.map((item: any) => ({
      product_code: item.productCode,
      product_name: item.productName,
      market_avg: item.marketAverage,
      market_low: item.marketLow,
      market_high: item.marketHigh,
      source: item.sources,
    }));

    const { error: dbError } = await supabase
      .from('market_price_snapshots')
      .insert(snapshots);

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if we can't save to DB
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in market-price-advisor:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
