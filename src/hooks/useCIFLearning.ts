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
}

/**
 * Hook for integrating CIF learning patterns into calculations
 * Provides methods to fetch patterns and record actuals for continuous learning
 */
export function useCIFLearning() {
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<LearningAdjustment[]>([]);
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
   */
  const triggerLearning = useCallback(async (): Promise<boolean> => {
    try {
      const { error: invokeError } = await supabase.functions.invoke('cif-learning-engine');
      if (invokeError) throw invokeError;
      return true;
    } catch (err: any) {
      console.error('Error triggering learning engine:', err);
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
    fetchPatterns,
    recordActual,
    triggerLearning,
    getAdjustmentFactor,
    applyAdjustments,
  };
}
