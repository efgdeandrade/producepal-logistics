/**
 * Weight calculation utilities for freight and CIF estimation
 * Follows CIF (Cost, Insurance, Freight) weight calculation principles
 */

// Data Structures
export interface ProductWeightInfo {
  code: string;
  name: string;
  quantity: number; // number of units
  packSize: number; // units per case
  netWeightPerUnit?: number; // grams
  grossWeightPerUnit?: number; // grams
  emptyCaseWeight?: number; // grams
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  supplierId?: string;
  supplierName?: string;
}

export interface PalletConfig {
  baseWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number; // pallet height
  maxCargoHeightCm: number; // total height limit (pallet + cargo)
}

// Standard Euro Pallet Configuration - FIXED: 26kg weight
export const STANDARD_EUROPALLET: PalletConfig = {
  baseWeightKg: 26,  // Standardized pallet weight
  lengthCm: 120,
  widthCm: 80,
  heightCm: 14.4,
  maxCargoHeightCm: 155  // Total height limit
};

// Calculate pallet volumetric weight
export const PALLET_VOLUMETRIC_WEIGHT_KG = 
  (STANDARD_EUROPALLET.lengthCm * STANDARD_EUROPALLET.widthCm * STANDARD_EUROPALLET.heightCm) / 6000;
// = 120 × 80 × 14.4 / 6000 = 2.304 kg

/**
 * Calculate actual weight per unit (preferring gross over net)
 */
export function calculateActualWeightPerUnit(product: ProductWeightInfo): number {
  return (product.grossWeightPerUnit || product.netWeightPerUnit || 0);
}

/**
 * Calculate actual weight per case (product weight + empty case weight)
 */
export function calculateActualWeightPerCase(product: ProductWeightInfo): number {
  const weightPerUnit = calculateActualWeightPerUnit(product);
  const totalProductWeight = weightPerUnit * product.packSize;
  const caseWeight = product.emptyCaseWeight || 0;
  return totalProductWeight + caseWeight;
}

/**
 * Calculate volumetric weight per case
 * Formula: (L × W × H) / 6000 for cm and kg
 */
export function calculateVolumetricWeightPerCase(product: ProductWeightInfo): number {
  if (!product.lengthCm || !product.widthCm || !product.heightCm) {
    return 0;
  }
  return (product.lengthCm * product.widthCm * product.heightCm) / 6000;
}

/**
 * Calculate volumetric weight per unit
 */
export function calculateVolumetricWeightPerUnit(product: ProductWeightInfo): number {
  if (product.packSize <= 0) return 0;
  return calculateVolumetricWeightPerCase(product) / product.packSize;
}

/**
 * Calculate weights for an entire order (without pallets)
 */
export function calculateOrderWeights(products: ProductWeightInfo[]): {
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  totalCases: number;
  limitingFactor: 'actual' | 'volumetric';
} {
  let totalActualWeight = 0;
  let totalVolumetricWeight = 0;
  let totalCases = 0;

  products.forEach(product => {
    const cases = Math.ceil(product.quantity / product.packSize);
    totalCases += cases;

    const actualPerCase = calculateActualWeightPerCase(product);
    const volumetricPerCase = calculateVolumetricWeightPerCase(product);

    totalActualWeight += (actualPerCase * cases) / 1000; // Convert to kg
    totalVolumetricWeight += (volumetricPerCase * cases) / 1000; // Convert to kg
  });

  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
  const limitingFactor = totalVolumetricWeight > totalActualWeight ? 'volumetric' : 'actual';

  return {
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    totalCases,
    limitingFactor
  };
}

/**
 * Calculate how many cases fit on a pallet based on dimensions
 * @param caseLengthCm Case length
 * @param caseWidthCm Case width
 * @param caseHeightCm Case height
 * @param palletConfig Pallet configuration
 * @param supplierCasesPerPallet Manual override from supplier config
 * @returns Number of cases that fit on one pallet
 */
export function calculateCasesPerPallet(
  caseLengthCm: number,
  caseWidthCm: number,
  caseHeightCm: number,
  palletConfig: PalletConfig = STANDARD_EUROPALLET,
  supplierCasesPerPallet?: number
): number {
  // If supplier has manual configuration, use it
  if (supplierCasesPerPallet && supplierCasesPerPallet > 0) {
    return supplierCasesPerPallet;
  }

  // Validate dimensions
  if (!caseLengthCm || !caseWidthCm || !caseHeightCm || 
      caseLengthCm <= 0 || caseWidthCm <= 0 || caseHeightCm <= 0) {
    return 0;
  }

  // Calculate available cargo height
  const availableHeight = palletConfig.maxCargoHeightCm - palletConfig.heightCm; // 155 - 14.4 = 140.6cm

  // Calculate how many layers can fit vertically
  const maxLayers = Math.floor(availableHeight / caseHeightCm);
  if (maxLayers <= 0) return 0;

  // Calculate horizontal placement (try both orientations for best fit)
  // Pattern 1: Length along pallet length
  const casesAlongLength1 = Math.floor(palletConfig.lengthCm / caseLengthCm);
  const casesAlongWidth1 = Math.floor(palletConfig.widthCm / caseWidthCm);
  const casesPerLayer1 = casesAlongLength1 * casesAlongWidth1;

  // Pattern 2: Length along pallet width (rotated)
  const casesAlongLength2 = Math.floor(palletConfig.lengthCm / caseWidthCm);
  const casesAlongWidth2 = Math.floor(palletConfig.widthCm / caseLengthCm);
  const casesPerLayer2 = casesAlongLength2 * casesAlongWidth2;

  // Use the better orientation
  const casesPerLayer = Math.max(casesPerLayer1, casesPerLayer2);
  if (casesPerLayer <= 0) return 0;

  // Total cases = cases per layer × number of layers
  return casesPerLayer * maxLayers;
}

/**
 * Estimate pallets needed from weight (fallback method)
 */
export function estimatePalletsFromWeight(totalWeightKg: number, avgWeightPerPallet: number = 500): number {
  return Math.ceil(totalWeightKg / avgWeightPerPallet);
}

export interface SupplierPalletConfig {
  supplierId: string;
  supplierName: string;
  products: ProductWeightInfo[];
  pallets: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  utilizationPct: number;
  limitingFactor: 'weight' | 'volume' | 'balanced';
}

/**
 * Calculate pallet configuration for a single supplier
 * Now includes pallet weights in calculations
 */
export function calculateSupplierPalletConfig(
  supplierId: string,
  supplierName: string,
  products: ProductWeightInfo[],
  palletConfig: PalletConfig = STANDARD_EUROPALLET,
  supplierCasesPerPallet?: number
): SupplierPalletConfig {
  
  // Step 1: Calculate product weights (WITHOUT pallets first)
  let totalProductActualWeight = 0;
  let totalProductVolumetricWeight = 0;
  let totalCases = 0;

  products.forEach(product => {
    const cases = Math.ceil(product.quantity / product.packSize);
    totalCases += cases;
    
    const actualPerCase = calculateActualWeightPerCase(product);
    const volumetricPerCase = calculateVolumetricWeightPerCase(product);
    
    totalProductActualWeight += (actualPerCase * cases) / 1000; // kg
    totalProductVolumetricWeight += (volumetricPerCase * cases) / 1000; // kg
  });

  // Step 2: Calculate pallets needed based on DIMENSIONS (not just weight)
  let totalPalletsNeeded = 0;

  // Find the most common case dimensions in this supplier's products
  const productsWithDimensions = products.filter(p => 
    p.lengthCm && p.widthCm && p.heightCm && 
    p.lengthCm > 0 && p.widthCm > 0 && p.heightCm > 0
  );

  if (productsWithDimensions.length > 0) {
    // Use first product's dimensions as representative
    const representativeProduct = productsWithDimensions[0];
    
    const casesPerPallet = calculateCasesPerPallet(
      representativeProduct.lengthCm!,
      representativeProduct.widthCm!,
      representativeProduct.heightCm!,
      palletConfig,
      supplierCasesPerPallet
    );

    if (casesPerPallet > 0) {
      totalPalletsNeeded = Math.ceil(totalCases / casesPerPallet);
    } else {
      // Fallback: use weight-based estimation
      totalPalletsNeeded = estimatePalletsFromWeight(totalProductActualWeight);
    }
  } else {
    // No dimensions: fallback to weight
    totalPalletsNeeded = estimatePalletsFromWeight(totalProductActualWeight);
  }

  // Ensure at least 1 pallet if there are any products
  if (totalPalletsNeeded === 0 && products.length > 0) {
    totalPalletsNeeded = 1;
  }

  // Step 3: Calculate pallet weights
  const palletActualWeight = totalPalletsNeeded * palletConfig.baseWeightKg; // 26kg each
  const palletVolumetricWeight = totalPalletsNeeded * PALLET_VOLUMETRIC_WEIGHT_KG; // 2.304kg each

  // Step 4: Calculate TOTAL weights (Products + Pallets)
  const totalActualWeight = totalProductActualWeight + palletActualWeight;
  const totalVolumetricWeight = totalProductVolumetricWeight + palletVolumetricWeight;

  // Step 5: Calculate CHARGEABLE weight (MAX of totals)
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

  // Step 6: Determine limiting factor
  const limitingFactor: 'weight' | 'volume' | 'balanced' = 
    totalVolumetricWeight > totalActualWeight + 10 ? 'volume' :
    totalActualWeight > totalVolumetricWeight + 10 ? 'weight' : 'balanced';

  // Step 7: Calculate utilization
  const maxPalletWeight = totalPalletsNeeded * 500; // Assuming 500kg max per pallet
  const utilizationPct = maxPalletWeight > 0 ? (totalChargeableWeight / maxPalletWeight) * 100 : 0;

  return {
    supplierId,
    supplierName,
    products,
    pallets: totalPalletsNeeded,
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    utilizationPct: Math.min(utilizationPct, 100),
    limitingFactor
  };
}

export interface OrderPalletConfig {
  totalPallets: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  overallUtilization: number;
  supplierConfigs: SupplierPalletConfig[];
}

/**
 * Calculate pallet configuration for entire order (grouped by supplier)
 * Now includes pallet weights in all calculations
 */
export function calculateOrderPalletConfig(
  products: Array<ProductWeightInfo & { supplierId: string; supplierName: string; supplierCasesPerPallet?: number }>
): OrderPalletConfig {
  // Group products by supplier
  const supplierGroups = new Map<string, ProductWeightInfo[]>();
  const supplierNames = new Map<string, string>();
  const supplierCasesPerPalletMap = new Map<string, number>();
  
  products.forEach(product => {
    if (!supplierGroups.has(product.supplierId)) {
      supplierGroups.set(product.supplierId, []);
      supplierNames.set(product.supplierId, product.supplierName);
      if (product.supplierCasesPerPallet) {
        supplierCasesPerPalletMap.set(product.supplierId, product.supplierCasesPerPallet);
      }
    }
    supplierGroups.get(product.supplierId)!.push(product);
  });

  // Calculate config for each supplier
  const supplierConfigs: SupplierPalletConfig[] = [];
  supplierGroups.forEach((supplierProducts, supplierId) => {
    const config = calculateSupplierPalletConfig(
      supplierId,
      supplierNames.get(supplierId) || 'Unknown',
      supplierProducts,
      STANDARD_EUROPALLET,
      supplierCasesPerPalletMap.get(supplierId)
    );
    supplierConfigs.push(config);
  });

  // Aggregate totals (sum across suppliers)
  const totalPallets = supplierConfigs.reduce((sum, config) => sum + config.pallets, 0);
  const totalActualWeight = supplierConfigs.reduce((sum, config) => sum + config.totalActualWeight, 0);
  const totalVolumetricWeight = supplierConfigs.reduce((sum, config) => sum + config.totalVolumetricWeight, 0);
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

  const maxCapacity = totalPallets * 500;
  const overallUtilization = maxCapacity > 0 ? (totalChargeableWeight / maxCapacity) * 100 : 0;

  return {
    totalPallets,
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    overallUtilization: Math.min(overallUtilization, 100),
    supplierConfigs
  };
}
