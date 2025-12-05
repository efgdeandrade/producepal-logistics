import { describe, it, expect } from 'vitest';
import {
  calculateCIFByMethod,
  calculateAllCIFMethods,
  verifyFreightAllocation,
  CIFProductInput,
  CIFParams,
} from '../cifCalculations';

/**
 * Integration tests to verify CIF calculation consistency across methods
 * and real-world order scenarios
 */

describe('CIF Integration Tests', () => {
  describe('Order Verification - ORD-1764071544568 Pattern', () => {
    // Real test case pattern from production order
    const realOrderProducts: CIFProductInput[] = [
      {
        productCode: 'STB_500',
        productName: 'Strawberry 500g',
        quantity: 1200,
        costPerUnit: 1.50,
        actualWeight: 600,
        volumetricWeight: 480,
        orderFrequency: 8,
        wasteRate: 5,
      },
      {
        productCode: 'ROM_001',
        productName: 'Romaine',
        quantity: 1404,
        costPerUnit: 0.89,
        actualWeight: 421.2,
        volumetricWeight: 350,
        orderFrequency: 3,
        wasteRate: 8,
      },
      {
        productCode: 'BLU_125',
        productName: 'Blueberry 125g',
        quantity: 800,
        costPerUnit: 2.20,
        actualWeight: 100,
        volumetricWeight: 160,
        orderFrequency: 12,
        wasteRate: 3,
      },
      {
        productCode: 'APL_GRN',
        productName: 'Green Apple',
        quantity: 500,
        costPerUnit: 0.75,
        actualWeight: 150,
        volumetricWeight: 120,
        orderFrequency: 6,
        wasteRate: 4,
      },
    ];

    const orderParams: CIFParams = {
      totalFreight: 850, // Realistic freight for this order size
      exchangeRate: 2.69,
      limitingFactor: 'actual',
    };

    it('should calculate Cost method with freight proportional to product cost', () => {
      const results = calculateCIFByMethod(realOrderProducts, orderParams, 'byCost');

      // Total cost: 1200*1.50 + 1404*0.89 + 800*2.20 + 500*0.75
      // = 1800 + 1249.56 + 1760 + 375 = 5184.56
      const totalCost = realOrderProducts.reduce((sum, p) => sum + p.quantity * p.costPerUnit, 0);
      expect(totalCost).toBeCloseTo(5184.56, 2);

      // Verify freight allocation is proportional to cost
      const stbFreight = results.find(r => r.productCode === 'STB_500')!.freightCost;
      const expectedStbFreight = (1800 / totalCost) * orderParams.totalFreight;
      expect(stbFreight).toBeCloseTo(expectedStbFreight, 2);

      // Verify total freight
      expect(verifyFreightAllocation(results, orderParams.totalFreight)).toBe(true);
    });

    it('should produce different CIF values for different methods', () => {
      const allResults = calculateAllCIFMethods(realOrderProducts, orderParams);

      // Get STB_500 CIF per unit for each method
      const stbByWeight = allResults.byWeight.find(r => r.productCode === 'STB_500')!.cifPerUnit;
      const stbByCost = allResults.byCost.find(r => r.productCode === 'STB_500')!.cifPerUnit;
      const stbEqually = allResults.equally.find(r => r.productCode === 'STB_500')!.cifPerUnit;

      // Different methods should produce different CIF values
      // (unless by coincidence the allocation is identical)
      const allSame = stbByWeight === stbByCost && stbByCost === stbEqually;
      expect(allSame).toBe(false);
    });

    it('should have freight shares sum to total freight for all methods', () => {
      const allResults = calculateAllCIFMethods(realOrderProducts, orderParams);

      Object.entries(allResults).forEach(([method, results]) => {
        const isValid = verifyFreightAllocation(results, orderParams.totalFreight, 0.1);
        expect(isValid, `Method ${method} should have correct freight allocation`).toBe(true);
      });
    });
  });

  describe('Consistency Verification', () => {
    it('should produce consistent results when called multiple times', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'TEST1',
          productName: 'Test 1',
          quantity: 100,
          costPerUnit: 2.00,
          actualWeight: 50,
          volumetricWeight: 40,
          orderFrequency: 5,
          wasteRate: 3,
        },
        {
          productCode: 'TEST2',
          productName: 'Test 2',
          quantity: 200,
          costPerUnit: 1.50,
          actualWeight: 80,
          volumetricWeight: 60,
          orderFrequency: 8,
          wasteRate: 2,
        },
      ];

      const params: CIFParams = {
        totalFreight: 300,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      // Call multiple times
      const results1 = calculateAllCIFMethods(products, params);
      const results2 = calculateAllCIFMethods(products, params);
      const results3 = calculateAllCIFMethods(products, params);

      // All should be identical
      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);
    });

    it('should handle different limiting factors correctly', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'LIGHT',
          productName: 'Light Bulky Item',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 20, // Light
          volumetricWeight: 100, // Bulky
        },
        {
          productCode: 'DENSE',
          productName: 'Dense Compact Item',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 100, // Heavy
          volumetricWeight: 20, // Compact
        },
      ];

      const paramsActual: CIFParams = {
        totalFreight: 500,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const paramsVolumetric: CIFParams = {
        totalFreight: 500,
        exchangeRate: 2.69,
        limitingFactor: 'volumetric',
      };

      const resultsActual = calculateCIFByMethod(products, paramsActual, 'byWeight');
      const resultsVolumetric = calculateCIFByMethod(products, paramsVolumetric, 'byWeight');

      // With actual limiting: DENSE gets more freight (100kg vs 20kg)
      const denseActualFreight = resultsActual.find(r => r.productCode === 'DENSE')!.freightCost;
      const lightActualFreight = resultsActual.find(r => r.productCode === 'LIGHT')!.freightCost;
      expect(denseActualFreight).toBeGreaterThan(lightActualFreight);

      // With volumetric limiting: LIGHT gets more freight (100kg vs 20kg volumetric)
      const denseVolFreight = resultsVolumetric.find(r => r.productCode === 'DENSE')!.freightCost;
      const lightVolFreight = resultsVolumetric.find(r => r.productCode === 'LIGHT')!.freightCost;
      expect(lightVolFreight).toBeGreaterThan(denseVolFreight);
    });
  });

  describe('Margin Calculations', () => {
    it('should calculate positive margins when prices exceed CIF', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'MARGIN_TEST',
          productName: 'Margin Test Product',
          quantity: 100,
          costPerUnit: 2.00,
          actualWeight: 50,
          volumetricWeight: 40,
          wholesalePriceXCG: 10.00, // High wholesale price
          retailPriceXCG: 15.00, // High retail price
        },
      ];

      const params: CIFParams = {
        totalFreight: 100,
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');
      const result = results[0];

      // CIF: (200 + 100) * 2.69 / 100 = 8.07 per unit
      // Wholesale margin: 10.00 - 8.07 = 1.93
      expect(result.wholesaleMargin).toBeGreaterThan(0);
      expect(result.retailMargin).toBeGreaterThan(result.wholesaleMargin);
    });

    it('should calculate negative margins when CIF exceeds prices', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'LOSS_TEST',
          productName: 'Loss Test Product',
          quantity: 100,
          costPerUnit: 10.00, // High cost
          actualWeight: 50,
          volumetricWeight: 40,
          wholesalePriceXCG: 5.00, // Low wholesale price
          retailPriceXCG: 8.00, // Low retail price
        },
      ];

      const params: CIFParams = {
        totalFreight: 500, // High freight
        exchangeRate: 2.69,
        limitingFactor: 'actual',
      };

      const results = calculateCIFByMethod(products, params, 'byWeight');
      const result = results[0];

      // CIF: (1000 + 500) * 2.69 / 100 = 40.35 per unit
      // Wholesale margin: 5.00 - 40.35 = -35.35
      expect(result.wholesaleMargin).toBeLessThan(0);
      expect(result.retailMargin).toBeLessThan(0);
    });
  });

  describe('Exchange Rate Sensitivity', () => {
    it('should scale CIF XCG linearly with exchange rate', () => {
      const products: CIFProductInput[] = [
        {
          productCode: 'FX_TEST',
          productName: 'FX Test',
          quantity: 100,
          costPerUnit: 5.00,
          actualWeight: 50,
          volumetricWeight: 40,
        },
      ];

      const params1: CIFParams = {
        totalFreight: 200,
        exchangeRate: 2.00,
        limitingFactor: 'actual',
      };

      const params2: CIFParams = {
        totalFreight: 200,
        exchangeRate: 4.00, // Double the exchange rate
        limitingFactor: 'actual',
      };

      const results1 = calculateCIFByMethod(products, params1, 'byWeight');
      const results2 = calculateCIFByMethod(products, params2, 'byWeight');

      // CIF XCG should double when exchange rate doubles
      expect(results2[0].cifXCG).toBeCloseTo(results1[0].cifXCG * 2, 2);
    });
  });
});
