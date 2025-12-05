import { describe, it, expect } from 'vitest';
import {
  calculateActualWeightPerUnit,
  calculateActualWeightPerCase,
  calculateVolumetricWeightPerCase,
  calculateVolumetricWeightPerUnit,
  calculateOrderWeights,
  calculateCasesPerPallet,
  calculateSupplierPalletConfig,
  calculateOrderPalletConfig,
  estimatePalletsFromWeight,
  createPalletConfig,
  STANDARD_EUROPALLET,
  PALLET_VOLUMETRIC_WEIGHT_KG,
  ProductWeightInfo,
} from '../weightCalculations';

describe('Weight Calculations', () => {
  describe('calculateActualWeightPerUnit', () => {
    it('should prefer gross weight over net weight', () => {
      const product: ProductWeightInfo = {
        code: 'TEST001',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        grossWeightPerUnit: 500,
        netWeightPerUnit: 450,
      };
      expect(calculateActualWeightPerUnit(product)).toBe(500);
    });

    it('should fallback to net weight when gross is not available', () => {
      const product: ProductWeightInfo = {
        code: 'TEST002',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        netWeightPerUnit: 450,
      };
      expect(calculateActualWeightPerUnit(product)).toBe(450);
    });

    it('should return 0 when no weight data is available', () => {
      const product: ProductWeightInfo = {
        code: 'TEST003',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
      };
      expect(calculateActualWeightPerUnit(product)).toBe(0);
    });
  });

  describe('calculateActualWeightPerCase', () => {
    it('should include empty case weight', () => {
      const product: ProductWeightInfo = {
        code: 'TEST001',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        grossWeightPerUnit: 100, // 100g per unit
        emptyCaseWeight: 500, // 500g case weight
      };
      // 10 units * 100g + 500g case = 1500g
      expect(calculateActualWeightPerCase(product)).toBe(1500);
    });

    it('should calculate correctly for different pack sizes', () => {
      const product: ProductWeightInfo = {
        code: 'TEST002',
        name: 'Test Product',
        quantity: 50,
        packSize: 5,
        grossWeightPerUnit: 200, // 200g per unit
        emptyCaseWeight: 300, // 300g case weight
      };
      // 5 units * 200g + 300g case = 1300g
      expect(calculateActualWeightPerCase(product)).toBe(1300);
    });

    it('should handle missing case weight', () => {
      const product: ProductWeightInfo = {
        code: 'TEST003',
        name: 'Test Product',
        quantity: 20,
        packSize: 4,
        grossWeightPerUnit: 250,
      };
      // 4 units * 250g + 0g case = 1000g
      expect(calculateActualWeightPerCase(product)).toBe(1000);
    });
  });

  describe('calculateVolumetricWeightPerCase', () => {
    it('should calculate L×W×H / 6000 correctly', () => {
      const product: ProductWeightInfo = {
        code: 'TEST001',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        lengthCm: 60,
        widthCm: 40,
        heightCm: 10,
      };
      // 60 * 40 * 10 / 6000 = 4 kg
      expect(calculateVolumetricWeightPerCase(product)).toBe(4);
    });

    it('should return 0 when dimensions are missing', () => {
      const product: ProductWeightInfo = {
        code: 'TEST002',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        lengthCm: 60,
        widthCm: 40,
        // heightCm missing
      };
      expect(calculateVolumetricWeightPerCase(product)).toBe(0);
    });

    it('should handle partial dimensions', () => {
      const product: ProductWeightInfo = {
        code: 'TEST003',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        lengthCm: 60,
        // widthCm and heightCm missing
      };
      expect(calculateVolumetricWeightPerCase(product)).toBe(0);
    });
  });

  describe('calculateVolumetricWeightPerUnit', () => {
    it('should divide case volumetric weight by pack size', () => {
      const product: ProductWeightInfo = {
        code: 'TEST001',
        name: 'Test Product',
        quantity: 100,
        packSize: 10,
        lengthCm: 60,
        widthCm: 40,
        heightCm: 15,
      };
      // Case volumetric: 60 * 40 * 15 / 6000 = 6 kg
      // Per unit: 6 / 10 = 0.6 kg
      expect(calculateVolumetricWeightPerUnit(product)).toBe(0.6);
    });

    it('should return 0 for zero pack size', () => {
      const product: ProductWeightInfo = {
        code: 'TEST002',
        name: 'Test Product',
        quantity: 100,
        packSize: 0,
        lengthCm: 60,
        widthCm: 40,
        heightCm: 15,
      };
      expect(calculateVolumetricWeightPerUnit(product)).toBe(0);
    });
  });

  describe('calculateOrderWeights', () => {
    it('should sum weights across all products', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'P1',
          name: 'Product 1',
          quantity: 100,
          packSize: 10, // 10 cases
          grossWeightPerUnit: 100, // 100g per unit
          emptyCaseWeight: 200, // 200g per case
          lengthCm: 30,
          widthCm: 20,
          heightCm: 10, // volumetric: 30*20*10/6000 = 1kg per case
        },
        {
          code: 'P2',
          name: 'Product 2',
          quantity: 50,
          packSize: 5, // 10 cases
          grossWeightPerUnit: 200, // 200g per unit
          emptyCaseWeight: 300, // 300g per case
          lengthCm: 40,
          widthCm: 30,
          heightCm: 15, // volumetric: 40*30*15/6000 = 3kg per case
        },
      ];

      const result = calculateOrderWeights(products);

      // P1: 10 cases * (10*100g + 200g) / 1000 = 12 kg actual
      // P1: 10 cases * 1kg = 10 kg volumetric
      // P2: 10 cases * (5*200g + 300g) / 1000 = 13 kg actual
      // P2: 10 cases * 3kg = 30 kg volumetric
      expect(result.totalActualWeight).toBeCloseTo(25, 1);
      expect(result.totalVolumetricWeight).toBeCloseTo(40, 1);
      expect(result.totalCases).toBe(20);
    });

    it('should identify volumetric as limiting factor when applicable', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'P1',
          name: 'Light but bulky product',
          quantity: 100,
          packSize: 10,
          grossWeightPerUnit: 50, // Very light
          lengthCm: 60,
          widthCm: 40,
          heightCm: 30, // Large volume
        },
      ];

      const result = calculateOrderWeights(products);
      expect(result.limitingFactor).toBe('volumetric');
    });

    it('should identify actual as limiting factor when applicable', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'P1',
          name: 'Dense product',
          quantity: 100,
          packSize: 10,
          grossWeightPerUnit: 500, // Very heavy
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10, // Small volume
        },
      ];

      const result = calculateOrderWeights(products);
      expect(result.limitingFactor).toBe('actual');
    });
  });

  describe('calculateCasesPerPallet', () => {
    it('should prioritize supplier cases per pallet override', () => {
      const result = calculateCasesPerPallet(60, 40, 10, STANDARD_EUROPALLET, 80);
      expect(result).toBe(80);
    });

    it('should calculate dimensional fit when no override', () => {
      // 60x40x10 cases on 120x80 pallet
      // Along length: 120/60 = 2, along width: 80/40 = 2, per layer = 4
      // Height: (155-14.4)/10 = 14 layers
      // Total: 4 * 14 = 56 cases (approximately, with +2 tolerance)
      const result = calculateCasesPerPallet(60, 40, 10, STANDARD_EUROPALLET);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 0 when no data available', () => {
      const result = calculateCasesPerPallet(0, 0, 0, STANDARD_EUROPALLET);
      expect(result).toBe(0);
    });

    it('should handle case dimensions larger than pallet', () => {
      // Case too large to fit
      const result = calculateCasesPerPallet(200, 200, 200, STANDARD_EUROPALLET);
      expect(result).toBe(0);
    });
  });

  describe('estimatePalletsFromWeight', () => {
    it('should estimate based on default 500kg per pallet', () => {
      expect(estimatePalletsFromWeight(1500)).toBe(3);
      expect(estimatePalletsFromWeight(1000)).toBe(2);
      expect(estimatePalletsFromWeight(499)).toBe(1);
    });

    it('should use custom weight per pallet', () => {
      expect(estimatePalletsFromWeight(1500, 300)).toBe(5);
    });

    it('should round up for partial pallets', () => {
      expect(estimatePalletsFromWeight(501)).toBe(2);
    });
  });

  describe('createPalletConfig', () => {
    it('should return standard Euro pallet when no data provided', () => {
      const config = createPalletConfig();
      expect(config).toEqual(STANDARD_EUROPALLET);
    });

    it('should return standard Euro pallet for incomplete data', () => {
      const config = createPalletConfig({ pallet_length_cm: 120 });
      expect(config).toEqual(STANDARD_EUROPALLET);
    });

    it('should use custom pallet config when complete data provided', () => {
      const config = createPalletConfig({
        pallet_length_cm: 120,
        pallet_width_cm: 100,
        pallet_height_cm: 15,
        pallet_weight_kg: 30,
        pallet_max_height_cm: 161,
      });
      expect(config.lengthCm).toBe(120);
      expect(config.widthCm).toBe(100);
      expect(config.heightCm).toBe(15);
      expect(config.baseWeightKg).toBe(30);
      expect(config.maxCargoHeightCm).toBe(161);
    });
  });

  describe('PALLET_VOLUMETRIC_WEIGHT_KG', () => {
    it('should be calculated correctly from standard pallet dimensions', () => {
      // 120 * 80 * 14.4 / 6000 = 2.304 kg
      expect(PALLET_VOLUMETRIC_WEIGHT_KG).toBeCloseTo(2.304, 2);
    });
  });

  describe('calculateSupplierPalletConfig', () => {
    it('should calculate pallet weights correctly', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'P1',
          name: 'Product 1',
          quantity: 800,
          packSize: 10, // 80 cases
          grossWeightPerUnit: 100,
          emptyCaseWeight: 200,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
        },
      ];

      const result = calculateSupplierPalletConfig('S1', 'Supplier 1', products);

      expect(result.supplierId).toBe('S1');
      expect(result.supplierName).toBe('Supplier 1');
      expect(result.pallets).toBeGreaterThan(0);
      expect(result.totalActualWeight).toBeGreaterThan(0);
      expect(result.totalChargeableWeight).toBeGreaterThanOrEqual(result.totalActualWeight);
    });

    it('should use custom pallet config when provided', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'P1',
          name: 'Product 1',
          quantity: 800,
          packSize: 10,
          grossWeightPerUnit: 100,
          emptyCaseWeight: 200,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
        },
      ];

      const customPallet = {
        baseWeightKg: 30, // Different from standard 26kg
        lengthCm: 120,
        widthCm: 100,
        heightCm: 15,
        maxCargoHeightCm: 161,
      };

      const result = calculateSupplierPalletConfig('S1', 'Supplier 1', products, customPallet);

      // Pallet weight should be based on 30kg per pallet
      expect(result.pallets).toBeGreaterThan(0);
      expect(result.totalActualWeight).toBeGreaterThan(0);
    });

    it('should handle STEFANNYS custom dimensions (120x100cm pallet)', () => {
      const products: ProductWeightInfo[] = [
        {
          code: 'STB_500',
          name: 'Strawberry 500g',
          quantity: 800,
          packSize: 10,
          grossWeightPerUnit: 500,
          emptyCaseWeight: 300,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
        },
      ];

      const stefannysPallet = {
        baseWeightKg: 30,
        lengthCm: 120,
        widthCm: 100, // Custom width (not 80)
        heightCm: 15,
        maxCargoHeightCm: 161,
      };

      const result = calculateSupplierPalletConfig(
        'STEFANNYS', 
        'STEFANNYS FRUITS & CROPS SAS', 
        products, 
        stefannysPallet,
        80 // supplier cases per pallet override
      );

      // With 80 cases per pallet, 80 cases = 1 pallet
      expect(result.pallets).toBe(1);
    });
  });

  describe('calculateOrderPalletConfig', () => {
    it('should aggregate totals across suppliers', () => {
      const products = [
        {
          code: 'P1',
          name: 'Product 1',
          quantity: 400,
          packSize: 10,
          grossWeightPerUnit: 100,
          emptyCaseWeight: 200,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
          supplierId: 'S1',
          supplierName: 'Supplier 1',
        },
        {
          code: 'P2',
          name: 'Product 2',
          quantity: 500,
          packSize: 10,
          grossWeightPerUnit: 150,
          emptyCaseWeight: 250,
          lengthCm: 50,
          widthCm: 35,
          heightCm: 12,
          supplierId: 'S2',
          supplierName: 'Supplier 2',
        },
      ];

      const result = calculateOrderPalletConfig(products);

      expect(result.supplierConfigs.length).toBe(2);
      expect(result.totalPallets).toBeGreaterThan(0);
      expect(result.totalChargeableWeight).toBeGreaterThan(0);
      expect(result.totalActualWeight + result.totalVolumetricWeight).toBeGreaterThan(0);
    });

    it('should use supplier-specific cases per pallet', () => {
      const products = [
        {
          code: 'P1',
          name: 'Product 1',
          quantity: 160, // 16 cases
          packSize: 10,
          grossWeightPerUnit: 100,
          emptyCaseWeight: 200,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
          supplierId: 'S1',
          supplierName: 'Supplier 1',
          supplierCasesPerPallet: 20, // Override: 20 cases per pallet
        },
      ];

      const result = calculateOrderPalletConfig(products);

      // 16 cases / 20 per pallet = 1 pallet (rounded up)
      expect(result.supplierConfigs[0].pallets).toBe(1);
    });
  });
});
