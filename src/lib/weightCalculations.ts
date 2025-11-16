/**
 * Weight Calculation Utilities
 * Following the correct formulas for CIF weight calculations
 */

export interface ProductWeightInfo {
  code: string;
  name: string;
  nettoWeightPerUnit: number;       // (A) Net weight per unit
  grossWeightPerUnit: number;       // (B) Gross weight per unit (includes unit packaging)
  packSize: number;                 // (C) Units per case/tray
  emptyCaseWeight: number;          // (E) Empty case weight
  lengthCm: number;                 // (D) Case dimensions
  widthCm: number;
  heightCm: number;
  quantity: number;                 // Total units ordered
}

export interface PalletConfig {
  baseWeightKg: number;             // (F) Empty pallet weight = 25kg
  lengthCm: number;                 // (G) 120cm
  widthCm: number;                  // (G) 80cm
  heightCm: number;                 // (G) 14.4cm
  maxCargoHeightCm: number;         // (H) 155cm (max total height allowed)
}

export const STANDARD_EUROPALLET: PalletConfig = {
  baseWeightKg: 25,
  lengthCm: 120,
  widthCm: 80,
  heightCm: 14.4,
  maxCargoHeightCm: 155
};

const VOLUMETRIC_DIVISOR = 6000; // Standard air freight volumetric divisor

/**
 * Calculate actual weight per unit
 * Uses gross weight if available, otherwise falls back to netto weight
 */
export function calculateActualWeightPerUnit(product: ProductWeightInfo): number {
  return product.grossWeightPerUnit > 0 
    ? product.grossWeightPerUnit 
    : product.nettoWeightPerUnit;
}

/**
 * Calculate actual weight per case/tray
 * Formula: (Gross or Netto weight per unit × Units per case) + Empty case weight
 */
export function calculateActualWeightPerCase(product: ProductWeightInfo): number {
  const weightPerUnit = calculateActualWeightPerUnit(product);
  return (weightPerUnit * product.packSize) + product.emptyCaseWeight;
}

/**
 * Calculate volumetric weight per case
 * Formula: (Length × Width × Height) / 6000
 */
export function calculateVolumetricWeightPerCase(product: ProductWeightInfo): number {
  if (!product.lengthCm || !product.widthCm || !product.heightCm) {
    return 0;
  }
  return (product.lengthCm * product.widthCm * product.heightCm) / VOLUMETRIC_DIVISOR;
}

/**
 * Calculate volumetric weight per unit
 * Formula: Volumetric weight per case / Units per case
 */
export function calculateVolumetricWeightPerUnit(product: ProductWeightInfo): number {
  const volumetricPerCase = calculateVolumetricWeightPerCase(product);
  return volumetricPerCase / product.packSize;
}

/**
 * Calculate chargeable weight per case
 * Formula: MAX(Actual weight per case, Volumetric weight per case)
 */
export function calculateChargeableWeightPerCase(product: ProductWeightInfo): number {
  const actualWeight = calculateActualWeightPerCase(product);
  const volumetricWeight = calculateVolumetricWeightPerCase(product);
  return Math.max(actualWeight, volumetricWeight);
}

/**
 * Calculate total weights for an order
 */
export function calculateOrderWeights(products: ProductWeightInfo[]): {
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  totalCases: number;
} {
  let totalActualWeight = 0;
  let totalVolumetricWeight = 0;
  let totalChargeableWeight = 0;
  let totalCases = 0;

  products.forEach(product => {
    const cases = Math.ceil(product.quantity / product.packSize);
    totalCases += cases;
    
    const actualPerCase = calculateActualWeightPerCase(product);
    const volumetricPerCase = calculateVolumetricWeightPerCase(product);
    const chargeablePerCase = Math.max(actualPerCase, volumetricPerCase);
    
    totalActualWeight += actualPerCase * cases;
    totalVolumetricWeight += volumetricPerCase * cases;
    totalChargeableWeight += chargeablePerCase * cases;
  });

  return {
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    totalCases
  };
}

/**
 * Simple pallet calculation based on weight
 * Estimates number of pallets needed assuming ~500kg per pallet capacity
 */
export function estimatePalletsFromWeight(totalWeightKg: number, avgWeightPerPallet: number = 500): number {
  return Math.ceil(totalWeightKg / avgWeightPerPallet);
}

/**
 * Calculate pallet configuration with 3D bin packing
 * Groups products by supplier (no mixing allowed)
 * Returns detailed pallet configuration
 */
export interface PalletLayerInfo {
  casesPerLayer: number;
  layersPerPallet: number;
  totalCasesPerPallet: number;
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
  layerInfo?: PalletLayerInfo;
}

/**
 * Calculate optimal pallet configuration for a supplier's products
 * This is a simplified version - for complex 3D bin packing, use AI optimizer
 */
export function calculateSupplierPalletConfig(
  supplierId: string,
  supplierName: string,
  products: ProductWeightInfo[],
  palletConfig: PalletConfig = STANDARD_EUROPALLET
): SupplierPalletConfig {
  const orderWeights = calculateOrderWeights(products);
  
  // Calculate available cargo height (max height - pallet base height)
  const availableCargoHeight = palletConfig.maxCargoHeightCm - palletConfig.heightCm;
  
  // Simple estimation: assume average case dimensions and stack vertically
  const avgCaseHeight = products.reduce((sum, p) => sum + (p.heightCm || 0), 0) / products.length;
  const maxLayers = avgCaseHeight > 0 ? Math.floor(availableCargoHeight / avgCaseHeight) : 1;
  
  // Estimate pallets needed (simple weight-based for now)
  const palletsFromWeight = estimatePalletsFromWeight(orderWeights.totalChargeableWeight, 500);
  
  // Include pallet weight in total
  const totalActualWeight = orderWeights.totalActualWeight + (palletsFromWeight * palletConfig.baseWeightKg);
  const totalVolumetricWeight = orderWeights.totalVolumetricWeight;
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
  
  // Determine limiting factor
  const weightGap = totalVolumetricWeight - totalActualWeight;
  const gapPercentage = totalActualWeight > 0 ? Math.abs(weightGap / totalActualWeight) : 0;
  
  let limitingFactor: 'weight' | 'volume' | 'balanced';
  if (gapPercentage < 0.1) {
    limitingFactor = 'balanced';
  } else if (weightGap > 0) {
    limitingFactor = 'volume';
  } else {
    limitingFactor = 'weight';
  }
  
  // Calculate utilization (simplified)
  const idealWeight = palletsFromWeight * 500;
  const utilizationPct = (totalChargeableWeight / idealWeight) * 100;
  
  return {
    supplierId,
    supplierName,
    products,
    pallets: palletsFromWeight,
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    utilizationPct: Math.min(utilizationPct, 100),
    limitingFactor
  };
}

/**
 * Calculate pallet configuration for entire order
 * Groups by supplier automatically
 */
export interface OrderPalletConfig {
  totalPallets: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  overallUtilization: number;
  supplierConfigs: SupplierPalletConfig[];
}

export function calculateOrderPalletConfig(
  products: Array<ProductWeightInfo & { supplierId: string; supplierName: string }>
): OrderPalletConfig {
  // Group products by supplier
  const supplierGroups = new Map<string, ProductWeightInfo[]>();
  const supplierNames = new Map<string, string>();
  
  products.forEach(product => {
    if (!supplierGroups.has(product.supplierId)) {
      supplierGroups.set(product.supplierId, []);
      supplierNames.set(product.supplierId, product.supplierName);
    }
    supplierGroups.get(product.supplierId)!.push(product);
  });
  
  // Calculate config for each supplier
  const supplierConfigs: SupplierPalletConfig[] = [];
  let totalPallets = 0;
  let totalActualWeight = 0;
  let totalVolumetricWeight = 0;
  let totalChargeableWeight = 0;
  
  supplierGroups.forEach((products, supplierId) => {
    const config = calculateSupplierPalletConfig(
      supplierId,
      supplierNames.get(supplierId)!,
      products
    );
    supplierConfigs.push(config);
    
    totalPallets += config.pallets;
    totalActualWeight += config.totalActualWeight;
    totalVolumetricWeight += config.totalVolumetricWeight;
    totalChargeableWeight += config.totalChargeableWeight;
  });
  
  const idealWeight = totalPallets * 500;
  const overallUtilization = (totalChargeableWeight / idealWeight) * 100;
  
  return {
    totalPallets,
    totalActualWeight,
    totalVolumetricWeight,
    totalChargeableWeight,
    overallUtilization: Math.min(overallUtilization, 100),
    supplierConfigs
  };
}
