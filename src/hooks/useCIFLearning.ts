import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Learning adjustment data from historical patterns
 */
export interface LearningAdjustment {
  productCode: string;
  adjustmentFactor: number;  // e.g., 1.05 means add 5% to estimates
  confidence: number;        // 0-100
  sampleSize: number;
  lastCalculated?: string;
  avgVariance?: number;
  applicationTier?: 'auto_apply' | 'suggested' | 'insufficient_data';
  stdDeviation?: number;
}

export interface CategorizedPatterns {
  autoApply: LearningAdjustment[];
  suggested: LearningAdjustment[];
  insufficientData: LearningAdjustment[];
}

export interface LearningEngineSummary {
  autoApplyCount: number;
  suggestedCount: number;
  insufficientDataCount: number;
  anomaliesDetected: number;
}

/**
 * Hook for integrating CIF learning patterns into calculations
 * Provides methods to fetch patterns and record actuals for continuous learning
 */
export function useCIFLearning() {
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<LearningAdjustment[]>([]);
  const [categorizedPatterns, setCategorizedPatterns] = useState<CategorizedPatterns>({
    autoApply: [],
    suggested: [],
    insufficientData: [],
  });
  const [summary, setSummary] = useState<LearningEngineSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch learning patterns for given product codes
   * Returns adjustment factors based on historical variance analysis
   */
  const fetchPatterns = useCallback(async (productCodes: string[]): Promise<LearningAdjustment[]> => {
    if (!productCodes.length) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      const patternKeys = productCodes.map(c => `product_${c}`);
      
      const { data, error: fetchError } = await supabase
        .from('cif_learning_patterns')
        .select('*')
        .in('pattern_key', patternKeys);

      if (fetchError) throw fetchError;

      const adjustments = data?.map(p => ({
        productCode: p.pattern_key.replace('product_', ''),
        adjustmentFactor: p.adjustment_factor ?? 1.0,
        confidence: p.confidence_score ?? 0,
        sampleSize: p.sample_size ?? 0,
        lastCalculated: p.last_calculated,
        avgVariance: p.avg_variance_percentage,
      })) || [];

      setPatterns(adjustments);
      return adjustments;
    } catch (err: any) {
      console.error('Error fetching CIF learning patterns:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Record actual CIF cost for a product to enable learning
   * Triggers pattern recalculation via the learning engine
   */
  const recordActual = useCallback(async (
    orderId: string | null,
    productCode: string,
    actualCIF: number,
    estimatedCIF: number,
    additionalData?: {
      actualWeightKg?: number;
      volumetricWeightKg?: number;
      chargeableWeightKg?: number;
      palletsUsed?: number;
    }
  ): Promise<boolean> => {
    if (!productCode || estimatedCIF === 0) return false;
    
    try {
      const variance = ((actualCIF - estimatedCIF) / estimatedCIF) * 100;
      
      const { error: upsertError } = await supabase.from('cif_estimates').upsert({
        order_id: orderId,
        product_code: productCode,
        estimated_cif_xcg: estimatedCIF,
        actual_cif_xcg: actualCIF,
        variance_percentage: variance,
        variance_amount_usd: (actualCIF - estimatedCIF) / 1.82, // Approximate USD
        actual_weight_kg: additionalData?.actualWeightKg ?? 0,
        volumetric_weight_kg: additionalData?.volumetricWeightKg ?? 0,
        chargeable_weight_kg: additionalData?.chargeableWeightKg ?? 0,
        pallets_used: additionalData?.palletsUsed,
        estimated_date: new Date().toISOString(),
      }, {
        onConflict: 'order_id,product_code'
      });

      if (upsertError) throw upsertError;

      return true;
    } catch (err: any) {
      console.error('Error recording actual CIF:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * Trigger the learning engine to recalculate patterns
   * Call this after entering actual costs for an order
   * Returns categorized patterns and summary
   */
  const triggerLearning = useCallback(async (): Promise<{
    success: boolean;
    categorized?: CategorizedPatterns;
    summary?: LearningEngineSummary;
  }> => {
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('cif-learning-engine');
      if (invokeError) throw invokeError;
      
      if (data?.categorized_patterns) {
        const mapPattern = (p: any): LearningAdjustment => ({
          productCode: p.pattern_key.replace('product_', ''),
          adjustmentFactor: p.adjustment_factor ?? 1.0,
          confidence: p.confidence_score ?? 0,
          sampleSize: p.sample_size ?? 0,
          lastCalculated: p.last_calculated,
          avgVariance: p.avg_variance_percentage,
          applicationTier: p.application_tier,
          stdDeviation: p.std_deviation,
        });
        
        const categorized: CategorizedPatterns = {
          autoApply: data.categorized_patterns.auto_apply?.map(mapPattern) || [],
          suggested: data.categorized_patterns.suggested?.map(mapPattern) || [],
          insufficientData: data.categorized_patterns.insufficient_data?.map(mapPattern) || [],
        };
        
        setCategorizedPatterns(categorized);
        
        const newSummary: LearningEngineSummary = {
          autoApplyCount: data.summary?.auto_apply_count ?? 0,
          suggestedCount: data.summary?.suggested_count ?? 0,
          insufficientDataCount: data.summary?.insufficient_data_count ?? 0,
          anomaliesDetected: data.summary?.anomalies_detected ?? 0,
        };
        setSummary(newSummary);
        
        // Also update the flat patterns list
        const allPatterns = [...categorized.autoApply, ...categorized.suggested];
        setPatterns(allPatterns);
        
        return { success: true, categorized, summary: newSummary };
      }
      
      return { success: true };
    } catch (err: any) {
      console.error('Error triggering learning engine:', err);
      setError(err.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Manually apply a suggested adjustment for a specific product
   * This would update the pattern to auto_apply tier
   */
  const applyAdjustment = useCallback(async (productCode: string): Promise<boolean> => {
    try {
      const patternKey = `product_${productCode}`;
      
      // Update the pattern's confidence to force auto-apply tier
      const { error: updateError } = await supabase
        .from('cif_learning_patterns')
        .update({ 
          confidence_score: 75, // Set above auto-apply threshold
        })
        .eq('pattern_key', patternKey);

      if (updateError) throw updateError;

      // Move from suggested to autoApply locally
      setCategorizedPatterns(prev => {
        const suggestedPattern = prev.suggested.find(p => p.productCode === productCode);
        if (!suggestedPattern) return prev;
        
        return {
          autoApply: [...prev.autoApply, { ...suggestedPattern, applicationTier: 'auto_apply' }],
          suggested: prev.suggested.filter(p => p.productCode !== productCode),
          insufficientData: prev.insufficientData,
        };
      });

      return true;
    } catch (err: any) {
      console.error('Error applying adjustment:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * Dismiss a suggested adjustment (don't apply)
   */
  const dismissAdjustment = useCallback(async (productCode: string): Promise<boolean> => {
    try {
      const patternKey = `product_${productCode}`;
      
      // Set confidence below suggest threshold to hide it
      const { error: updateError } = await supabase
        .from('cif_learning_patterns')
        .update({ 
          confidence_score: 40, // Below suggest threshold
        })
        .eq('pattern_key', patternKey);

      if (updateError) throw updateError;

      // Remove from suggested locally
      setCategorizedPatterns(prev => ({
        ...prev,
        suggested: prev.suggested.filter(p => p.productCode !== productCode),
        insufficientData: [...prev.insufficientData, 
          ...prev.suggested.filter(p => p.productCode === productCode).map(p => ({
            ...p, 
            applicationTier: 'insufficient_data' as const
          }))
        ],
      }));

      return true;
    } catch (err: any) {
      console.error('Error dismissing adjustment:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * Get the adjustment factor for a specific product
   * Returns 1.0 (no adjustment) if pattern not found or low confidence
   */
  const getAdjustmentFactor = useCallback((productCode: string, minConfidence: number = 50): number => {
    const pattern = patterns.find(p => p.productCode === productCode);
    if (!pattern || pattern.confidence < minConfidence) return 1.0;
    return pattern.adjustmentFactor;
  }, [patterns]);

  /**
   * Apply learning adjustments to CIF calculations
   * Modifies CIF per unit based on historical patterns
   */
  const applyAdjustments = useCallback(<T extends { productCode: string; cifPerUnit: number }>(
    results: T[],
    minConfidence: number = 50
  ): (T & { adjustmentApplied?: number; adjustmentConfidence?: number })[] => {
    return results.map(result => {
      const pattern = patterns.find(p => p.productCode === result.productCode);
      
      if (pattern && pattern.confidence >= minConfidence) {
        const adjustedCIF = result.cifPerUnit * pattern.adjustmentFactor;
        return {
          ...result,
          cifPerUnit: adjustedCIF,
          adjustmentApplied: pattern.adjustmentFactor,
          adjustmentConfidence: pattern.confidence,
        };
      }
      
      return result;
    });
  }, [patterns]);

  return {
    loading,
    error,
    patterns,
    categorizedPatterns,
    summary,
    fetchPatterns,
    recordActual,
    triggerLearning,
    getAdjustmentFactor,
    applyAdjustments,
    applyAdjustment,
    dismissAdjustment,
  };
}
