
# Fix Supplier Order List Product Consolidation

## Problem
When generating the Supplier Order List, the same product appears multiple times on the page - once for each customer who ordered it. Instead, products should be consolidated so each product appears only once with the total quantity across all customers.

**Example of current (incorrect) behavior:**
- STB_500: 12 cases (FUIK SHOP)
- STB_500: 5 cases (CARREFOUR)
- STB_500: 2 cases (VREUGDENHIL)
- STB_500: 15 cases (MANGUSA HYPER)

**Expected (correct) behavior:**
- STB_500: 52 cases / 520 units

## Root Cause
In `SupplierOrderList.tsx`, the `getConsolidatedGroups` function iterates through order items and:
1. For consolidated groups: pushes each item occurrence to `group.products` without aggregating same product codes
2. For individual products: pushes each order item as a separate entry without aggregating

The function needs to aggregate quantities by product code BEFORE calculating units and cases.

## Solution

### File: `src/components/SupplierOrderList.tsx`

**Step 1: Aggregate items by product code first**

Before processing items into consolidated groups or individual products, first sum up all quantities for each product code within the supplier's items.

**Step 2: Update `getConsolidatedGroups` function**

```text
Current flow:
  items.forEach(item => ...) → directly processes each item

New flow:
  1. Aggregate: sum quantities by product_code
  2. Process aggregated totals into consolidated groups or individual products
```

**Step 3: Fix consolidated group product tracking**

Within consolidated groups, ensure each product code appears only once with its total units (not duplicated per customer).

## Technical Changes

```typescript
// In getConsolidatedGroups function:

// STEP 1: First aggregate quantities by product code
const productTotals = items.reduce((acc, item) => {
  if (!acc[item.product_code]) {
    acc[item.product_code] = 0;
  }
  acc[item.product_code] += item.quantity;
  return acc;
}, {} as Record<string, number>);

// STEP 2: Process aggregated totals
Object.entries(productTotals).forEach(([productCode, quantity]) => {
  const product = getProductInfo(productCode);
  if (!product) return;

  const units = quantity * product.pack_size;

  if (product.consolidation_group) {
    // Handle consolidated groups
    const groupKey = `${product.consolidation_group}-${product.pack_size}`;
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupName: product.consolidation_group,
        packSize: product.pack_size,
        products: [],
        totalUnits: 0,
        totalCases: 0
      });
    }
    
    const group = groupMap.get(groupKey)!;
    // Each product appears once with its total
    group.products.push({ code: product.code, name: product.name, units });
    group.totalUnits += units;
    group.totalCases = Math.ceil(group.totalUnits / group.packSize);
  } else {
    // Individual product - add once with total quantity
    individual.push({
      code: product.code,
      name: product.name,
      quantity,
      units
    });
  }
});
```

## Expected Result

After this fix, the Supplier Order List will show:

| Product | Cases/Trays | Units |
|---------|-------------|-------|
| STB_500 (Strawberries 500g) | 52 | 520 |
| STB_250 (Strawberries 250g) | 3 | 60 |
| CTO_250 (Cherry Tomatoes 250g) | 25 | 500 |

For consolidated groups (e.g., HERBS_500G):
```
HERBS_500G (12/case) — 3 CASES
  ↳ Basil 500g             12 units
  ↳ Mint 500g               8 units  
  ↳ Cilantro 500g          16 units
  Total: 36 units → 3 cases
```

Each product appears exactly once with aggregated totals across all customers.
