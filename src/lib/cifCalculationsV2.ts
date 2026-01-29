/**
 * CIF Calculations V2 - Simplified and Learning-Integrated
 * 
 * Reduces 7 methods to 3 intelligent ones:
 * - proportional: Allocate by chargeable weight (most accurate for freight)
 * - valueBased: Allocate by product value (for high-value low-weight items)
 * - smartBlend: AI-recommended dynamic blend using learned patterns
 * 
 * Maintains backward compatibility with existing method names
 */

import type { LearningAdjustment } from '@/hooks/useCIFLearning';

// ================== Types ==================

export interface CIFProductInput {
  productCode: string;
  productName: string;
  quantity: number;
  costPerUnit: number;
  actualWeight: number; // kg - total for this product line
  volumetricWeight: number; // kg - total for this product line
  orderFrequency?: number;
  wasteRate?: number;
  wholesalePriceXCG?: number;
  retailPriceXCG?: number;
  supplier?: string;
}

export interface CIFParams {
  totalFreight: number; // USD - total freight to distribute
  exchangeRate: number;
  limitingFactor: 'actual' | 'volumetric';
  wholesaleMultiplier?: number;
  retailMultiplier?: number;
  blendRatio?: number; // For smartBlend: 0-1, where 1 = all weight, 0 = all cost
}

export interface CIFResult {
  productCode: string;
  productName: string;
  quantity: number;
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  cifPerUnit: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
  supplier?: string;
  // Learning-enhanced fields
  adjustmentApplied?: number;
  adjustmentConfidence?: number;
  originalCifPerUnit?: number;
}

// New simplified method types
export type DistributionMethodV2 = 'proportional' | 'valueBased' | 'smartBlend';

// Legacy method types for backward compatibility
export type LegacyDistributionMethod = 
  | 'byWeight' 
  | 'byCost' 
  | 'equally' 
  | 'hybrid' 
  | 'strategic' 
  | 'volumeOptimized' 
  | 'customerTier';

export type DistributionMethod = DistributionMethodV2 | LegacyDistributionMethod;

// ================== Constants ==================

export const DEFAULT_WHOLESALE_MULTIPLIER = 1.25;
export const DEFAULT_RETAIL_MULTIPLIER = 1.786;
export const DEFAULT_EXCHANGE_RATE = 1.82;
export const DEFAULT_BLEND_RATIO = 0.7; // 70% weight, 30% cost
export const DEFAULT_LOCAL_LOGISTICS_USD = 91;
export const DEFAULT_LABOR_XCG = 50;
export const DEFAULT_BANK_CHARGES_USD = 0;

// Method mapping from legacy to new
export const METHOD_MAPPING: Record<LegacyDistributionMethod, DistributionMethodV2> = {
  byWeight: 'proportional',
  byCost: 'valueBased',
  equally: 'proportional', // Fallback to proportional
  hybrid: 'smartBlend',
  strategic: 'smartBlend',
  volumeOptimized: 'smartBlend',
  customerTier: 'smartBlend',
};

// ================== Helper Functions ==================

interface Totals {
  totalCost: number;
  totalWeight: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  productCount: number;
}

export function calculateTotals(products: CIFProductInput[]): Totals {
  let totalCost = 0;
  let totalActualWeight = 0;
  let totalVolumetricWeight = 0;

  products.forEach(p => {
    totalCost += p.quantity * p.costPerUnit;
    totalActualWeight += p.actualWeight;
    totalVolumetricWeight += p.volumetricWeight;
  });

  return {
    totalCost,
    totalWeight: Math.max(totalActualWeight, totalVolumetricWeight),
    totalActualWeight,
    totalVolumetricWeight,
    productCount: products.length,
  };
}

export function getProductContribution(
  product: CIFProductInput,
  limitingFactor: 'actual' | 'volumetric'
): number {
  return limitingFactor === 'volumetric' 
    ? product.volumetricWeight 
    : product.actualWeight;
}

// ================== Core Distribution Methods ==================

/**
 * Proportional method (formerly byWeight)
 * Allocates freight proportional to the product's contribution to total chargeable weight
 */
export function calculateFreightProportional(
  product: CIFProductInput,
  totals: Totals,
  totalFreight: number,
  limitingFactor: 'actual' | 'volumetric'
): number {
  const totalChargeableWeight = Math.max(totals.totalActualWeight, totals.totalVolumetricWeight);
  if (totalChargeableWeight === 0) return 0;
  
  const productContribution = getProductContribution(product, limitingFactor);
  return (productContribution / totalChargeableWeight) * totalFreight;
}

/**
 * Value-based method (formerly byCost)
 * Allocates freight proportional to the product's cost contribution
 */
export function calculateFreightValueBased(
  product: CIFProductInput,
  totals: Totals,
  totalFreight: number
): number {
  if (totals.totalCost === 0) return 0;
  const productCost = product.quantity * product.costPerUnit;
  return (productCost / totals.totalCost) * totalFreight;
}

/**
 * Smart Blend method
 * Dynamically blends weight and cost allocation based on learned patterns
 * blendRatio: 1 = all weight, 0 = all cost (default: 0.7 = 70% weight)
 */
export function calculateFreightSmartBlend(
  product: CIFProductInput,
  totals: Totals,
  totalFreight: number,
  limitingFactor: 'actual' | 'volumetric',
  blendRatio: number = DEFAULT_BLEND_RATIO
): number {
  const weightShare = calculateFreightProportional(product, totals, totalFreight, limitingFactor);
  const costShare = calculateFreightValueBased(product, totals, totalFreight);
  
  return (weightShare * blendRatio) + (costShare * (1 - blendRatio));
}

/**
 * Get freight share using specified method
 */
export function getFreightShare(
  product: CIFProductInput,
  totals: Totals,
  params: CIFParams,
  method: DistributionMethod
): number {
  // Map legacy methods to new ones
  const effectiveMethod = isLegacyMethod(method) ? METHOD_MAPPING[method] : method;
  
  switch (effectiveMethod) {
    case 'proportional':
      return calculateFreightProportional(product, totals, params.totalFreight, params.limitingFactor);
    case 'valueBased':
      return calculateFreightValueBased(product, totals, params.totalFreight);
    case 'smartBlend':
      return calculateFreightSmartBlend(
        product, 
        totals, 
        params.totalFreight, 
        params.limitingFactor,
        params.blendRatio ?? DEFAULT_BLEND_RATIO
      );
    default:
      return calculateFreightProportional(product, totals, params.totalFreight, params.limitingFactor);
  }
}

function isLegacyMethod(method: DistributionMethod): method is LegacyDistributionMethod {
  return ['byWeight', 'byCost', 'equally', 'hybrid', 'strategic', 'volumeOptimized', 'customerTier'].includes(method);
}

// ================== Main Calculation Functions ==================

/**
 * Calculate CIF result for a single product with a given freight share
 */
export function calculateProductCIF(
  product: CIFProductInput,
  freightShare: number,
  params: CIFParams
): CIFResult {
  const wholesaleMultiplier = params.wholesaleMultiplier ?? DEFAULT_WHOLESALE_MULTIPLIER;
  const retailMultiplier = params.retailMultiplier ?? DEFAULT_RETAIL_MULTIPLIER;
  
  const productCost = product.quantity * product.costPerUnit;
  const cifUSD = productCost + freightShare;
  const cifXCG = cifUSD * params.exchangeRate;
  const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;
  
  // Use stored prices if available, otherwise calculate from CIF
  const wholesalePrice = product.wholesalePriceXCG || (cifPerUnit * wholesaleMultiplier);
  const retailPrice = product.retailPriceXCG || (cifPerUnit * retailMultiplier);
  const wholesaleMargin = wholesalePrice - cifPerUnit;
  const retailMargin = retailPrice - cifPerUnit;
  
  return {
    productCode: product.productCode,
    productName: product.productName,
    quantity: product.quantity,
    costUSD: productCost,
    freightCost: freightShare,
    cifUSD,
    cifXCG,
    cifPerUnit,
    wholesalePrice,
    retailPrice,
    wholesaleMargin,
    retailMargin,
    supplier: product.supplier,
  };
}

/**
 * Calculate CIF for all products using a specific distribution method
 */
export function calculateCIFByMethod(
  products: CIFProductInput[],
  params: CIFParams,
  method: DistributionMethod
): CIFResult[] {
  if (products.length === 0) return [];
  
  const totals = calculateTotals(products);
  
  return products.map(product => {
    const freightShare = getFreightShare(product, totals, params, method);
    return calculateProductCIF(product, freightShare, params);
  });
}

/**
 * Calculate CIF with learning patterns applied
 * Automatically adjusts CIF based on historical variance for each product
 */
export function calculateCIFWithLearning(
  products: CIFProductInput[],
  params: CIFParams,
  method: DistributionMethod,
  learningPatterns?: LearningAdjustment[],
  minConfidence: number = 50
): CIFResult[] {
  const baseResults = calculateCIFByMethod(products, params, method);
  
  if (!learningPatterns?.length) return baseResults;
  
  // Apply learned adjustments
  return baseResults.map(result => {
    const pattern = learningPatterns.find(p => p.productCode === result.productCode);
    
    if (pattern && pattern.confidence >= minConfidence) {
      const originalCifPerUnit = result.cifPerUnit;
      const adjustedCIF = result.cifPerUnit * pattern.adjustmentFactor;
      
      // Recalculate margins with adjusted CIF
      const wholesaleMargin = result.wholesalePrice - adjustedCIF;
      const retailMargin = result.retailPrice - adjustedCIF;
      
      return {
        ...result,
        cifPerUnit: adjustedCIF,
        cifXCG: adjustedCIF * result.quantity,
        wholesaleMargin,
        retailMargin,
        adjustmentApplied: pattern.adjustmentFactor,
        adjustmentConfidence: pattern.confidence,
        originalCifPerUnit,
      };
    }
    
    return result;
  });
}

/**
 * Calculate all three core methods for comparison
 */
export function calculateAllMethods(
  products: CIFProductInput[],
  params: CIFParams
): Record<DistributionMethodV2, CIFResult[]> {
  return {
    proportional: calculateCIFByMethod(products, params, 'proportional'),
    valueBased: calculateCIFByMethod(products, params, 'valueBased'),
    smartBlend: calculateCIFByMethod(products, params, 'smartBlend'),
  };
}

/**
 * Calculate with all legacy methods for backward compatibility
 */
export function calculateAllCIFMethods(
  products: CIFProductInput[],
  params: CIFParams
): Record<LegacyDistributionMethod, CIFResult[]> {
  const methods: LegacyDistributionMethod[] = [
    'byWeight', 'byCost', 'equally', 'hybrid', 'strategic', 'volumeOptimized', 'customerTier'
  ];
  
  const results = {} as Record<LegacyDistributionMethod, CIFResult[]>;
  
  methods.forEach(method => {
    results[method] = calculateCIFByMethod(products, params, method);
  });
  
  return results;
}

// ================== Utility Functions ==================

export function verifyFreightAllocation(results: CIFResult[], expectedTotal: number, tolerance: number = 0.01): boolean {
  const actualTotal = results.reduce((sum, r) => sum + r.freightCost, 0);
  return Math.abs(actualTotal - expectedTotal) <= tolerance;
}

export function calculateProfitSummary(results: CIFResult[]): {
  totalCostUSD: number;
  totalFreightUSD: number;
  totalCIFUSD: number;
  totalCIFXCG: number;
  totalWholesaleMargin: number;
  totalRetailMargin: number;
  adjustmentsApplied: number;
} {
  let adjustmentsApplied = 0;
  
  const summary = results.reduce((acc, r) => {
    if (r.adjustmentApplied) adjustmentsApplied++;
    
    return {
      totalCostUSD: acc.totalCostUSD + r.costUSD,
      totalFreightUSD: acc.totalFreightUSD + r.freightCost,
      totalCIFUSD: acc.totalCIFUSD + r.cifUSD,
      totalCIFXCG: acc.totalCIFXCG + r.cifXCG,
      totalWholesaleMargin: acc.totalWholesaleMargin + (r.wholesaleMargin * r.quantity),
      totalRetailMargin: acc.totalRetailMargin + (r.retailMargin * r.quantity),
    };
  }, {
    totalCostUSD: 0,
    totalFreightUSD: 0,
    totalCIFUSD: 0,
    totalCIFXCG: 0,
    totalWholesaleMargin: 0,
    totalRetailMargin: 0,
  });

  return { ...summary, adjustmentsApplied };
}

export function determineLimitingFactor(
  totalActualWeight: number,
  totalVolumetricWeight: number
): 'actual' | 'volumetric' {
  return totalVolumetricWeight > totalActualWeight ? 'volumetric' : 'actual';
}

export function calculateTotalFreightFromRates(
  chargeableWeight: number,
  freightExteriorPerKg: number,
  freightLocalPerKg: number,
  localLogisticsUSD: number = DEFAULT_LOCAL_LOGISTICS_USD,
  bankChargesUSD: number = DEFAULT_BANK_CHARGES_USD
): number {
  const combinedTariff = freightExteriorPerKg + freightLocalPerKg;
  return (chargeableWeight * combinedTariff) + localLogisticsUSD + bankChargesUSD;
}

export function calculateTotalFreightFromActual(
  freightChampionCost: number,
  swissportCost: number,
  localLogisticsUSD: number = DEFAULT_LOCAL_LOGISTICS_USD,
  bankChargesUSD: number = DEFAULT_BANK_CHARGES_USD
): number {
  return freightChampionCost + swissportCost + localLogisticsUSD + bankChargesUSD;
}

/**
 * Get recommended blend ratio from learning patterns
 * Analyzes patterns to determine optimal weight vs cost blend
 */
export function getRecommendedBlendRatio(patterns: LearningAdjustment[]): number {
  if (!patterns.length) return DEFAULT_BLEND_RATIO;
  
  // Calculate weighted average adjustment factor
  const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
  if (totalConfidence === 0) return DEFAULT_BLEND_RATIO;
  
  const weightedAvgFactor = patterns.reduce(
    (sum, p) => sum + (p.adjustmentFactor * p.confidence),
    0
  ) / totalConfidence;
  
  // If historical data shows we're over-estimating (factor > 1), reduce weight allocation
  // If under-estimating (factor < 1), increase weight allocation
  const adjustedRatio = DEFAULT_BLEND_RATIO / weightedAvgFactor;
  
  // Clamp between 0.3 and 0.9
  return Math.max(0.3, Math.min(0.9, adjustedRatio));
}
