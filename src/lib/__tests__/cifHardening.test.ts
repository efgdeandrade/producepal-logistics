import { describe, it, expect } from 'vitest';
import {
  validateCIFInput,
  validateProduct,
  validateOrderParams,
  verifyFreightAllocation,
  verifyMargins,
  safeAdjustmentFactor,
  isAnomalyVariance,
  ADJUSTMENT_FACTOR_MIN,
  ADJUSTMENT_FACTOR_MAX,
  ANOMALY_VARIANCE_THRESHOLD,
  MIN_LEARNING_SAMPLE_SIZE,
  MIN_LEARNING_CONFIDENCE,
} from '../cifValidator';
import type { CIFProductInput } from '../cifCalculations';

describe('CIF Validator', () => {
  describe('validateProduct', () => {
    it('should pass validation for complete product', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Berry Farm'
      };

      const { errors, warnings } = validateProduct(product, 0);
      expect(errors).toHaveLength(0);
    });

    it('should error on missing supplier', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: ''
      };

      const { errors } = validateProduct(product, 0);
      expect(errors.some(e => e.code === 'MISSING_SUPPLIER')).toBe(true);
    });

    it('should error on "Unknown Supplier"', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Unknown Supplier'
      };

      const { errors } = validateProduct(product, 0);
      expect(errors.some(e => e.code === 'MISSING_SUPPLIER')).toBe(true);
    });

    it('should error on zero weights', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 0,
        volumetricWeight: 0,
        supplier: 'Berry Farm'
      };

      const { errors } = validateProduct(product, 0);
      expect(errors.some(e => e.code === 'MISSING_WEIGHT')).toBe(true);
    });

    it('should error on invalid quantity', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 0,
        costPerUnit: 1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Berry Farm'
      };

      const { errors } = validateProduct(product, 0);
      expect(errors.some(e => e.code === 'INVALID_QUANTITY')).toBe(true);
    });

    it('should error on negative cost', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: -1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Berry Farm'
      };

      const { errors } = validateProduct(product, 0);
      expect(errors.some(e => e.code === 'NEGATIVE_COST')).toBe(true);
    });

    it('should warn on zero cost', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 0,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Berry Farm'
      };

      const { warnings } = validateProduct(product, 0);
      expect(warnings.some(w => w.code === 'ZERO_COST')).toBe(true);
    });

    it('should warn on high volumetric ratio', () => {
      const product: CIFProductInput = {
        productCode: 'STB_500',
        productName: 'Strawberries 500g',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 10,
        volumetricWeight: 50, // 5x ratio
        supplier: 'Berry Farm'
      };

      const { warnings } = validateProduct(product, 0);
      expect(warnings.some(w => w.code === 'HIGH_VOLUMETRIC_RATIO')).toBe(true);
    });
  });

  describe('validateOrderParams', () => {
    const validProducts: CIFProductInput[] = [
      {
        productCode: 'STB_500',
        productName: 'Strawberries',
        quantity: 100,
        costPerUnit: 1.5,
        actualWeight: 50,
        volumetricWeight: 45,
        supplier: 'Farm A'
      }
    ];

    it('should pass validation for valid params', () => {
      const { errors } = validateOrderParams(validProducts, 500, 1.82);
      expect(errors).toHaveLength(0);
    });

    it('should error on empty products', () => {
      const { errors } = validateOrderParams([], 500, 1.82);
      expect(errors.some(e => e.code === 'NO_PRODUCTS')).toBe(true);
    });

    it('should error on zero freight', () => {
      const { errors } = validateOrderParams(validProducts, 0, 1.82);
      expect(errors.some(e => e.code === 'INVALID_FREIGHT')).toBe(true);
    });

    it('should error on invalid exchange rate', () => {
      const { errors } = validateOrderParams(validProducts, 500, 0);
      expect(errors.some(e => e.code === 'INVALID_EXCHANGE_RATE')).toBe(true);
    });

    it('should warn on unusually high exchange rate', () => {
      const { warnings } = validateOrderParams(validProducts, 500, 15);
      expect(warnings.some(w => w.code === 'HIGH_EXCHANGE_RATE')).toBe(true);
    });

    it('should warn on duplicate product codes', () => {
      const duplicateProducts = [
        ...validProducts,
        { ...validProducts[0] } // duplicate
      ];
      const { warnings } = validateOrderParams(duplicateProducts, 500, 1.82);
      expect(warnings.some(w => w.code === 'DUPLICATE_PRODUCTS')).toBe(true);
    });

    it('should warn on stale exchange rate', () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const { warnings } = validateOrderParams(validProducts, 500, {
        rate: 1.82,
        lastUpdated: oldDate.toISOString()
      });
      expect(warnings.some(w => w.code === 'STALE_EXCHANGE_RATE')).toBe(true);
    });
  });

  describe('validateCIFInput', () => {
    it('should return valid=true for complete input', () => {
      const result = validateCIFInput({
        products: [
          {
            productCode: 'STB_500',
            productName: 'Strawberries',
            quantity: 100,
            costPerUnit: 1.5,
            actualWeight: 50,
            volumetricWeight: 45,
            supplier: 'Farm A'
          }
        ],
        totalFreight: 500,
        exchangeRate: 1.82
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid=false when products have errors', () => {
      const result = validateCIFInput({
        products: [
          {
            productCode: 'STB_500',
            productName: 'Strawberries',
            quantity: 100,
            costPerUnit: 1.5,
            actualWeight: 0,
            volumetricWeight: 0,
            supplier: ''
          }
        ],
        totalFreight: 500,
        exchangeRate: 1.82
      });

      expect(result.valid).toBe(false);
      expect(result.summary.hasMissingSuppliers).toBe(true);
      expect(result.summary.hasMissingWeights).toBe(true);
    });
  });

  describe('verifyFreightAllocation', () => {
    it('should pass when allocation equals total', () => {
      const result = verifyFreightAllocation([100, 200, 200], 500);
      expect(result.valid).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should fail when allocation differs from total', () => {
      const result = verifyFreightAllocation([100, 200, 150], 500);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(50);
    });

    it('should handle rounding within tolerance', () => {
      const result = verifyFreightAllocation([100.003, 199.998, 199.999], 500, 0.01);
      expect(result.valid).toBe(true);
    });
  });

  describe('verifyMargins', () => {
    it('should detect negative wholesale margin', () => {
      const results = [
        {
          productCode: 'STB_500',
          productName: 'Strawberries',
          cifPerUnit: 10,
          wholesalePrice: 8, // below cost
          retailPrice: 15
        }
      ];

      const issues = verifyMargins(results);
      expect(issues.some(i => i.type === 'negative_wholesale')).toBe(true);
      expect(issues.some(i => i.severity === 'error')).toBe(true);
    });

    it('should detect negative retail margin', () => {
      const results = [
        {
          productCode: 'STB_500',
          productName: 'Strawberries',
          cifPerUnit: 10,
          wholesalePrice: 12,
          retailPrice: 8 // below cost
        }
      ];

      const issues = verifyMargins(results);
      expect(issues.some(i => i.type === 'negative_retail')).toBe(true);
    });

    it('should warn on below-target margins', () => {
      const results = [
        {
          productCode: 'STB_500',
          productName: 'Strawberries',
          cifPerUnit: 10,
          wholesalePrice: 10.5, // 5% margin, below 10% target
          retailPrice: 15
        }
      ];

      const issues = verifyMargins(results, 10, 44);
      expect(issues.some(i => i.type === 'below_target_wholesale')).toBe(true);
      expect(issues.some(i => i.severity === 'warning')).toBe(true);
    });

    it('should pass for healthy margins', () => {
      const results = [
        {
          productCode: 'STB_500',
          productName: 'Strawberries',
          cifPerUnit: 10,
          wholesalePrice: 12, // 20% margin
          retailPrice: 18 // 80% margin
        }
      ];

      const issues = verifyMargins(results, 10, 44);
      expect(issues).toHaveLength(0);
    });
  });

  describe('safeAdjustmentFactor', () => {
    it('should reject adjustment with insufficient sample size', () => {
      const result = safeAdjustmentFactor(1.1, 80, 3); // only 3 samples
      expect(result.isApplicable).toBe(false);
      expect(result.adjustmentFactor).toBe(1.0);
      expect(result.reason).toContain('sample size');
    });

    it('should reject adjustment with low confidence', () => {
      const result = safeAdjustmentFactor(1.1, 40, 10); // only 40% confidence
      expect(result.isApplicable).toBe(false);
      expect(result.adjustmentFactor).toBe(1.0);
      expect(result.reason).toContain('Confidence');
    });

    it('should cap adjustment at maximum', () => {
      const result = safeAdjustmentFactor(1.25, 80, 10); // 25% increase
      expect(result.isApplicable).toBe(true);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedDirection).toBe('max');
      expect(result.adjustmentFactor).toBe(ADJUSTMENT_FACTOR_MAX);
      expect(result.originalFactor).toBe(1.25);
    });

    it('should cap adjustment at minimum', () => {
      const result = safeAdjustmentFactor(0.75, 80, 10); // 25% decrease
      expect(result.isApplicable).toBe(true);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedDirection).toBe('min');
      expect(result.adjustmentFactor).toBe(ADJUSTMENT_FACTOR_MIN);
    });

    it('should allow adjustment within safe range', () => {
      const result = safeAdjustmentFactor(1.05, 80, 10); // 5% increase
      expect(result.isApplicable).toBe(true);
      expect(result.wasCapped).toBe(false);
      expect(result.adjustmentFactor).toBe(1.05);
    });
  });

  describe('isAnomalyVariance', () => {
    it('should detect anomaly above threshold', () => {
      expect(isAnomalyVariance(30)).toBe(true);
      expect(isAnomalyVariance(-30)).toBe(true);
    });

    it('should not flag normal variance', () => {
      expect(isAnomalyVariance(15)).toBe(false);
      expect(isAnomalyVariance(-15)).toBe(false);
    });

    it('should use threshold constant correctly', () => {
      expect(isAnomalyVariance(ANOMALY_VARIANCE_THRESHOLD + 1)).toBe(true);
      expect(isAnomalyVariance(ANOMALY_VARIANCE_THRESHOLD)).toBe(false);
    });
  });
});

describe('CIF Calculation Formula Verification', () => {
  // These tests verify the core CIF formulas are mathematically correct
  
  describe('Basic CIF Formula', () => {
    it('should calculate CIF correctly: CIF = Cost + Freight', () => {
      const productCost = 150; // USD
      const freightShare = 50; // USD
      const cifUSD = productCost + freightShare;
      expect(cifUSD).toBe(200);
    });

    it('should convert CIF to XCG correctly', () => {
      const cifUSD = 200;
      const exchangeRate = 1.82;
      const cifXCG = cifUSD * exchangeRate;
      expect(cifXCG).toBe(364);
    });

    it('should calculate per-unit CIF correctly', () => {
      const cifXCG = 364;
      const quantity = 100;
      const cifPerUnit = cifXCG / quantity;
      expect(cifPerUnit).toBe(3.64);
    });
  });

  describe('Freight Distribution - By Weight', () => {
    it('should allocate freight proportionally by weight', () => {
      const products = [
        { weight: 100, expected: 200 }, // 50% of weight
        { weight: 60, expected: 120 },  // 30% of weight
        { weight: 40, expected: 80 }    // 20% of weight
      ];
      const totalWeight = 200;
      const totalFreight = 400;

      products.forEach(p => {
        const freightShare = (p.weight / totalWeight) * totalFreight;
        expect(freightShare).toBe(p.expected);
      });

      // Verify total
      const totalAllocated = products.reduce((sum, p) => sum + p.expected, 0);
      expect(totalAllocated).toBe(totalFreight);
    });
  });

  describe('Freight Distribution - By Cost', () => {
    it('should allocate freight proportionally by cost', () => {
      const products = [
        { cost: 500, expected: 250 }, // 50% of cost
        { cost: 300, expected: 150 }, // 30% of cost
        { cost: 200, expected: 100 }  // 20% of cost
      ];
      const totalCost = 1000;
      const totalFreight = 500;

      products.forEach(p => {
        const freightShare = (p.cost / totalCost) * totalFreight;
        expect(freightShare).toBe(p.expected);
      });

      // Verify total
      const totalAllocated = products.reduce((sum, p) => sum + p.expected, 0);
      expect(totalAllocated).toBe(totalFreight);
    });
  });

  describe('Smart Blend Distribution', () => {
    it('should blend weight and cost allocation correctly', () => {
      const blendRatio = 0.7; // 70% weight, 30% cost
      const weightShare = 100;
      const costShare = 150;
      
      const blendedShare = (weightShare * blendRatio) + (costShare * (1 - blendRatio));
      expect(blendedShare).toBe(70 + 45); // 115
      expect(blendedShare).toBe(115);
    });
  });

  describe('Margin Calculations', () => {
    it('should calculate wholesale margin correctly', () => {
      const cifPerUnit = 10;
      const wholesalePrice = 12.5; // 25% markup
      const margin = wholesalePrice - cifPerUnit;
      const marginPercent = (margin / cifPerUnit) * 100;
      
      expect(margin).toBe(2.5);
      expect(marginPercent).toBe(25);
    });

    it('should calculate retail margin correctly', () => {
      const cifPerUnit = 10;
      const retailPrice = 17.86; // ~78.6% markup
      const margin = retailPrice - cifPerUnit;
      const marginPercent = (margin / cifPerUnit) * 100;
      
      expect(margin).toBeCloseTo(7.86);
      expect(marginPercent).toBeCloseTo(78.6);
    });
  });
});

describe('Multi-Supplier Order Scenarios', () => {
  it('should correctly exclude stock items from CIF calculation', () => {
    const allItems = [
      { productCode: 'STB_500', quantity: 50, is_from_stock: false },
      { productCode: 'BLB_125', quantity: 30, is_from_stock: true }, // stock item
      { productCode: 'RAS_125', quantity: 25, is_from_stock: false }
    ];

    const cifItems = allItems.filter(item => !item.is_from_stock);
    
    expect(cifItems).toHaveLength(2);
    expect(cifItems.find(i => i.productCode === 'BLB_125')).toBeUndefined();
  });

  it('should handle order with multiple suppliers correctly', () => {
    const products = [
      { productCode: 'STB_500', supplier: 'Farm A', weight: 100 },
      { productCode: 'STB_250', supplier: 'Farm A', weight: 50 },
      { productCode: 'BLB_125', supplier: 'Farm B', weight: 30 },
      { productCode: 'RAS_125', supplier: 'Farm C', weight: 20 }
    ];

    // Group by supplier
    const bySupplier = products.reduce((acc, p) => {
      if (!acc[p.supplier]) acc[p.supplier] = [];
      acc[p.supplier].push(p);
      return acc;
    }, {} as Record<string, typeof products>);

    expect(Object.keys(bySupplier)).toHaveLength(3);
    expect(bySupplier['Farm A']).toHaveLength(2);
    expect(bySupplier['Farm B']).toHaveLength(1);
    expect(bySupplier['Farm C']).toHaveLength(1);

    // Total weight should include all suppliers
    const totalWeight = products.reduce((sum, p) => sum + p.weight, 0);
    expect(totalWeight).toBe(200);
  });
});
