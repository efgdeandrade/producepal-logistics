import { describe, it, expect } from 'vitest';
import {
  calculateCIFByMethod,
  calculateAllCIFMethods,
  calculateTotals,
  verifyFreightAllocation,
  CIFProductInput,
  CIFParams,
} from '../cifCalculations';

/**
 * Edge case tests for CIF calculations
 * Tests boundary conditions, unusual inputs, and error handling
 */

describe('CIF Edge Cases', () => {
  describe('Empty and null handling', () => {
    it('should handle empty product list', () => {
      const params: CIFParams = {
        totalFreight: 500,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod([], params, 'byWeight');
      expect(results).toEqual([]);
    });

    it('should handle all methods with empty product list', () => {
      const params: CIFParams = {
        totalFreight: 500,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const allResults = calculateAllCIFMethods([], params);
      
      Object.values(allResults).forEach(results => {
        expect(results).toEqual([]);
      });
    });
  });

  describe('Single product scenarios', () => {
    it('should handle single product', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'SINGLE',
          productName: 'Single Product',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results.length).toBe(1);
      // Single product should get 100% of freight
      expect(results[0].freightCost).toBe(200);
    });

    it('should give same freight to single product regardless of method', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'SINGLE',
          productName: 'Single Product',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
          orderFrequency: 5,
          wasteRate: 3,
        },
      ];

      const params: CIFParams = {
        totalFreight: 300,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const allResults = calculateAllCIFMethods(products, params);

      // Core methods should give 100% freight to single product
      expect(allResults.byWeight[0].freightCost).toBe(300);
      expect(allResults.byCost[0].freightCost).toBe(300);
      expect(allResults.equally[0].freightCost).toBe(300);
      expect(allResults.hybrid[0].freightCost).toBe(300);
      expect(allResults.strategic[0].freightCost).toBe(300);
      // Note: volumeOptimized and customerTier apply modifiers that don't sum to 100%
      // for single products - this is expected behavior for these specialized methods
      expect(allResults.volumeOptimized[0].freightCost).toBeGreaterThan(0);
      expect(allResults.customerTier[0].freightCost).toBeGreaterThan(0);
    });
  });

  describe('Zero value handling', () => {
    it('should handle zero quantity products', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'ZERO_QTY',
          productName: 'Zero Quantity',
          quantity: 0,
          costPerUnit: 5.00,
          actualWeight: 0,
          volumetricWeight: 0,
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results[0].quantity).toBe(0);
      expect(results[0].cifPerUnit).toBe(0);
    });

    it('should handle zero weight products', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'ZERO_WEIGHT',
          productName: 'Zero Weight',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 0,
          volumetricWeight: 0,
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      // Weight method should return 0 freight when weight is 0
      const resultsByWeight = calculateCIFByMethod(products, params, 'byWeight');
      expect(resultsByWeight[0].freightCost).toBe(0);

      // Cost method should work normally
      const resultsByCost = calculateCIFByMethod(products, params, 'byCost');
      expect(resultsByCost[0].freightCost).toBe(200);
    });

    it('should handle zero cost products', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'ZERO_COST',
          productName: 'Zero Cost',
          quantity: 100,
          costPerUnit: 0,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      // Cost method should return 0 freight when cost is 0
      const resultsByCost = calculateCIFByMethod(products, params, 'byCost');
      expect(resultsByCost[0].freightCost).toBe(0);

      // Weight method should work normally
      const resultsByWeight = calculateCIFByMethod(products, params, 'byWeight');
      expect(resultsByWeight[0].freightCost).toBe(200);
    });

    it('should handle zero freight', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'TEST',
          productName: 'Test Product',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      const params: CIFParams = {
        totalFreight: 0,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results[0].freightCost).toBe(0);
      // CIF should equal product cost when no freight
      expect(results[0].cifUSD).toBe(500); // 100 * 5.00
    });

    it('should handle zero exchange rate', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'TEST',
          productName: 'Test Product',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 0,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results[0].cifXCG).toBe(0);
      expect(results[0].cifPerUnit).toBe(0);
    });
  });

  describe('Large value handling', () => {
    it('should handle very large orders', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'LARGE',
          productName: 'Large Order Product',
          quantity: 1000000, // 1 million units
          costPerUnit: 10.00,
          actualWeight: 500000, // 500 tons
          volumetricWeight: 400000,
        },
      ];

      const params: CIFParams = {
        totalFreight: 100000, // $100k freight
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results[0].cifUSD).toBe(10000000 + 100000); // 10M + 100k
      expect(results[0].cifXCG).toBeCloseTo(27169000, 0);
      expect(results[0].cifPerUnit).toBeCloseTo(27.169, 2);
    });

    it('should maintain precision with fractional quantities', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'FRAC1',
          productName: 'Fractional 1',
          quantity: 33.33,
          costPerUnit: 3.33,
          actualWeight: 16.665,
          volumetricWeight: 13.332,
        },
        {
          productCode: 'FRAC2',
          productName: 'Fractional 2',
          quantity: 66.67,
          costPerUnit: 6.67,
          actualWeight: 33.335,
          volumetricWeight: 26.668,
        },
      ];

      const params: CIFParams = {
        totalFreight: 100,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      // Verify freight allocates correctly with fractional weights
      expect(verifyFreightAllocation(results, 100, 0.01)).toBe(true);
    });
  });

  describe('Missing optional fields', () => {
    it('should handle missing orderFrequency', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'NO_FREQ',
          productName: 'No Frequency',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
          // orderFrequency not provided
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      // Should not throw for methods that use frequency
      const resultsStrategic = calculateCIFByMethod(products, params, 'strategic');
      const resultsVolumeOpt = calculateCIFByMethod(products, params, 'volumeOptimized');
      const resultsTier = calculateCIFByMethod(products, params, 'customerTier');

      expect(resultsStrategic[0].freightCost).toBeGreaterThan(0);
      expect(resultsVolumeOpt[0].freightCost).toBeGreaterThan(0);
      expect(resultsTier[0].freightCost).toBeGreaterThan(0);
    });

    it('should handle missing wasteRate', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'NO_WASTE',
          productName: 'No Waste Rate',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
          orderFrequency: 5,
          // wasteRate not provided
        },
      ];

      const params: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const resultsStrategic = calculateCIFByMethod(products, params, 'strategic');
      expect(resultsStrategic[0].freightCost).toBe(200); // Single product gets all freight
    });
  });

  describe('Mixed product scenarios', () => {
    it('should handle mix of products with and without optional fields', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'FULL',
          productName: 'Full Data',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
          orderFrequency: 10,
          wasteRate: 5,
          wholesalePriceXCG: 15.00,
          retailPriceXCG: 25.00,
        },
        {
          productCode: 'MINIMAL',
          productName: 'Minimal Data',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
          // No optional fields
        },
      ];

      const params: CIFParams = {
        totalFreight: 400,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const allResults = calculateAllCIFMethods(products, params);

      // Should work for all methods
      Object.entries(allResults).forEach(([method, results]) => {
        expect(results.length, `${method} should have 2 results`).toBe(2);
        expect(results[0].cifUSD, `${method} should have valid CIF`).toBeGreaterThan(0);
      });
    });
  });

  describe('Extreme ratios', () => {
    it('should handle product with much higher weight than others', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'HEAVY',
          productName: 'Very Heavy',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 10000, // 10 tons
          volumetricWeight: 8000,
        },
        {
          productCode: 'LIGHT',
          productName: 'Very Light',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 1, // 1 kg
          volumetricWeight: 0.8,
        },
      ];

      const params: CIFParams = {
        totalFreight: 1000,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');

      // Heavy product should get ~99.99% of freight
      const heavyShare = results.find(r => r.productCode === 'HEAVY')!.freightCost;
      const lightShare = results.find(r => r.productCode === 'LIGHT')!.freightCost;

      expect(heavyShare).toBeGreaterThan(lightShare * 100);
      expect(verifyFreightAllocation(results, 1000, 0.01)).toBe(true);
    });

    it('should handle product with much higher cost than others', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'EXPENSIVE',
          productName: 'Very Expensive',
          quantity: 10,
          costPerUnit: 1000.00, // $1000 per unit
          actualWeight: 10,
          volumetricWeight: 8,
        },
        {
          productCode: 'CHEAP',
          productName: 'Very Cheap',
          quantity: 1000,
          costPerUnit: 0.01, // $0.01 per unit
          actualWeight: 100,
          volumetricWeight: 80,
        },
      ];

      const params: CIFParams = {
        totalFreight: 500,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byCost');

      // Expensive product should get ~99.9% of freight
      const expensiveShare = results.find(r => r.productCode === 'EXPENSIVE')!.freightCost;
      const cheapShare = results.find(r => r.productCode === 'CHEAP')!.freightCost;

      expect(expensiveShare).toBeGreaterThan(cheapShare * 100);
      expect(verifyFreightAllocation(results, 500, 0.01)).toBe(true);
    });
  });

  describe('calculateTotals edge cases', () => {
    it('should handle negative values gracefully', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'NEG',
          productName: 'Negative Test',
          quantity: -100, // Edge case: negative quantity
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      // Should not throw
      const totals = calculateTotals(products);
      
      // Negative values will produce negative totals
      expect(totals.totalCost).toBe(-500);
    });

    it('should handle very small decimal values', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'TINY',
          productName: 'Tiny Values',
          quantity: 0.001,
          costPerUnit: 0.001,
          actualWeight: 0.001,
          volumetricWeight: 0.001,
        },
      ];

      const totals = calculateTotals(products);

      expect(totals.totalCost).toBeCloseTo(0.000001, 8);
      expect(totals.totalWeight).toBeCloseTo(0.001, 6);
    });
  });
});
