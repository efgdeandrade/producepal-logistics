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

    // Get current date for seasonal analysis
    const currentDate = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const isHighSeason = currentMonth >= 11 || currentMonth <= 4; // Nov-Apr is high tourism season

    // Create a detailed prompt for the AI to search for market prices
    const productList = products.map(p => 
      `- ${p.productName} (${p.productCode}): Current CIF price Cg ${p.currentCIFPrice.toFixed(2)}, Quantity: ${p.quantity} units`
    ).join('\n');

    const prompt = `Analyze REAL MARKET PRICES for fresh produce in Curaçao by researching online grocery stores.

CONTEXT:
- Date: ${currentDate}
- Season: ${isHighSeason ? 'HIGH SEASON (Nov-Apr: Peak tourism)' : 'LOW SEASON (May-Oct: Lower demand)'}
- Region: Curaçao (Dutch Caribbean island, 80%+ imports)
- Currency: ANG (Antillean Guilder, pegged at 1.79 to USD)

PRODUCTS TO ANALYZE:
${productList}

CRITICAL RETAIL-TO-WHOLESALE CONVERSION:
Most retailers in Curaçao use a 40% markup (multiply by 1.40) on wholesale prices.
THEREFORE: To estimate wholesale prices from retail prices found online, DIVIDE by 1.40
Example: If retail price = Cg 2.80, then wholesale = 2.80 ÷ 1.40 = Cg 2.00

RESEARCH THESE CURAÇAO GROCERY STORES (search for similar products):
1. https://ewtcuracao.cw/ (EWT Supermarket)
2. https://www.vdtcuracao.com/ (VDT Supermarket)
3. https://www.mangusahypermarket.com (Mangusa Hypermarket)
4. https://goisco.com/ (GoISCO)
5. https://www.pietersz.com/products (Pietersz)
6. https://www.deli-nova.com/shop (Deli Nova)
7. https://www.fayadsfruits.com (Fayads Fruits)
8. https://www.numbeo.com/food-prices/country_result.jsp?country=Curacao (Price index)
9. https://fundashonpakonsumido.cw/ (Consumer foundation)

SUPPLY & DEMAND FACTORS TO CONSIDER:
- Import routes: USA (East Coast), Netherlands, Caribbean neighbors
- Shipping costs and frequency (affects supply)
- Current season impact on demand (tourism drives demand)
- Perishability and cold chain logistics
- Competition level among suppliers
- Import duties and port logistics costs

IMPORT SOURCE ANALYSIS:
- Products from USA: Consider current US market trends and freight costs
- Products from Netherlands: Consider EUR/USD rates and European supply
- Seasonal availability affects pricing (e.g., strawberries, tomatoes)

YOUR TASK:
1. Search online grocery stores for each product
2. Find RETAIL prices from grocery websites
3. Calculate WHOLESALE prices by dividing retail by 1.40
4. Compare calculated wholesale with the current CIF prices
5. Determine market position (UNDERPRICED/COMPETITIVE/OVERPRICED)
6. Provide realistic price ranges based on found data
7. Include seasonal and import source insights

Return ONLY valid JSON in this exact format (no other text):
{
  "marketAnalysis": [
    {
      "productCode": "string",
      "productName": "string",
      "currentPrice": number,
      "retailPriceFound": number,
      "calculatedWholesale": number,
      "marketLow": number,
      "marketAverage": number,
      "marketHigh": number,
      "position": "UNDERPRICED" | "COMPETITIVE" | "OVERPRICED",
      "priceOpportunity": number,
      "recommendation": "string",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "confidenceScore": number,
      "sources": "string",
      "sourceUrl": "string",
      "importSource": "usa" | "nld" | "other" | "mixed",
      "seasonalFactor": "high_season" | "low_season",
      "supplyDemandIndex": number,
      "conversionNote": "Retail Cg X.XX ÷ 1.40 = Wholesale Cg Y.YY"
    }
  ],
  "overallInsights": "string",
  "dataQuality": "HIGH" | "MEDIUM" | "LOW",
  "researchSummary": "string"
}`;

    // Call Lovable AI to generate market analysis
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a market pricing expert specializing in Curaçao fresh produce wholesale markets. Research actual retail prices from online grocery stores, then convert to wholesale using the 1.40 markup factor (retail ÷ 1.40 = wholesale). Consider import dependencies (USA/NLD), seasonal factors (tourism seasons), supply chain logistics, and local competition. Always return valid JSON only with real data from your web research.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
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
      retail_price_found: item.retailPriceFound,
      wholesale_conversion_factor: 1.40,
      calculated_wholesale: item.calculatedWholesale,
      region: 'curacao',
      source_url: item.sourceUrl,
      import_source_country: item.importSource,
      seasonal_factor: item.seasonalFactor,
      supply_demand_index: item.supplyDemandIndex,
      confidence_score: item.confidenceScore,
      scraped_at: new Date().toISOString(),
      metadata: {
        conversion_note: item.conversionNote,
        research_summary: analysis.researchSummary,
        data_quality: analysis.dataQuality,
        confidence: item.confidence,
      },
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
