

# Fix: Incorrect Case Count in Consolidated Supplier Orders

## Problem Identified
Products **without** a consolidation group are being incorrectly merged together when they share the same `pack_size`. This causes units from different products to be summed and divided by a single pack_size, producing wildly wrong case counts.

**Example:** 60 units (3 cases at 20/case) + 480 units from another product = 540 total units / 20 = 27 cases displayed

## Root Cause
In `groupBySupplier()` function (line 412-414):
```typescript
let consolidatedGroup = supplierGroup.consolidatedGroups.find(
  cg => cg.groupName === groupKey && cg.packSize === packSize
);
```

When `groupKey` is `null` (no consolidation group), this matches ALL products with the same pack_size, incorrectly consolidating unrelated products.

## Solution
Modify the grouping logic so that:
- Products **WITH** a consolidation_group: continue to group by `(supplier_id, consolidation_group, pack_size)`
- Products **WITHOUT** a consolidation_group: each product gets its own entry (use product ID as a unique key)

## Technical Changes

### File: `src/pages/NewOrder.tsx`

**Change 1: Update ConsolidatedGroup interface** (around line 382)
Add a `productId` field to track individual non-consolidated products:
```typescript
interface ConsolidatedGroup {
  groupName: string | null;
  productId: string | null;  // NEW: for non-consolidated products
  packSize: number;
  products: Array<{ product: Product; individualUnits: number }>;
  totalUnits: number;
  totalCases: number;
}
```

**Change 2: Update grouping logic in `groupBySupplier()`** (around line 412)
Modify the find condition to prevent incorrectly grouping non-consolidated products:
```typescript
// For consolidated products: match by group name and pack size
// For non-consolidated products: match by product ID (each product is its own group)
let consolidatedGroup = supplierGroup.consolidatedGroups.find(
  cg => groupKey !== null 
    ? (cg.groupName === groupKey && cg.packSize === packSize)
    : (cg.productId === item.product.id)
);

if (!consolidatedGroup) {
  consolidatedGroup = {
    groupName: groupKey,
    productId: groupKey ? null : item.product.id,  // Track product ID for non-consolidated
    packSize,
    products: [],
    totalUnits: 0,
    totalCases: 0,
  };
  supplierGroup.consolidatedGroups.push(consolidatedGroup);
}
```

## Expected Result After Fix

**Before (bug):**
```
STEFANNYS FRUITS & CROPS SAS
  Cherry Tomatoes 250g: 60 units → 27 cases (WRONG!)
```

**After (fixed):**
```
STEFANNYS FRUITS & CROPS SAS
  Cherry Tomatoes 250g: 60 units → 3 cases (CORRECT!)
```

Only products that explicitly share a consolidation_group (like BABY_GREENS_150G or HERBS_500G) will be consolidated together.

