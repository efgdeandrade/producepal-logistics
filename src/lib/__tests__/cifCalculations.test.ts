import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  calculateFreightByWeight,
  calculateFreightByCost,
  calculateFreightEqually,
  calculateFreightHybrid,
  calculateFreightStrategic,
  calculateFreightVolumeOptimized,
  calculateFreightCustomerTier,
  calculateProductCIF,
  calculateCIFByMethod,
  calculateAllCIFMethods,
  verifyFreightAllocation,
  calculateProfitSummary,
  CIFProductInput,
  CIFParams,
  DEFAULT_WHOLESALE_MULTIPLIER,
  DEFAULT_RETAIL_MULTIPLIER,
} from '../cifCalculations';

// Standard test fixture - 3 products with varied characteristics
const createTestProducts = (): CIFProductInput[] => [
  {
    productCode: 'STB_500',
    productName: 'Strawberry 500g',
    quantity: 1200,
    costPerUnit: 1.50, // $1.50 per unit
    actualWeight: 600, // 600 kg
    volumetricWeight: 480, // 480 kg
    orderFrequency: 8,
    wasteRate: 5,
  },
  {
    productCode: 'ROM_001',
    productName: 'Romaine Lettuce',
    quantity: 1404,
    costPerUnit: 0.89, // $0.89 per unit
    actualWeight: 421.2, // 421.2 kg
    volumetricWeight: 350, // 350 kg
    orderFrequency: 3,
    wasteRate: 8,
  },
  {
    productCode: 'BLU_125',
    productName: 'Blueberry 125g',
    quantity: 800,
    costPerUnit: 2.20, // $2.20 per unit
    actualWeight: 100, // 100 kg
    volumetricWeight: 160, // 160 kg
    orderFrequency: 12,
    wasteRate: 3,
  },
];

const createTestParams = (): CIFParams => ({
  totalFreight: 500, // $500 total freight
  exchangeRate: 2.69,
  limitingFactor: 'actual',
});

describe('CIF Calculations', () => {
  describe('calculateTotals', () => {
    it('should calculate correct totals for multiple products', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      // Total cost: 1200*1.50 + 1404*0.89 + 800*2.20 = 1800 + 1249.56 + 1760 = 4809.56
      expect(totals.totalCost).toBeCloseTo(4809.56, 2);
      
      // Total actual weight: 600 + 421.2 + 100 = 1121.2
      expect(totals.totalActualWeight).toBeCloseTo(1121.2, 2);
      
      // Total volumetric weight: 480 + 350 + 160 = 990
      expect(totals.totalVolumetricWeight).toBeCloseTo(990, 2);
      
      // Total weight (chargeable): max(1121.2, 990) = 1121.2
      expect(totals.totalWeight).toBeCloseTo(1121.2, 2);
      
      // Total frequency: 8 + 3 + 12 = 23
      expect(totals.totalFrequency).toBe(23);
    });

    it('should handle empty product list', () => {
      const totals = calculateTotals([]);
      expect(totals.totalCost).toBe(0);
      expect(totals.totalWeight).toBe(0);
      expect(totals.totalFrequency).toBe(0);
    });
  });

  describe('byWeight - Freight allocated by chargeable weight', () => {
    it('should allocate more freight to heavier products', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const totals = calculateTotals(products);

      const freightSTB = calculateFreightByWeight(products[0], totals, params.totalFreight, 'actual');
      const freightROM = calculateFreightByWeight(products[1], totals, params.totalFreight, 'actual');
      const freightBLU = calculateFreightByWeight(products[2], totals, params.totalFreight, 'actual');

      // STB (600kg) should get most, BLU (100kg) should get least
      expect(freightSTB).toBeGreaterThan(freightROM);
      expect(freightROM).toBeGreaterThan(freightBLU);
    });

    it('should sum freight shares to total freight', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const totals = calculateTotals(products);

      const totalFreightAllocated = products.reduce((sum, p) => 
        sum + calculateFreightByWeight(p, totals, params.totalFreight, 'actual'), 0);

      expect(totalFreightAllocated).toBeCloseTo(params.totalFreight, 2);
    });

    it('should use volumetric weight when limiting factor is volumetric', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      const freightActual = calculateFreightByWeight(products[0], totals, 500, 'actual');
      const freightVolumetric = calculateFreightByWeight(products[0], totals, 500, 'volumetric');

      // STB_500: actual=600kg, volumetric=480kg
      // With actual limiting, STB gets more share (600/1121.2)
      // With volumetric limiting, STB gets less share (480/990)
      expect(freightActual).not.toBe(freightVolumetric);
    });

    it('should return 0 when total weight is 0', () => {
      const products = [{ ...createTestProducts()[0], actualWeight: 0, volumetricWeight: 0 }];
      const totals = calculateTotals(products);
      const freight = calculateFreightByWeight(products[0], totals, 500, 'actual');
      expect(freight).toBe(0);
    });
  });

  describe('byCost - Freight allocated by product cost', () => {
    it('should allocate more freight to higher cost products', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      const freightSTB = calculateFreightByCost(products[0], totals, 500);
      const freightROM = calculateFreightByCost(products[1], totals, 500);
      const freightBLU = calculateFreightByCost(products[2], totals, 500);

      // STB cost: 1200 * 1.50 = 1800
      // ROM cost: 1404 * 0.89 = 1249.56
      // BLU cost: 800 * 2.20 = 1760
      // STB should get most, ROM should get least
      expect(freightSTB).toBeGreaterThan(freightBLU);
      expect(freightBLU).toBeGreaterThan(freightROM);
    });

    it('should sum freight shares to total freight', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      const totalFreightAllocated = products.reduce((sum, p) => 
        sum + calculateFreightByCost(p, totals, 500), 0);

      expect(totalFreightAllocated).toBeCloseTo(500, 2);
    });

    it('should handle zero total cost gracefully', () => {
      const products = [{ ...createTestProducts()[0], costPerUnit: 0, quantity: 0 }];
      const totals = calculateTotals(products);
      const freight = calculateFreightByCost(products[0], totals, 500);
      expect(freight).toBe(0);
    });

    it('should NOT add labor XCG separately (already in logistics)', () => {
      // This test documents that the cost method does NOT add labor separately
      const products = createTestProducts();
      const params = createTestParams();
      const results = calculateCIFByMethod(products, params, 'byCost');
      
      // CIF = product cost + freight share
      // Freight share should only be proportional to cost, no extra additions
      const totalFreightAllocated = results.reduce((sum, r) => sum + r.freightCost, 0);
      expect(totalFreightAllocated).toBeCloseTo(params.totalFreight, 2);
    });
  });

  describe('equally - Freight distributed equally', () => {
    it('should give each product same freight share', () => {
      const totalFreight = 600;
      const productCount = 3;

      const freightShare = calculateFreightEqually(totalFreight, productCount);

      expect(freightShare).toBe(200);
    });

    it('should sum shares to total freight', () => {
      const products = createTestProducts();
      const totalFreight = 500;

      const totalFreightAllocated = products.length * calculateFreightEqually(totalFreight, products.length);

      expect(totalFreightAllocated).toBeCloseTo(totalFreight, 2);
    });

    it('should return 0 for zero products', () => {
      expect(calculateFreightEqually(500, 0)).toBe(0);
    });
  });

  describe('hybrid - 50% weight + 50% cost', () => {
    it('should be exactly average of weight and cost methods', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const totals = calculateTotals(products);

      const product = products[0];
      const weightShare = calculateFreightByWeight(product, totals, params.totalFreight, 'actual');
      const costShare = calculateFreightByCost(product, totals, params.totalFreight);
      const hybridShare = calculateFreightHybrid(product, totals, params.totalFreight, 'actual');

      expect(hybridShare).toBeCloseTo((weightShare + costShare) / 2, 4);
    });

    it('should sum to total freight', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const totals = calculateTotals(products);

      const totalFreightAllocated = products.reduce((sum, p) => 
        sum + calculateFreightHybrid(p, totals, params.totalFreight, 'actual'), 0);

      expect(totalFreightAllocated).toBeCloseTo(params.totalFreight, 2);
    });
  });

  describe('strategic - Risk-adjusted allocation', () => {
    it('should penalize high waste rate products', () => {
      // Create two identical products except waste rate
      const lowWaste: CIFProductInput = {
        productCode: 'LOW',
        productName: 'Low Waste',
        quantity: 100,
        costPerUnit: 1,
        actualWeight: 100,
        volumetricWeight: 100,
        orderFrequency: 5,
        wasteRate: 2,
      };
      const highWaste: CIFProductInput = {
        productCode: 'HIGH',
        productName: 'High Waste',
        quantity: 100,
        costPerUnit: 1,
        actualWeight: 100,
        volumetricWeight: 100,
        orderFrequency: 5,
        wasteRate: 20,
      };

      const products = [lowWaste, highWaste];
      const totals = calculateTotals(products);

      const freightLow = calculateFreightStrategic(lowWaste, totals, 500, products.length);
      const freightHigh = calculateFreightStrategic(highWaste, totals, 500, products.length);

      // High waste product should get MORE freight (penalized)
      expect(freightHigh).toBeGreaterThan(freightLow);
    });

    it('should favor high velocity products', () => {
      // Create two identical products except order frequency
      const slowMover: CIFProductInput = {
        productCode: 'SLOW',
        productName: 'Slow Mover',
        quantity: 100,
        costPerUnit: 1,
        actualWeight: 100,
        volumetricWeight: 100,
        orderFrequency: 1,
        wasteRate: 5,
      };
      const fastMover: CIFProductInput = {
        productCode: 'FAST',
        productName: 'Fast Mover',
        quantity: 100,
        costPerUnit: 1,
        actualWeight: 100,
        volumetricWeight: 100,
        orderFrequency: 20,
        wasteRate: 5,
      };

      const products = [slowMover, fastMover];
      const totals = calculateTotals(products);

      const freightSlow = calculateFreightStrategic(slowMover, totals, 500, products.length);
      const freightFast = calculateFreightStrategic(fastMover, totals, 500, products.length);

      // Fast mover should get LESS freight (favored)
      expect(freightFast).toBeLessThan(freightSlow);
    });

    it('should handle zero order frequency', () => {
      const products = createTestProducts().map(p => ({ ...p, orderFrequency: 0 }));
      const totals = calculateTotals(products);
      
      // Should not throw and should return a valid freight share
      const freight = calculateFreightStrategic(products[0], totals, 500, products.length);
      expect(freight).toBeGreaterThan(0);
    });
  });

  describe('volumeOptimized - Frequency-based allocation', () => {
    it('should give lower freight to high frequency products', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      // BLU_125 has highest frequency (12)
      // ROM_001 has lowest frequency (3)
      const freightBLU = calculateFreightVolumeOptimized(products[2], totals, 500, products.length);
      const freightROM = calculateFreightVolumeOptimized(products[1], totals, 500, products.length);

      expect(freightBLU).toBeLessThan(freightROM);
    });

    it('should give higher freight to low frequency products', () => {
      const products = createTestProducts();
      const totals = calculateTotals(products);

      const freightROM = calculateFreightVolumeOptimized(products[1], totals, 500, products.length);
      const freightSTB = calculateFreightVolumeOptimized(products[0], totals, 500, products.length);

      // ROM (freq=3) should get more freight than STB (freq=8)
      expect(freightROM).toBeGreaterThan(freightSTB);
    });
  });

  describe('customerTier - Wholesale vs retail allocation', () => {
    it('should apply 0.85x multiplier to wholesale-heavy (freq > 5)', () => {
      const products = createTestProducts();

      // STB_500 has freq=8, BLU_125 has freq=12 → both wholesale-heavy
      const freightSTB = calculateFreightCustomerTier(products[0], 500, products.length);
      const baseShare = 500 / products.length;

      expect(freightSTB).toBeCloseTo(baseShare * 0.85, 2);
    });

    it('should apply 1.15x multiplier to non-wholesale', () => {
      const products = createTestProducts();

      // ROM_001 has freq=3 → not wholesale-heavy
      const freightROM = calculateFreightCustomerTier(products[1], 500, products.length);
      const baseShare = 500 / products.length;

      expect(freightROM).toBeCloseTo(baseShare * 1.15, 2);
    });
  });

  describe('calculateProductCIF', () => {
    it('should calculate CIF values correctly', () => {
      const product = createTestProducts()[0];
      const params = createTestParams();
      const freightShare = 200;

      const result = calculateProductCIF(product, freightShare, params);

      // Product cost: 1200 * 1.50 = 1800
      expect(result.costUSD).toBe(1800);
      
      // CIF USD: 1800 + 200 = 2000
      expect(result.cifUSD).toBe(2000);
      
      // CIF XCG: 2000 * 2.69 = 5380
      expect(result.cifXCG).toBeCloseTo(5380, 2);
      
      // CIF per unit: 5380 / 1200 = 4.483
      expect(result.cifPerUnit).toBeCloseTo(4.483, 2);
      
      // Wholesale: 4.483 * 1.25 = 5.604
      expect(result.wholesalePrice).toBeCloseTo(4.483 * DEFAULT_WHOLESALE_MULTIPLIER, 2);
      
      // Retail: 4.483 * 1.786 = 8.006
      expect(result.retailPrice).toBeCloseTo(4.483 * DEFAULT_RETAIL_MULTIPLIER, 2);
    });

    it('should handle zero quantity gracefully', () => {
      const product = { ...createTestProducts()[0], quantity: 0 };
      const params = createTestParams();

      const result = calculateProductCIF(product, 100, params);

      expect(result.cifPerUnit).toBe(0);
    });

    it('should use stored prices when available', () => {
      const product = {
        ...createTestProducts()[0],
        wholesalePriceXCG: 6.00,
        retailPriceXCG: 10.00,
      };
      const params = createTestParams();

      const result = calculateProductCIF(product, 200, params);

      expect(result.wholesalePrice).toBe(6.00);
      expect(result.retailPrice).toBe(10.00);
    });
  });

  describe('calculateCIFByMethod', () => {
    it('should calculate CIF for all products with byWeight method', () => {
      const products = createTestProducts();
      const params = createTestParams();

      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(results.length).toBe(3);
      expect(results[0].productCode).toBe('STB_500');
      expect(results[0].cifUSD).toBeGreaterThan(0);
    });

    it('should return empty array for empty products', () => {
      const params = createTestParams();
      const results = calculateCIFByMethod([], params, 'byWeight');
      expect(results).toEqual([]);
    });
  });

  describe('calculateAllCIFMethods', () => {
    it('should return results for all 7 methods', () => {
      const products = createTestProducts();
      const params = createTestParams();

      const results = calculateAllCIFMethods(products, params);

      expect(Object.keys(results)).toEqual([
        'byWeight', 'byCost', 'equally', 'hybrid', 'strategic', 'volumeOptimized', 'customerTier'
      ]);

      // Each method should have 3 products
      Object.values(results).forEach(methodResults => {
        expect(methodResults.length).toBe(3);
      });
    });
  });

  describe('verifyFreightAllocation', () => {
    it('should return true when allocation matches expected total', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const results = calculateCIFByMethod(products, params, 'byWeight');

      expect(verifyFreightAllocation(results, params.totalFreight)).toBe(true);
    });

    it('should return false when allocation does not match', () => {
      const results = [
        { freightCost: 100 } as any,
        { freightCost: 100 } as any,
      ];

      expect(verifyFreightAllocation(results, 500, 0.01)).toBe(false);
    });

    it('should respect tolerance parameter', () => {
      const results = [
        { freightCost: 251 } as any,
        { freightCost: 249 } as any,
      ];

      expect(verifyFreightAllocation(results, 500, 1)).toBe(true);
      expect(verifyFreightAllocation(results, 500, 0)).toBe(true);
    });
  });

  describe('calculateProfitSummary', () => {
    it('should calculate correct totals', () => {
      const products = createTestProducts();
      const params = createTestParams();
      const results = calculateCIFByMethod(products, params, 'byWeight');

      const summary = calculateProfitSummary(results);

      expect(summary.totalCostUSD).toBeGreaterThan(0);
      expect(summary.totalFreightUSD).toBeCloseTo(params.totalFreight, 2);
      expect(summary.totalCIFUSD).toBe(summary.totalCostUSD + summary.totalFreightUSD);
      expect(summary.totalCIFXCG).toBeCloseTo(summary.totalCIFUSD * params.exchangeRate, 2);
    });
  });
});
