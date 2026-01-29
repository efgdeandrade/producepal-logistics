import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

interface CIFEstimate {
  product_code: string;
  estimated_total_freight_usd: number;
  actual_total_freight_usd: number;
  variance_percentage: number;
  weight_type_used: string;
  pallets_used: number;
  estimated_date: string;
  estimated_cif_xcg?: number;
  actual_cif_xcg?: number;
}

interface LearningPattern {
  pattern_key: string;
  pattern_type: string;
  sample_size: number;
  avg_variance_percentage: number;
  std_deviation: number;
  adjustment_factor: number;
  confidence_score: number;
  season_quarter?: number;
}

// Get current season quarter (1-4)
function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch CIF estimates with actual data
    const { data: estimates, error: fetchError } = await supabase
      .from('cif_estimates')
      .select('*')
      .not('actual_cif_xcg', 'is', null)
      .order('estimated_date', { ascending: false })
      .limit(500); // Limit for performance

    if (fetchError) throw fetchError;

    if (!estimates || estimates.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No historical data available for learning",
          patterns_updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${estimates.length} historical CIF estimates`);

    // Group estimates by product code
    const productGroups = estimates.reduce((acc: Record<string, CIFEstimate[]>, est: any) => {
      if (!acc[est.product_code]) acc[est.product_code] = [];
      acc[est.product_code].push(est);
      return acc;
    }, {});

    // Analyze patterns
    const patterns: LearningPattern[] = [];
    const analysisData: any[] = [];
    const currentQuarter = getCurrentQuarter();

    for (const [productCode, productEstimates] of Object.entries(productGroups)) {
      if (productEstimates.length < 2) continue;

      // Calculate variance from CIF values
      const variances = productEstimates.map(e => {
        if (e.estimated_cif_xcg && e.actual_cif_xcg) {
          return ((e.actual_cif_xcg - e.estimated_cif_xcg) / e.estimated_cif_xcg) * 100;
        }
        return e.variance_percentage || 0;
      }).filter(v => !isNaN(v) && isFinite(v));

      if (variances.length < 2) continue;

      const avgVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length;
      
      // Calculate standard deviation
      const squaredDiffs = variances.map(v => Math.pow(v - avgVariance, 2));
      const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / squaredDiffs.length;
      const stdDev = Math.sqrt(variance);

      // Adjustment factor: if we consistently under-estimate (negative variance), 
      // we need to increase estimates (factor > 1)
      const adjustmentFactor = 1 + (avgVariance / 100);

      // Confidence score based on sample size and consistency
      const sampleSizeScore = Math.min(productEstimates.length / 10, 1) * 0.5;
      const consistencyScore = Math.max(0, 1 - (stdDev / 50)) * 0.5;
      const confidenceScore = (sampleSizeScore + consistencyScore) * 100;

      const pattern: LearningPattern = {
        pattern_key: `product_${productCode}`,
        pattern_type: 'product_freight',
        sample_size: productEstimates.length,
        avg_variance_percentage: avgVariance,
        std_deviation: stdDev,
        adjustment_factor: Math.max(0.5, Math.min(2.0, adjustmentFactor)), // Clamp between 0.5 and 2.0
        confidence_score: confidenceScore,
        season_quarter: currentQuarter,
      };

      patterns.push(pattern);
      
      analysisData.push({
        product_code: productCode,
        sample_size: productEstimates.length,
        avg_variance: avgVariance.toFixed(2),
        std_deviation: stdDev.toFixed(2),
        adjustment_factor: adjustmentFactor.toFixed(3),
        confidence: confidenceScore.toFixed(1),
        weight_types: [...new Set(productEstimates.map(e => e.weight_type_used))].join(', ')
      });
    }

    // Use AI to generate insights
    const aiPrompt = `You are a freight cost analysis expert. Analyze this historical CIF data and provide actionable insights:

Historical Data Summary:
${JSON.stringify(analysisData.slice(0, 20), null, 2)}

Total estimates analyzed: ${estimates.length}
Products with patterns: ${patterns.length}
Current season: Q${currentQuarter}

Tasks:
1. Identify the top 3 products with the most variance (good or bad)
2. Suggest what's causing consistent over/under-estimation
3. Recommend specific actions to improve future estimates
4. Highlight any concerning patterns (high variance, low confidence)
5. Provide adjustment recommendations for each product

Format your response as JSON with this structure:
{
  "summary": "brief overall summary",
  "top_variance_products": ["product1", "product2", "product3"],
  "root_causes": ["cause1", "cause2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "concerning_patterns": ["pattern1", "pattern2"],
  "product_adjustments": [
    {"product_code": "ABC", "current_factor": 1.05, "recommended_factor": 1.03, "reasoning": "..."}
  ],
  "seasonal_insights": "Any seasonal patterns observed"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiResult = await aiResponse.json();
    let content = aiResult.choices[0].message.content;
    
    // Strip markdown code blocks if present
    if (content.includes('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (content.includes('```')) {
      content = content.replace(/```\n?/g, '').trim();
    }
    
    const aiInsights = JSON.parse(content);

    console.log('AI Insights generated:', aiInsights);

    // Update or insert learning patterns with new fields
    for (const pattern of patterns) {
      const { error: upsertError } = await supabase
        .from('cif_learning_patterns')
        .upsert({
          pattern_key: pattern.pattern_key,
          pattern_type: pattern.pattern_type,
          sample_size: pattern.sample_size,
          avg_variance_percentage: pattern.avg_variance_percentage,
          std_deviation: pattern.std_deviation,
          adjustment_factor: pattern.adjustment_factor,
          confidence_score: pattern.confidence_score,
          season_quarter: pattern.season_quarter,
          last_calculated: new Date().toISOString(),
        }, { onConflict: 'pattern_key' });

      if (upsertError) {
        console.error(`Error upserting pattern ${pattern.pattern_key}:`, upsertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        patterns_analyzed: patterns.length,
        total_estimates: estimates.length,
        ai_insights: aiInsights,
        patterns: patterns.map(p => ({
          ...p,
          last_calculated: new Date().toISOString()
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in CIF learning engine:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
