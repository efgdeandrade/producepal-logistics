

# Fix: Remove Redundant packSize Multiplier from Weight Calculation

## The Problem

Line 158 of `LandedCostPanel.tsx` currently computes:

```
weightPerUnitKg = products.weight / 1000      // line 151
weight_case_kg  = weightPerUnitKg * packSize   // line 158
```

The `products.weight` column already stores the **total case weight in grams** (e.g., STB_500 = 5000g = 5kg per case of 10 punnets). Multiplying by `packSize` inflates the weight by 10-24x depending on the product.

**Verified with real data from order 1770823917693:**

| Product | weight (DB) | pack_size | Cases | Current (wrong) | Correct |
|---------|------------|-----------|-------|-----------------|---------|
| STB_500 | 5000g | 10 | 52 | 50 kg/case = 2,600 kg | 5 kg/case = 260 kg |
| CTO_250 | 5000g | 20 | 30 | 100 kg/case = 3,000 kg | 5 kg/case = 150 kg |
| Romaine | 3600g | 24 | 12 | 86.4 kg/case = 1,037 kg | 3.6 kg/case = 43.2 kg |

**Correct total order weight: ~530 kg** (currently inflated to ~10,000+ kg)

## Changes

### 1. `src/components/import/LandedCostPanel.tsx`

**Line 151**: Remove the intermediate `weightPerUnitKg` variable.

**Line 158**: Change from:
```typescript
weight_case_kg: weightPerUnitKg * packSize,
```
To:
```typescript
weight_case_kg: (Number(prod?.weight) || 0) / 1000,
```

This is a simple grams-to-kilograms conversion with no multiplier.

### 2. `src/pages/import/ImportCIFBackfill.tsx`

Apply the same fix wherever `weight_case_kg` is computed from `products.weight`. Remove any `* pack_size` multiplication.

### No other files affected

- `src/lib/cifEngine.ts` -- already correct; it expects `weight_case_kg` as the full case weight in kg
- No database migration needed
- No data changes

## Expected Result

- Order total actual weight: ~530 kg (down from ~10,000+ kg)
- Champion cost: $2.63 x 530 = ~$1,394 (down from ~$44,000)
- All per-unit landed costs and pricing suggestions will become realistic

