import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductWeightData {
  code: string;
  name: string;
  quantity: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
  weightType: 'actual' | 'volumetric';
  costUSD: number;
  wholesalePriceXCG: number;
  retailPriceXCG: number;
  profitPerUnit: number;
}

interface PalletConfiguration {
  totalPallets: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  limitingFactor: 'actual_weight' | 'volumetric_weight' | 'balanced';
  utilizationPercentage: number;
  heightUtilization: number;
}

interface AdvisorInput {
  orderItems: ProductWeightData[];
  palletConfiguration: PalletConfiguration;
  freightCostPerKg: number;
  exchangeRate: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderItems, palletConfiguration, freightCostPerKg, exchangeRate } = await req.json() as AdvisorInput;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch all available products for suggestions
    const { data: allProducts } = await supabase
      .from('products')
      .select('code, name, price_usd_per_unit, gross_weight_per_unit, netto_weight_per_unit, volumetric_weight_kg, length_cm, width_cm, height_cm, wholesale_price_xcg_per_unit, pack_size');

    // Calculate weight gap
    const weightGap = palletConfiguration.totalVolumetricWeight - palletConfiguration.totalActualWeight;
    const gapPercentage = palletConfiguration.totalActualWeight > 0 
      ? (weightGap / palletConfiguration.totalActualWeight * 100)
      : 0;

    // Determine analysis type
    const analysisType = palletConfiguration.limitingFactor === 'volumetric_weight' 
      ? 'volumetric_limiting'
      : palletConfiguration.limitingFactor === 'actual_weight'
      ? 'actual_limiting'
      : 'balanced';

    // Prepare comprehensive context for AI
    const systemPrompt = `You are "Dito Advisor", an AI freight optimization specialist for fresh produce airfreight operations. Your goal is to maximize profitability when customers are charged by volumetric weight instead of actual weight.

CRITICAL RULES:
1. ALWAYS prioritize suggesting PRODUCTS TO ADD over products to remove
2. When volumetric weight is limiting, recommend dense products (high weight, low volume) to "fill the air"
3. Calculate exact profitability impact for each suggestion
4. Consider Europallet constraints: 80cm × 120cm base, max height 155cm, 26kg empty pallet weight
5. Provide actionable, specific recommendations with quantities

CONTEXT:
- Freight cost: $${freightCostPerKg}/kg
- Exchange rate: ${exchangeRate} XCG/USD
- Current limiting factor: ${analysisType}
- Weight gap (volumetric - actual): ${weightGap.toFixed(2)} kg (${gapPercentage.toFixed(1)}%)
- Total pallets: ${palletConfiguration.totalPallets}
- Utilization: ${palletConfiguration.utilizationPercentage.toFixed(1)}%`;

    const userPrompt = `
CURRENT ORDER ANALYSIS:
${orderItems.map(item => `
- ${item.name}:
  • Quantity: ${item.quantity} units
  • Actual weight: ${item.actualWeight.toFixed(2)} kg
  • Volumetric weight: ${item.volumetricWeight.toFixed(2)} kg
  • Chargeable: ${item.chargeableWeight.toFixed(2)} kg (${item.weightType})
  • Cost: $${item.costUSD.toFixed(2)}
  • Wholesale profit: Cg ${item.profitPerUnit.toFixed(2)}/unit
`).join('\n')}

TOTAL WEIGHT BREAKDOWN:
- Actual weight: ${palletConfiguration.totalActualWeight.toFixed(2)} kg
- Volumetric weight: ${palletConfiguration.totalVolumetricWeight.toFixed(2)} kg
- Chargeable weight: ${palletConfiguration.totalChargeableWeight.toFixed(2)} kg
- Weight wasted (paying for air): ${Math.max(0, weightGap).toFixed(2)} kg

AVAILABLE PRODUCTS DATABASE:
${allProducts?.slice(0, 50).map(p => {
  const actualWeight = p.gross_weight_per_unit || p.netto_weight_per_unit || 0;
  const volWeight = p.volumetric_weight_kg || 0;
  const density = volWeight > 0 ? (actualWeight / volWeight).toFixed(2) : 'N/A';
  return `- ${p.name} (${p.code}): 
    Actual: ${actualWeight}g, Volumetric: ${volWeight.toFixed(2)}kg, Density: ${density}, 
    Cost: $${p.price_usd_per_unit || 0}/unit, Wholesale: Cg ${p.wholesale_price_xcg_per_unit || 0}/unit`;
}).join('\n')}

YOUR TASK:
${analysisType === 'volumetric_limiting' 
  ? `We're paying for ${weightGap.toFixed(2)} kg of "air" - wasted freight cost! 
  
PRIMARY GOAL: Suggest DENSE PRODUCTS TO ADD that:
1. Have high actual weight but low volumetric weight (density > 1.0 is ideal)
2. Will increase actual weight to reduce the gap
3. Are profitable and fit within pallet constraints
4. Specify exact quantities to add

SECONDARY: Only if adding products doesn't work, suggest products to remove.`
  : `This order has good weight balance.

GOAL: Suggest minor optimizations or confirm the current configuration is optimal.`}

Return your analysis in the following JSON format:
{
  "analysisType": "volumetric_limiting" | "actual_limiting" | "balanced",
  "weightGap": ${weightGap},
  "gapPercentage": ${gapPercentage},
  "recommendations": {
    "productsToAdd": [
      {
        "productCode": "string",
        "productName": "string",
        "suggestedQuantity": number,
        "reasoningScore": number (0-100),
        "impactAnalysis": {
          "weightAdded": number,
          "volumeAdded": number,
          "actualWeightAdded": number,
          "volumetricWeightAdded": number,
          "profitAdded": number,
          "costAdded": number,
          "newUtilization": number,
          "newWeightGap": number,
          "freightSavingsPercentage": number
        },
        "reasoning": "string - explain why this product and this quantity"
      }
    ],
    "productsToRemove": [
      {
        "productCode": "string",
        "productName": "string",
        "suggestedQuantity": number,
        "profitImpact": number,
        "reasoning": "string"
      }
    ],
    "warnings": ["string"],
    "palletOptimizations": ["string"]
  },
  "profitabilityAnalysis": {
    "currentProfit": number,
    "optimizedProfit": number,
    "improvementPercentage": number,
    "freightWasteReduction": number
  },
  "summary": "string - concise 2-3 sentence executive summary"
}`;

    console.log('Calling Lovable AI for volumetric weight optimization...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Rate limit exceeded. Please try again in a moment.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'AI credits depleted. Please add credits to your Lovable workspace.' 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    console.log('AI response received:', content);
    
    // Strip markdown code blocks if present
    if (content.includes('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (content.includes('```')) {
      content = content.replace(/```\n?/g, '').trim();
    }
    
    let recommendation;
    try {
      recommendation = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Content was:', content);
      throw new Error('Invalid AI response format');
    }

    // Store the recommendation in the database for learning
    await supabase.from('pallet_configurations').insert({
      total_pallets: palletConfiguration.totalPallets,
      total_actual_weight_kg: palletConfiguration.totalActualWeight,
      total_volumetric_weight_kg: palletConfiguration.totalVolumetricWeight,
      total_chargeable_weight_kg: palletConfiguration.totalChargeableWeight,
      limiting_factor: palletConfiguration.limitingFactor,
      utilization_percentage: palletConfiguration.utilizationPercentage,
      recommendations: recommendation,
    });

    return new Response(
      JSON.stringify({
        success: true,
        recommendation,
        rawAnalysis: {
          analysisType,
          weightGap,
          gapPercentage,
          currentProducts: orderItems.length,
          totalActualWeight: palletConfiguration.totalActualWeight,
          totalVolumetricWeight: palletConfiguration.totalVolumetricWeight,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in volumetric-weight-advisor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});