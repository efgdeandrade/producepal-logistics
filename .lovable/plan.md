
# Implementation Plan: Complete CIF System Integration (Phase 2)

This plan completes the CIF system overhaul by integrating the new simplified calculation methods, learning hook, and unified advisor into the three main components.

---

## Overview

| Component | Current State | Target State |
|-----------|---------------|--------------|
| `CIFCalculator.tsx` | Uses old 7-method system from `cifCalculations.ts` | Use new 3-method system from `cifCalculationsV2.ts` + learning hook |
| `CIFAnalytics.tsx` | Duplicates CIF logic (~200 lines), calls old `cif-advisor` | Use shared functions, call unified advisor |
| `DitoAdvisor.tsx` | Calls `volumetric-weight-advisor` only | Call unified `dito-unified-advisor` |

---

## Implementation Details

### 1. CIFCalculator.tsx Updates

**Changes Required:**

**A. Import Updates (lines 22-33)**
- Replace `cifCalculations` import with `cifCalculationsV2`
- Add `useCIFLearning` hook import

**B. Add Learning Hook Integration**
- Add hook initialization in component
- Fetch learning patterns when products change
- Display learning confidence indicators in UI

**C. Simplify Method Selector (around line 121)**
- Replace 7-method dropdown with 3 new methods:
  - "Proportional (by Weight)" - default, most accurate for freight
  - "Value-Based (by Cost)" - for high-value, low-weight items  
  - "Smart Blend (AI-Recommended)" - uses learned patterns

**D. Update calculateCIF Function (lines 551-665)**
- Use `calculateCIFWithLearning` from V2 when patterns available
- Pass learning patterns and blend ratio from Dito recommendations
- Add visual indicators for adjusted CIF values

**E. Add Learning Pattern Display**
- Show adjustment factors and confidence scores in results table
- Highlight products with high-confidence adjustments
- Add tooltip explaining why adjustment was applied

**F. Record Actuals for Learning**
- When user enters actual costs (Actual tab), call `recordActual()` 
- Trigger learning engine after saving actual calculation

---

### 2. CIFAnalytics.tsx Updates

**Changes Required:**

**A. Import Shared Functions**
- Add imports from `cifCalculationsV2.ts`
- Remove duplicated calculation logic (lines 248-316)

**B. Replace getAIRecommendation Function (lines 113-392)**
- Call `dito-unified-advisor` instead of `cif-advisor`
- Simplify data preparation using shared types
- Update response handling for new unified format

**C. Replace calculateResults Logic (lines 248-316)**
- Use `calculateCIFByMethod` from V2
- Remove 7-method switch statement (~70 lines)

**D. Update UI for New Response Format**
- Show blend ratio recommendation
- Display learning adjustments in insights
- Add weight optimization suggestions to UI

**E. Remove Hardcoded Values**
- Use constants from V2 for exchange rate defaults
- Get labor/logistics from settings consistently

---

### 3. DitoAdvisor.tsx Updates

**Changes Required:**

**A. Update Edge Function Call (lines 94-128)**
- Change from `volumetric-weight-advisor` to `dito-unified-advisor`
- Add CIF method results to request body
- Include exchange rate and freight cost

**B. Update Recommendation Interface (lines 42-82)**
- Add new fields: `recommendedMethod`, `blendRatio`, `learningAdjustments`
- Add `confidence` field with HIGH/MEDIUM/LOW values
- Add `riskAlerts` array

**C. Update UI Display**
- Add CIF method recommendation section
- Show recommended blend ratio with explanation
- Display learning adjustment confirmations
- Show risk alerts prominently

**D. Add "Apply Recommendation" Action**
- New callback prop: `onApplyMethodRecommendation`
- Button to apply recommended CIF method to parent component

---

## New UI Elements

### CIF Calculator Method Selector (Simplified)
```
┌────────────────────────────────────────────────┐
│ Distribution Method                             │
├────────────────────────────────────────────────┤
│ ○ Proportional (by Weight)    [Default]        │
│   Freight allocated by product weight share    │
│                                                 │
│ ○ Value-Based (by Cost)                        │
│   Freight allocated by product value share     │
│                                                 │
│ ● Smart Blend (AI-Recommended)  [Learning]     │
│   70% weight + 30% cost (based on patterns)    │
│   ✓ Using 12 learned patterns                  │
└────────────────────────────────────────────────┘
```

### Learning Indicator in Results Table
```
┌──────────────────┬───────┬──────────┬──────────────────┐
│ Product          │ Qty   │ CIF/Unit │ Adjustment       │
├──────────────────┼───────┼──────────┼──────────────────┤
│ Kankantrie Apple │ 120   │ Cg 4.52  │ +5% (92% conf.)  │
│ Red Seedless     │ 240   │ Cg 3.18  │ -3% (78% conf.)  │
│ Butterhead       │ 60    │ Cg 2.94  │ No pattern       │
└──────────────────┴───────┴──────────┴──────────────────┘
```

---

## Technical Details

### File: src/pages/CIFCalculator.tsx

**Import changes:**
```typescript
// OLD
import { calculateCIFByMethod, ... } from '@/lib/cifCalculations';

// NEW  
import { 
  calculateCIFWithLearning,
  calculateAllMethods,
  DistributionMethodV2,
  DEFAULT_BLEND_RATIO,
  getRecommendedBlendRatio,
} from '@/lib/cifCalculationsV2';
import { useCIFLearning } from '@/hooks/useCIFLearning';
```

**Hook initialization:**
```typescript
const { 
  loading: learningLoading,
  patterns,
  fetchPatterns,
  recordActual,
  triggerLearning
} = useCIFLearning();
```

**Method selector state:**
```typescript
// Change from string to DistributionMethodV2
const [selectedMethod, setSelectedMethod] = useState<DistributionMethodV2>('proportional');
const [blendRatio, setBlendRatio] = useState(DEFAULT_BLEND_RATIO);
```

### File: src/components/CIFAnalytics.tsx

**Key refactor - remove duplicated logic:**
```typescript
// REMOVE this entire block (lines 248-316):
const calculateResults = (distributionMethod: 'weight' | 'cost' | 'equal' | ...) => {
  return productsWithWeight.map(product => {
    // ... 70 lines of duplicated calculation
  });
};

// REPLACE with:
import { calculateCIFByMethod, type CIFProductInput } from '@/lib/cifCalculationsV2';

const cifInputs: CIFProductInput[] = productsWithData.map(p => ({
  productCode: p.code,
  productName: p.name,
  quantity: p.totalUnits,
  costPerUnit: p.costPerUnit,
  actualWeight: p.totalWeight,
  volumetricWeight: p.totalWeight, // Use chargeable
  wholesalePriceXCG: p.wholesalePriceXCG,
}));

const cifResults = calculateAllMethods(cifInputs, {
  totalFreight,
  exchangeRate,
  limitingFactor: 'actual',
});
```

**Update advisor call:**
```typescript
// CHANGE from:
const { data } = await supabase.functions.invoke('cif-advisor', { ... });

// TO:
const { data } = await supabase.functions.invoke('dito-unified-advisor', {
  body: {
    products: productsWithData.map(p => ({
      code: p.code,
      name: p.name,
      quantity: p.totalUnits,
      actualWeight: p.totalWeight,
      volumetricWeight: p.totalWeight,
      costUSD: p.totalUnits * p.costPerUnit,
      wholesalePriceXCG: p.wholesalePriceXCG,
    })),
    totalFreight,
    exchangeRate,
    cifMethodResults: Object.entries(cifResults).map(([method, results]) => ({
      method,
      totalProfit: results.reduce((sum, r) => sum + r.wholesaleMargin * r.quantity, 0),
      avgMargin: results.reduce((sum, r) => sum + r.wholesaleMargin, 0) / results.length,
      products: results.map(r => ({
        productCode: r.productCode,
        cifPerUnit: r.cifPerUnit,
        wholesaleMargin: r.wholesaleMargin,
        freightShare: r.freightCost,
      })),
    })),
  }
});
```

### File: src/components/DitoAdvisor.tsx

**Update interface:**
```typescript
interface Recommendation {
  // Existing fields...
  
  // NEW unified advisor fields
  recommendedMethod?: 'proportional' | 'valueBased' | 'smartBlend';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  blendRatio?: number;
  reasoning?: string[];
  learningAdjustments?: Array<{
    productCode: string;
    originalFactor: number;
    recommendedFactor: number;
    reasoning: string;
  }>;
  riskAlerts?: string[];
}
```

**Update function call:**
```typescript
// CHANGE from:
const { data } = await supabase.functions.invoke('volumetric-weight-advisor', { ... });

// TO:
const { data } = await supabase.functions.invoke('dito-unified-advisor', {
  body: {
    products: orderItems.map(item => ({
      code: item.code,
      name: item.name,
      quantity: item.quantity,
      actualWeight: item.actualWeight,
      volumetricWeight: item.volumetricWeight,
      costUSD: item.costUSD,
      wholesalePriceXCG: item.wholesalePriceXCG,
      retailPriceXCG: item.retailPriceXCG,
    })),
    totalFreight: freightCostPerKg * palletConfiguration.totalChargeableWeight,
    exchangeRate,
    palletConfig: {
      totalPallets: palletConfiguration.totalPallets,
      totalActualWeight: palletConfiguration.totalActualWeight,
      totalVolumetricWeight: palletConfiguration.totalVolumetricWeight,
      utilizationPercentage: palletConfiguration.utilizationPercentage,
    },
    includeWeightOptimization: true,
  }
});
```

---

## Backward Compatibility

The V2 calculation module maintains full backward compatibility:
- Legacy method names (`byWeight`, `byCost`, etc.) still work
- `calculateAllCIFMethods()` returns results for all 7 legacy methods
- Existing saved calculations load correctly

The UI will only show 3 methods but calculations can still use legacy methods for historical data.

---

## Files to Modify

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/pages/CIFCalculator.tsx` | ~150 lines | Add learning hook, simplify methods, show adjustments |
| `src/components/CIFAnalytics.tsx` | ~120 lines | Remove duplicate logic, use shared functions, call unified advisor |
| `src/components/DitoAdvisor.tsx` | ~80 lines | Call unified advisor, show CIF recommendations |

---

## Testing Checklist

After implementation:
1. Verify CIF Calculator shows 3 methods and calculates correctly
2. Confirm learning patterns are fetched and applied
3. Check that adjusted CIF values show confidence indicators
4. Test CIFAnalytics calls unified advisor successfully
5. Verify DitoAdvisor shows CIF method recommendations
6. Confirm backward compatibility with saved calculations
7. Test actual cost recording triggers learning engine

