import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LearningPattern {
  patternKey: string;
  patternType: 'product' | 'supplier' | 'product_supplier';
  adjustmentFactor: number;
  confidenceScore: number;
  sampleSize: number;
  avgVariancePercentage: number;
  stdDeviation: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch all historical weight estimation accuracy data
    const { data: accuracyData, error: accuracyError } = await supabase
      .from('weight_estimation_accuracy')
      .select('*')
      .not('actual_chargeable_weight_kg', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (accuracyError) {
      console.error("Error fetching accuracy data:", accuracyError);
      throw accuracyError;
    }

    if (!accuracyData || accuracyData.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No historical data available for learning',
          patterns: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${accuracyData.length} historical weight records...`);

    // Group data by product code
    const productGroups = new Map<string, typeof accuracyData>();
    accuracyData.forEach(record => {
      if (!productGroups.has(record.product_code)) {
        productGroups.set(record.product_code, []);
      }
      productGroups.get(record.product_code)!.push(record);
    });

    const learningPatterns: LearningPattern[] = [];

    // Analyze each product
    for (const [productCode, records] of productGroups.entries()) {
      if (records.length < 3) continue; // Need at least 3 samples for meaningful learning

      // Calculate variance statistics
      const variances = records.map(r => {
        const estimated = r.estimated_chargeable_weight_kg;
        const actual = r.actual_chargeable_weight_kg;
        return ((actual - estimated) / estimated) * 100;
      });

      const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
      const stdDev = Math.sqrt(
        variances.reduce((sum, v) => sum + Math.pow(v - avgVariance, 2), 0) / variances.length
      );

      // Calculate adjustment factor (1.0 means no adjustment needed)
      // If avgVariance is +10%, adjustment factor should be 1.10
      const adjustmentFactor = 1 + (avgVariance / 100);

      // Calculate confidence score based on sample size and consistency
      const sampleSizeScore = Math.min(records.length / 20, 1); // Max at 20 samples
      const consistencyScore = Math.max(0, 1 - (stdDev / 50)); // Higher stdDev = lower confidence
      const confidenceScore = (sampleSizeScore + consistencyScore) / 2;

      learningPatterns.push({
        patternKey: `product:${productCode}`,
        patternType: 'product',
        adjustmentFactor: Number(adjustmentFactor.toFixed(4)),
        confidenceScore: Number(confidenceScore.toFixed(3)),
        sampleSize: records.length,
        avgVariancePercentage: Number(avgVariance.toFixed(2)),
        stdDeviation: Number(stdDev.toFixed(2))
      });
    }

    console.log(`Generated ${learningPatterns.length} learning patterns`);

    // Upsert patterns into database
    for (const pattern of learningPatterns) {
      const { error: upsertError } = await supabase
        .from('weight_learning_patterns')
        .upsert({
          pattern_key: pattern.patternKey,
          pattern_type: pattern.patternType,
          adjustment_factor: pattern.adjustmentFactor,
          confidence_score: pattern.confidenceScore,
          sample_size: pattern.sampleSize,
          avg_variance_percentage: pattern.avgVariancePercentage,
          std_deviation: pattern.stdDeviation,
          last_calculated: new Date().toISOString()
        }, {
          onConflict: 'pattern_key'
        });

      if (upsertError) {
        console.error(`Error upserting pattern ${pattern.patternKey}:`, upsertError);
      }
    }

    // Generate insights summary
    const highConfidencePatterns = learningPatterns.filter(p => p.confidenceScore > 0.7);
    const significantAdjustments = learningPatterns.filter(
      p => Math.abs(p.adjustmentFactor - 1.0) > 0.05
    );

    const insights = {
      totalPatternsAnalyzed: learningPatterns.length,
      highConfidencePatterns: highConfidencePatterns.length,
      significantAdjustments: significantAdjustments.length,
      topAdjustments: significantAdjustments
        .sort((a, b) => Math.abs(b.adjustmentFactor - 1.0) - Math.abs(a.adjustmentFactor - 1.0))
        .slice(0, 5)
        .map(p => ({
          productCode: p.patternKey.replace('product:', ''),
          adjustmentFactor: p.adjustmentFactor,
          avgVariance: p.avgVariancePercentage,
          confidence: p.confidenceScore,
          sampleSize: p.sampleSize
        }))
    };

    console.log("Learning insights:", insights);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully analyzed ${accuracyData.length} records and generated ${learningPatterns.length} learning patterns`,
        insights,
        patterns: learningPatterns
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in weight-learning-engine:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
