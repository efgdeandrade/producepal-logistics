/**
 * Pure CIF (Cost, Insurance, Freight) calculation functions
 * Extracted for testability and single source of truth across components
 * 
 * Used by:
 * - CIFCalculator.tsx (Estimate and Actual tabs)
 * - OrderCIFTable.tsx (Order details page)
 * - ActualCIFForm.tsx (Actual CIF entry form)
 */

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
}

export type DistributionMethod = 
  | 'byWeight' 
  | 'byCost' 
  | 'equally' 
  | 'hybrid' 
  | 'strategic' 
  | 'volumeOptimized' 
  | 'customerTier';

// ================== Constants ==================

export const DEFAULT_WHOLESALE_MULTIPLIER = 1.25;
export const DEFAULT_RETAIL_MULTIPLIER = 1.786;
export const DEFAULT_EXCHANGE_RATE = 1.82;
export const DEFAULT_LOCAL_LOGISTICS_USD = 91;
export const DEFAULT_LABOR_XCG = 50;
export const DEFAULT_BANK_CHARGES_USD = 0;

// ================== Helper Functions ==================

/**
 * Calculate totals for all products
 */
export function calculateTotals(products: CIFProductInput[]): {
  totalCost: number;
  totalWeight: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalFrequency: number;
  totalStrategicWeight: number;
  productCount: number;
} {
  let totalCost = 0;
  let totalActualWeight = 0;
  let totalVolumetricWeight = 0;
  let totalFrequency = 0;

  products.forEach(p => {
    totalCost += p.quantity * p.costPerUnit;
    totalActualWeight += p.actualWeight;
    totalVolumetricWeight += p.volumetricWeight;
    totalFrequency += p.orderFrequency || 0;
  });

  // Calculate total strategic weight for the strategic method
  const totalStrategicWeight = products.reduce((sum, p) => {
    const riskFactor = 1 + ((p.wasteRate || 0) / 100);
    const velocityFactor = 1 / Math.sqrt(p.orderFrequency || 1);
    return sum + (riskFactor * velocityFactor);
  }, 0);

  return {
    totalCost,
    totalWeight: Math.max(totalActualWeight, totalVolumetricWeight),
    totalActualWeight,
    totalVolumetricWeight,
    totalFrequency,
    totalStrategicWeight,
    productCount: products.length,
  };
}

/**
 * Get the weight to use for a product based on limiting factor
 */
export function getProductContribution(
  product: CIFProductInput,
  limitingFactor: 'actual' | 'volumetric'
): number {
  return limitingFactor === 'volumetric' 
    ? product.volumetricWeight 
    : product.actualWeight;
}

/**
 * Calculate freight share for a single product using the 'byWeight' method
 * Allocates freight proportional to the product's contribution to total chargeable weight
 */
export function calculateFreightByWeight(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  totalFreight: number,
  limitingFactor: 'actual' | 'volumetric'
): number {
  const totalChargeableWeight = Math.max(totals.totalActualWeight, totals.totalVolumetricWeight);
  if (totalChargeableWeight === 0) return 0;
  
  const productContribution = getProductContribution(product, limitingFactor);
  return (productContribution / totalChargeableWeight) * totalFreight;
}

/**
 * Calculate freight share for a single product using the 'byCost' method
 * Allocates freight proportional to the product's cost contribution
 */
export function calculateFreightByCost(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  totalFreight: number
): number {
  if (totals.totalCost === 0) return 0;
  const productCost = product.quantity * product.costPerUnit;
  return (productCost / totals.totalCost) * totalFreight;
}

/**
 * Calculate freight share for a single product using the 'equally' method
 * Distributes freight evenly across all products
 */
export function calculateFreightEqually(
  totalFreight: number,
  productCount: number
): number {
  if (productCount === 0) return 0;
  return totalFreight / productCount;
}

/**
 * Calculate freight share for a single product using the 'hybrid' method
 * 50% by weight + 50% by cost
 */
export function calculateFreightHybrid(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  totalFreight: number,
  limitingFactor: 'actual' | 'volumetric'
): number {
  const weightShare = calculateFreightByWeight(product, totals, totalFreight, limitingFactor);
  const costShare = calculateFreightByCost(product, totals, totalFreight);
  return (weightShare + costShare) / 2;
}

/**
 * Calculate freight share for a single product using the 'strategic' method
 * Risk-adjusted: Higher waste rate and lower velocity products get more freight
 */
export function calculateFreightStrategic(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  totalFreight: number
): number {
  if (totals.totalStrategicWeight === 0) {
    return totalFreight / totals.productCount;
  }
  
  const riskFactor = 1 + ((product.wasteRate || 0) / 100);
  const velocityFactor = 1 / Math.sqrt(product.orderFrequency || 1);
  const strategicWeight = riskFactor * velocityFactor;
  
  return (strategicWeight / totals.totalStrategicWeight) * totalFreight;
}

/**
 * Calculate freight share for a single product using the 'volumeOptimized' method
 * Higher frequency products get lower freight allocation
 */
export function calculateFreightVolumeOptimized(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  totalFreight: number
): number {
  if (totals.productCount === 0) return 0;
  
  const frequencyWeight = totals.totalFrequency > 0 
    ? ((product.orderFrequency || 0) / totals.totalFrequency) 
    : 1 / totals.productCount;
  
  // Invert the weight so higher frequency = lower freight
  const invertedWeight = 1 - (frequencyWeight / 2);
  return invertedWeight * (totalFreight / totals.productCount);
}

/**
 * Calculate freight share for a single product using the 'customerTier' method
 * Wholesale-heavy products (high frequency > 5) get 0.85x multiplier
 * Non-wholesale products get 1.15x multiplier
 */
export function calculateFreightCustomerTier(
  product: CIFProductInput,
  totalFreight: number,
  productCount: number
): number {
  if (productCount === 0) return 0;
  
  const isWholesaleHeavy = (product.orderFrequency || 0) > 5;
  const tierMultiplier = isWholesaleHeavy ? 0.85 : 1.15;
  const baseShare = totalFreight / productCount;
  
  return baseShare * tierMultiplier;
}

/**
 * Get freight share for a product using the specified distribution method
 */
export function getFreightShare(
  product: CIFProductInput,
  totals: ReturnType<typeof calculateTotals>,
  params: CIFParams,
  method: DistributionMethod
): number {
  switch (method) {
    case 'byWeight':
      return calculateFreightByWeight(product, totals, params.totalFreight, params.limitingFactor);
    case 'byCost':
      return calculateFreightByCost(product, totals, params.totalFreight);
    case 'equally':
      return calculateFreightEqually(params.totalFreight, totals.productCount);
    case 'hybrid':
      return calculateFreightHybrid(product, totals, params.totalFreight, params.limitingFactor);
    case 'strategic':
      return calculateFreightStrategic(product, totals, params.totalFreight);
    case 'volumeOptimized':
      return calculateFreightVolumeOptimized(product, totals, params.totalFreight);
    case 'customerTier':
      return calculateFreightCustomerTier(product, params.totalFreight, totals.productCount);
    default:
      return calculateFreightByWeight(product, totals, params.totalFreight, params.limitingFactor);
  }
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
 * Calculate CIF for all products using all distribution methods
 * Returns results keyed by method name
 */
export function calculateAllCIFMethods(
  products: CIFProductInput[],
  params: CIFParams
): Record<DistributionMethod, CIFResult[]> {
  const methods: DistributionMethod[] = [
    'byWeight', 'byCost', 'equally', 'hybrid', 'strategic', 'volumeOptimized', 'customerTier'
  ];
  
  const results: Record<DistributionMethod, CIFResult[]> = {} as Record<DistributionMethod, CIFResult[]>;
  
  methods.forEach(method => {
    results[method] = calculateCIFByMethod(products, params, method);
  });
  
  return results;
}

/**
 * Verify that freight shares sum to total freight (useful for validation)
 */
export function verifyFreightAllocation(results: CIFResult[], expectedTotal: number, tolerance: number = 0.01): boolean {
  const actualTotal = results.reduce((sum, r) => sum + r.freightCost, 0);
  return Math.abs(actualTotal - expectedTotal) <= tolerance;
}

/**
 * Calculate profit summary for a set of CIF results
 */
export function calculateProfitSummary(results: CIFResult[]): {
  totalCostUSD: number;
  totalFreightUSD: number;
  totalCIFUSD: number;
  totalCIFXCG: number;
  totalWholesaleMargin: number;
  totalRetailMargin: number;
} {
  return results.reduce((acc, r) => ({
    totalCostUSD: acc.totalCostUSD + r.costUSD,
    totalFreightUSD: acc.totalFreightUSD + r.freightCost,
    totalCIFUSD: acc.totalCIFUSD + r.cifUSD,
    totalCIFXCG: acc.totalCIFXCG + r.cifXCG,
    totalWholesaleMargin: acc.totalWholesaleMargin + (r.wholesaleMargin * r.quantity),
    totalRetailMargin: acc.totalRetailMargin + (r.retailMargin * r.quantity),
  }), {
    totalCostUSD: 0,
    totalFreightUSD: 0,
    totalCIFUSD: 0,
    totalCIFXCG: 0,
    totalWholesaleMargin: 0,
    totalRetailMargin: 0,
  });
}

/**
 * Determine limiting factor from weight totals
 */
export function determineLimitingFactor(
  totalActualWeight: number,
  totalVolumetricWeight: number
): 'actual' | 'volumetric' {
  return totalVolumetricWeight > totalActualWeight ? 'volumetric' : 'actual';
}

/**
 * Calculate total freight from rates and weight
 * Used for estimate mode in CIF Calculator
 */
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

/**
 * Calculate total freight from actual costs
 * Used for actual mode in CIF Calculator
 */
export function calculateTotalFreightFromActual(
  freightChampionCost: number,
  swissportCost: number,
  localLogisticsUSD: number = DEFAULT_LOCAL_LOGISTICS_USD,
  bankChargesUSD: number = DEFAULT_BANK_CHARGES_USD
): number {
  return freightChampionCost + swissportCost + localLogisticsUSD + bankChargesUSD;
}
