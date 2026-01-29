import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://fuik.io',
  'https://www.fuik.io',
  'https://dnxzpkbobzwjcuyfgdnh.lovable.app'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductData {
  code: string;
  name: string;
  quantity: number;
  actualWeight: number;
  volumetricWeight: number;
  costUSD: number;
  wholesalePriceXCG?: number;
  retailPriceXCG?: number;
}

interface CIFMethodResult {
  method: string;
  totalProfit: number;
  avgMargin: number;
  products: Array<{
    productCode: string;
    cifPerUnit: number;
    wholesaleMargin: number;
    freightShare: number;
  }>;
}

interface AdvisorInput {
  products: ProductData[];
  totalFreight: number;
  exchangeRate: number;
  palletConfig?: {
    totalPallets: number;
    totalActualWeight: number;
    totalVolumetricWeight: number;
    utilizationPercentage: number;
  };
  cifMethodResults?: CIFMethodResult[];
  includeWeightOptimization?: boolean;
}

interface LearningPattern {
  pattern_key: string;
  adjustment_factor: number;
  confidence_score: number;
  sample_size: number;
  avg_variance_percentage: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const input: AdvisorInput = await req.json();
    const { 
      products, 
      totalFreight, 
      exchangeRate, 
      palletConfig, 
      cifMethodResults,
      includeWeightOptimization = true 
    } = input;

    console.log('Dito Unified Advisor - Processing request for', products.length, 'products');

    // Fetch learning patterns for these products
    const productCodes = products.map(p => p.code);
    const patternKeys = productCodes.map(c => `product_${c}`);
    
    const { data: learningPatterns } = await supabase
      .from('cif_learning_patterns')
      .select('*')
      .in('pattern_key', patternKeys);

    const patternMap = new Map<string, LearningPattern>(
      learningPatterns?.map(p => [p.pattern_key.replace('product_', ''), p]) || []
    );

    // Fetch demand patterns for velocity analysis
    const { data: demandPatterns } = await supabase
      .from('demand_patterns')
      .select('product_code, order_frequency, avg_waste_rate, total_ordered')
      .in('product_code', productCodes);

    const demandMap = new Map(
      demandPatterns?.map(d => [d.product_code, d]) || []
    );

    // Calculate weight gap for optimization suggestions
    let weightGap = 0;
    let gapPercentage = 0;
    let analysisType = 'balanced';
    
    if (palletConfig) {
      weightGap = palletConfig.totalVolumetricWeight - palletConfig.totalActualWeight;
      gapPercentage = palletConfig.totalActualWeight > 0 
        ? (weightGap / palletConfig.totalActualWeight) * 100 
        : 0;
      
      if (weightGap > palletConfig.totalActualWeight * 0.1) {
        analysisType = 'volumetric_limiting';
      } else if (weightGap < -palletConfig.totalActualWeight * 0.1) {
        analysisType = 'actual_limiting';
      }
    }

    // Build comprehensive context for AI
    const productContext = products.map(p => {
      const pattern = patternMap.get(p.code);
      const demand = demandMap.get(p.code);
      
      return {
        code: p.code,
        name: p.name,
        quantity: p.quantity,
        actualWeight: p.actualWeight,
        volumetricWeight: p.volumetricWeight,
        costUSD: p.costUSD,
        wholesaleXCG: p.wholesalePriceXCG || 0,
        density: p.volumetricWeight > 0 ? (p.actualWeight / p.volumetricWeight) : 1,
        learningAdjustment: pattern?.adjustment_factor || 1.0,
        learningConfidence: pattern?.confidence_score || 0,
        historicalVariance: pattern?.avg_variance_percentage || 0,
        orderFrequency: demand?.order_frequency || 1,
        wasteRate: demand?.avg_waste_rate || 0,
      };
    });

    // Calculate method recommendations if CIF results provided
    let methodAnalysis = '';
    let recommendedMethod = 'proportional';
    
    if (cifMethodResults && cifMethodResults.length > 0) {
      const sortedByProfit = [...cifMethodResults].sort((a, b) => b.totalProfit - a.totalProfit);
      recommendedMethod = sortedByProfit[0].method;
      
      methodAnalysis = `
METHOD COMPARISON:
${cifMethodResults.map(m => `- ${m.method}: Total Profit Cg ${m.totalProfit.toFixed(2)}, Avg Margin ${m.avgMargin.toFixed(1)}%`).join('\n')}

Highest profit method: ${recommendedMethod} with Cg ${sortedByProfit[0].totalProfit.toFixed(2)}
`;
    }

    // Build AI prompt
    const systemPrompt = `You are "Dito", FUIK's unified CIF and weight optimization advisor for Curaçao fresh produce airfreight.

CORE RESPONSIBILITIES:
1. Recommend the optimal CIF distribution method based on profitability analysis
2. Apply learning adjustments from historical patterns
3. Optimize weight/volume balance to minimize "paying for air"
4. Provide actionable product-specific recommendations

CRITICAL CONTEXT:
- Target margins: 44% retail, 20% wholesale
- Exchange rate: ${exchangeRate} XCG/USD
- Total freight to distribute: $${totalFreight.toFixed(2)}
${palletConfig ? `- Pallets: ${palletConfig.totalPallets}, Utilization: ${palletConfig.utilizationPercentage.toFixed(1)}%` : ''}
${analysisType === 'volumetric_limiting' ? `- ⚠️ VOLUMETRIC LIMITING: Paying for ${weightGap.toFixed(2)}kg of "air" (${gapPercentage.toFixed(1)}% gap)` : ''}`;

    const userPrompt = `
PRODUCTS IN ORDER:
${productContext.map(p => `
${p.name} (${p.code}):
- Qty: ${p.quantity}, Cost: $${p.costUSD.toFixed(2)}, Wholesale: Cg ${p.wholesaleXCG.toFixed(2)}
- Weight: ${p.actualWeight.toFixed(2)}kg actual, ${p.volumetricWeight.toFixed(2)}kg volumetric (density: ${p.density.toFixed(2)})
- Learning: ${p.learningConfidence > 50 ? `${((p.learningAdjustment - 1) * 100).toFixed(1)}% adjustment (${p.learningConfidence.toFixed(0)}% confidence)` : 'No pattern'}
- Velocity: ${p.orderFrequency} orders, ${p.wasteRate.toFixed(1)}% waste
`).join('\n')}

${methodAnalysis}

TASKS:
1. Recommend CIF method (proportional, valueBased, or smartBlend) with reasoning
2. Suggest specific blend ratio if smartBlend recommended (0.3 to 0.9)
3. For each product with learning patterns, confirm or adjust the AI-learned factor
4. ${includeWeightOptimization && analysisType === 'volumetric_limiting' ? 'Suggest dense products to ADD to fill weight gap' : 'Confirm weight optimization is not needed or suggest minor adjustments'}
5. Identify risk factors (high waste, low margin, pricing concerns)

Return your analysis as JSON:
{
  "recommendedMethod": "proportional" | "valueBased" | "smartBlend",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "blendRatio": 0.7,
  "reasoning": ["reason1", "reason2", "reason3"],
  "profitAnalysis": {
    "estimatedTotalProfit": 0,
    "averageMargin": 0,
    "methodComparison": "Brief comparison"
  },
  "learningAdjustments": [
    {"productCode": "ABC", "originalFactor": 1.0, "recommendedFactor": 1.05, "reasoning": "..."}
  ],
  "weightOptimization": {
    "needed": true,
    "gap": 0,
    "suggestions": ["Add X units of Y", "Consider denser products"]
  },
  "riskAlerts": ["Product X has 15% waste rate", "Product Y margin below target"],
  "summary": "Executive summary in 2-3 sentences"
}`;

    console.log('Calling Lovable AI for unified analysis...');

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
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits depleted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Parse response
    if (content.includes('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (content.includes('```')) {
      content = content.replace(/```\n?/g, '').trim();
    }
    
    const recommendation = JSON.parse(content);
    
    console.log('Dito Unified Advisor - Analysis complete');

    return new Response(
      JSON.stringify({
        success: true,
        recommendation,
        metadata: {
          productsAnalyzed: products.length,
          patternsFound: learningPatterns?.length || 0,
          analysisType,
          weightGap,
          gapPercentage,
        }
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in dito-unified-advisor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
