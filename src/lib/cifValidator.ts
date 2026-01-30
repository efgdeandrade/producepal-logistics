/**
 * CIF Input Validation Layer
 * 
 * Provides pre-calculation validation to ensure data integrity and prevent
 * calculation errors before they affect business decisions.
 * 
 * Used by: OrderCIFTable, ActualCIFForm, ImportOrderCIFView, CIFCalculator
 */

import type { CIFProductInput } from './cifCalculations';

// ================== Types ==================

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  field?: string;
  productCode?: string;
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  field?: string;
  productCode?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalProducts: number;
    productsWithIssues: number;
    hasBlockingErrors: boolean;
    hasMissingSuppliers: boolean;
    hasMissingWeights: boolean;
    hasNegativeValues: boolean;
  };
}

export interface ExchangeRateInfo {
  rate: number;
  lastUpdated?: string | Date;
  source?: string;
}

export interface CIFValidationInput {
  products: CIFProductInput[];
  totalFreight: number;
  exchangeRate: ExchangeRateInfo | number;
  limitingFactor?: 'actual' | 'volumetric';
}

// ================== Constants ==================

// Maximum age of exchange rate in hours before warning
export const EXCHANGE_RATE_MAX_AGE_HOURS = 24;

// Minimum sample size for learning adjustments
export const MIN_LEARNING_SAMPLE_SIZE = 5;

// Minimum confidence score for learning adjustments
export const MIN_LEARNING_CONFIDENCE = 60;

// Adjustment factor safety caps
export const ADJUSTMENT_FACTOR_MIN = 0.85;
export const ADJUSTMENT_FACTOR_MAX = 1.15;

// Anomaly detection threshold (25% variance)
export const ANOMALY_VARIANCE_THRESHOLD = 25;

// ================== Validation Functions ==================

/**
 * Validate a single product input
 */
export function validateProduct(product: CIFProductInput, index: number): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const code = product.productCode || `Product ${index + 1}`;

  // Critical: Supplier assignment
  if (!product.supplier || product.supplier === '' || product.supplier === 'Unknown Supplier') {
    errors.push({
      type: 'error',
      code: 'MISSING_SUPPLIER',
      message: `${code}: No supplier assigned. CIF cannot be calculated accurately.`,
      productCode: code,
      field: 'supplier'
    });
  }

  // Critical: Weight data
  const hasActualWeight = product.actualWeight > 0;
  const hasVolumetricWeight = product.volumetricWeight > 0;
  
  if (!hasActualWeight && !hasVolumetricWeight) {
    errors.push({
      type: 'error',
      code: 'MISSING_WEIGHT',
      message: `${code}: No weight data. Both actual and volumetric weights are zero or missing.`,
      productCode: code,
      field: 'weight'
    });
  }

  // Critical: Quantity
  if (!product.quantity || product.quantity <= 0) {
    errors.push({
      type: 'error',
      code: 'INVALID_QUANTITY',
      message: `${code}: Invalid quantity (${product.quantity}). Must be greater than 0.`,
      productCode: code,
      field: 'quantity'
    });
  }

  // Warning: Cost per unit
  if (product.costPerUnit < 0) {
    errors.push({
      type: 'error',
      code: 'NEGATIVE_COST',
      message: `${code}: Negative cost per unit ($${product.costPerUnit}).`,
      productCode: code,
      field: 'costPerUnit'
    });
  } else if (product.costPerUnit === 0) {
    warnings.push({
      type: 'warning',
      code: 'ZERO_COST',
      message: `${code}: Cost per unit is $0. This may affect CIF accuracy.`,
      productCode: code,
      field: 'costPerUnit'
    });
  }

  // Warning: Volumetric significantly different from actual
  if (hasActualWeight && hasVolumetricWeight) {
    const volumetricRatio = product.volumetricWeight / product.actualWeight;
    if (volumetricRatio > 2) {
      warnings.push({
        type: 'warning',
        code: 'HIGH_VOLUMETRIC_RATIO',
        message: `${code}: Volumetric weight is ${volumetricRatio.toFixed(1)}x actual weight. Verify dimensions.`,
        productCode: code,
        field: 'volumetricWeight'
      });
    }
  }

  // Warning: Missing pricing data
  if (!product.wholesalePriceXCG && !product.retailPriceXCG) {
    warnings.push({
      type: 'warning',
      code: 'MISSING_PRICES',
      message: `${code}: No wholesale/retail prices set. Default multipliers will be used.`,
      productCode: code,
      field: 'pricing'
    });
  }

  return { errors, warnings };
}

/**
 * Validate order-level parameters
 */
export function validateOrderParams(
  products: CIFProductInput[],
  totalFreight: number,
  exchangeRate: ExchangeRateInfo | number
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for import items
  if (!products || products.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_PRODUCTS',
      message: 'No import items found. CIF calculation requires at least one product.',
      field: 'products'
    });
  }

  // Check for duplicate product codes
  const productCodes = products.map(p => p.productCode);
  const duplicates = productCodes.filter((code, index) => productCodes.indexOf(code) !== index);
  if (duplicates.length > 0) {
    warnings.push({
      type: 'warning',
      code: 'DUPLICATE_PRODUCTS',
      message: `Duplicate product codes found: ${[...new Set(duplicates)].join(', ')}. Products will be consolidated.`,
      field: 'products'
    });
  }

  // Validate total freight
  if (totalFreight <= 0) {
    errors.push({
      type: 'error',
      code: 'INVALID_FREIGHT',
      message: `Total freight must be positive. Current value: $${totalFreight}`,
      field: 'totalFreight'
    });
  }

  // Validate exchange rate
  const rate = typeof exchangeRate === 'number' ? exchangeRate : exchangeRate.rate;
  
  if (rate <= 0) {
    errors.push({
      type: 'error',
      code: 'INVALID_EXCHANGE_RATE',
      message: `Exchange rate must be positive. Current value: ${rate}`,
      field: 'exchangeRate'
    });
  } else if (rate > 10) {
    warnings.push({
      type: 'warning',
      code: 'HIGH_EXCHANGE_RATE',
      message: `Exchange rate (${rate}) seems unusually high. Please verify.`,
      field: 'exchangeRate'
    });
  }

  // Check exchange rate staleness
  if (typeof exchangeRate === 'object' && exchangeRate.lastUpdated) {
    const lastUpdated = new Date(exchangeRate.lastUpdated);
    const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    if (ageHours > EXCHANGE_RATE_MAX_AGE_HOURS) {
      warnings.push({
        type: 'warning',
        code: 'STALE_EXCHANGE_RATE',
        message: `Exchange rate was last updated ${Math.round(ageHours)} hours ago. Consider refreshing.`,
        field: 'exchangeRate'
      });
    }
  }

  return { errors, warnings };
}

/**
 * Main validation function - validates all inputs before CIF calculation
 */
export function validateCIFInput(input: CIFValidationInput): ValidationResult {
  const { products, totalFreight, exchangeRate } = input;
  
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  let productsWithIssues = 0;
  let hasMissingSuppliers = false;
  let hasMissingWeights = false;
  let hasNegativeValues = false;

  // Validate order-level params
  const orderValidation = validateOrderParams(products, totalFreight, exchangeRate);
  allErrors.push(...orderValidation.errors);
  allWarnings.push(...orderValidation.warnings);

  // Validate each product
  products.forEach((product, index) => {
    const { errors, warnings } = validateProduct(product, index);
    
    if (errors.length > 0 || warnings.length > 0) {
      productsWithIssues++;
    }
    
    // Track specific issue types
    if (errors.some(e => e.code === 'MISSING_SUPPLIER')) {
      hasMissingSuppliers = true;
    }
    if (errors.some(e => e.code === 'MISSING_WEIGHT')) {
      hasMissingWeights = true;
    }
    if (errors.some(e => e.code === 'NEGATIVE_COST')) {
      hasNegativeValues = true;
    }
    
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  });

  const hasBlockingErrors = allErrors.length > 0;

  return {
    valid: !hasBlockingErrors,
    errors: allErrors,
    warnings: allWarnings,
    summary: {
      totalProducts: products.length,
      productsWithIssues,
      hasBlockingErrors,
      hasMissingSuppliers,
      hasMissingWeights,
      hasNegativeValues
    }
  };
}

// ================== Freight Verification ==================

/**
 * Verify that freight allocation sums to total (checksum)
 */
export function verifyFreightAllocation(
  allocatedFreights: number[],
  totalFreight: number,
  tolerance: number = 0.01
): {
  valid: boolean;
  allocatedTotal: number;
  difference: number;
  percentageDifference: number;
} {
  const allocatedTotal = allocatedFreights.reduce((sum, f) => sum + f, 0);
  const difference = Math.abs(allocatedTotal - totalFreight);
  const percentageDifference = totalFreight > 0 
    ? (difference / totalFreight) * 100 
    : 0;

  return {
    valid: difference <= tolerance,
    allocatedTotal,
    difference,
    percentageDifference
  };
}

// ================== Margin Verification ==================

export interface MarginIssue {
  productCode: string;
  productName: string;
  type: 'negative_wholesale' | 'negative_retail' | 'below_target_wholesale' | 'below_target_retail';
  margin: number;
  target?: number;
  severity: 'error' | 'warning';
}

/**
 * Check for margin consistency issues
 */
export function verifyMargins(
  results: Array<{
    productCode: string;
    productName: string;
    cifPerUnit: number;
    wholesalePrice: number;
    retailPrice: number;
  }>,
  targetWholesaleMarginPercent: number = 10,
  targetRetailMarginPercent: number = 44
): MarginIssue[] {
  const issues: MarginIssue[] = [];

  results.forEach(result => {
    const wholesaleMargin = result.wholesalePrice - result.cifPerUnit;
    const retailMargin = result.retailPrice - result.cifPerUnit;
    
    const wholesaleMarginPercent = result.cifPerUnit > 0 
      ? ((wholesaleMargin) / result.cifPerUnit) * 100 
      : 0;
    const retailMarginPercent = result.cifPerUnit > 0 
      ? ((retailMargin) / result.cifPerUnit) * 100 
      : 0;

    // Negative margins are errors
    if (wholesaleMargin < 0) {
      issues.push({
        productCode: result.productCode,
        productName: result.productName,
        type: 'negative_wholesale',
        margin: wholesaleMarginPercent,
        severity: 'error'
      });
    } else if (wholesaleMarginPercent < targetWholesaleMarginPercent) {
      issues.push({
        productCode: result.productCode,
        productName: result.productName,
        type: 'below_target_wholesale',
        margin: wholesaleMarginPercent,
        target: targetWholesaleMarginPercent,
        severity: 'warning'
      });
    }

    if (retailMargin < 0) {
      issues.push({
        productCode: result.productCode,
        productName: result.productName,
        type: 'negative_retail',
        margin: retailMarginPercent,
        severity: 'error'
      });
    } else if (retailMarginPercent < targetRetailMarginPercent * 0.5) {
      // Warning if retail margin is less than 50% of target
      issues.push({
        productCode: result.productCode,
        productName: result.productName,
        type: 'below_target_retail',
        margin: retailMarginPercent,
        target: targetRetailMarginPercent,
        severity: 'warning'
      });
    }
  });

  return issues;
}

// ================== Learning Adjustment Safety ==================

export interface LearningAdjustmentSafe {
  adjustmentFactor: number;
  originalFactor: number;
  wasCapped: boolean;
  cappedDirection?: 'min' | 'max';
  confidence: number;
  sampleSize: number;
  isApplicable: boolean;
  reason?: string;
}

/**
 * Apply safety caps to learning adjustment factor
 */
export function safeAdjustmentFactor(
  adjustmentFactor: number,
  confidence: number,
  sampleSize: number
): LearningAdjustmentSafe {
  // Check minimum requirements
  if (sampleSize < MIN_LEARNING_SAMPLE_SIZE) {
    return {
      adjustmentFactor: 1.0,
      originalFactor: adjustmentFactor,
      wasCapped: false,
      confidence,
      sampleSize,
      isApplicable: false,
      reason: `Insufficient sample size (${sampleSize}/${MIN_LEARNING_SAMPLE_SIZE} required)`
    };
  }

  if (confidence < MIN_LEARNING_CONFIDENCE) {
    return {
      adjustmentFactor: 1.0,
      originalFactor: adjustmentFactor,
      wasCapped: false,
      confidence,
      sampleSize,
      isApplicable: false,
      reason: `Confidence too low (${confidence.toFixed(0)}%/${MIN_LEARNING_CONFIDENCE}% required)`
    };
  }

  // Apply safety caps
  let cappedFactor = adjustmentFactor;
  let wasCapped = false;
  let cappedDirection: 'min' | 'max' | undefined;

  if (adjustmentFactor < ADJUSTMENT_FACTOR_MIN) {
    cappedFactor = ADJUSTMENT_FACTOR_MIN;
    wasCapped = true;
    cappedDirection = 'min';
  } else if (adjustmentFactor > ADJUSTMENT_FACTOR_MAX) {
    cappedFactor = ADJUSTMENT_FACTOR_MAX;
    wasCapped = true;
    cappedDirection = 'max';
  }

  return {
    adjustmentFactor: cappedFactor,
    originalFactor: adjustmentFactor,
    wasCapped,
    cappedDirection,
    confidence,
    sampleSize,
    isApplicable: true
  };
}

/**
 * Check if variance qualifies as anomaly (should be excluded from learning)
 */
export function isAnomalyVariance(variancePercent: number): boolean {
  return Math.abs(variancePercent) > ANOMALY_VARIANCE_THRESHOLD;
}

// ================== Summary Helpers ==================

/**
 * Format validation result for display
 */
export function formatValidationSummary(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return `✓ All ${result.summary.totalProducts} products validated successfully`;
  }

  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ') + ` in ${result.summary.productsWithIssues} of ${result.summary.totalProducts} products`;
}
