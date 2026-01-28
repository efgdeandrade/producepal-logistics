

# Add "In Stock" Flag for Order Items

## The Challenge
When creating an import order, the system currently:
1. Creates a purchase order (PO) for suppliers - from the "Consolidated Supplier Orders" section
2. Creates invoices/packing lists for customers

You need certain items to appear on customer invoices but **NOT** on supplier POs (because they're already in stock).

## Solution: Add "In Stock" Checkbox

Add a simple checkbox for each product line that marks it as "from existing stock". Items marked as in-stock will:
- Still appear on customer packing lists and invoices
- Be excluded from the Order Roundup totals
- Be excluded from Consolidated Supplier Orders
- Be visually differentiated (green background or icon)

## Technical Implementation

### Phase 1: Database Migration
Add a new column to track stock status:
```sql
ALTER TABLE order_items 
ADD COLUMN is_from_stock BOOLEAN DEFAULT false;
```

### Phase 2: Update OrderProduct Interface
```typescript
interface OrderProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  packSize: number;
  trays: number;
  units: number;
  salePriceXcg: number | null;
  defaultPriceXcg: number | null;
  isFromStock: boolean;  // NEW
}
```

### Phase 3: Add UI Checkbox in Product Table
Add a new column "Stock" with a checkbox:

```text
| Product | Trays | Units | Price | Total | Pack Size | Stock | [Del] |
|---------|-------|-------|-------|-------|-----------|-------|-------|
| Arugula |   5   |  90   | 4.65  | 23.25 |    18     |  [ ]  |   X   |
| Spinach |   3   |  54   | 5.50  | 16.50 |    18     |  [✓]  |   X   |
```

Items with "Stock" checked will have a subtle green background to indicate they won't be ordered from suppliers.

### Phase 4: Filter Roundup and Supplier Groups
Modify `calculateRoundup()` to exclude in-stock items:
```typescript
const calculateRoundup = () => {
  const productMap = new Map();
  customerOrders.forEach(co => {
    co.products
      .filter(p => !p.isFromStock)  // NEW: exclude in-stock items
      .forEach(p => {
        // ... existing logic
      });
  });
  // ...
};
```

The `groupBySupplier()` function already uses `calculateRoundup()`, so it will automatically exclude in-stock items from supplier POs.

### Phase 5: Update Save/Load Logic
**When saving:**
```typescript
const orderItems = customerOrders.flatMap(co => 
  co.products.map(p => ({
    order_id: order.id,
    customer_name: co.customerName,
    product_code: p.productCode,
    quantity: p.trays,
    sale_price_xcg: p.salePriceXcg,
    is_from_stock: p.isFromStock,  // NEW
    // ...
  }))
);
```

**When loading (edit mode):**
```typescript
const orderProduct: OrderProduct = {
  // ...existing fields
  isFromStock: item.is_from_stock ?? false,  // NEW
};
```

### Phase 6: Visual Enhancements
- In-stock rows get a subtle green tint: `bg-green-50 dark:bg-green-950/20`
- Add a small "📦" icon or "In Stock" badge next to checked items
- Show summary at bottom: "3 items from stock (not included in supplier orders)"

## Files to Modify

| File | Changes |
|------|---------|
| Database | Add `is_from_stock` column to `order_items` |
| `src/pages/NewOrder.tsx` | Add checkbox column, filter logic, save/load updates |

## UI Preview

The enhanced product row will look like:

```text
┌────────────┬───────┬───────┬───────┬───────┬──────┬─────────────────┬───┐
│ Product    │ Trays │ Units │ Price │ Total │ Pack │ From Stock      │   │
├────────────┼───────┼───────┼───────┼───────┼──────┼─────────────────┼───┤
│ Arugula    │   5   │  90   │ 4.65  │ 23.25 │  18  │ [ ]             │ X │
│ Spinach ✓  │   3   │  54   │ 5.50  │ 16.50 │  18  │ [✓] In Stock    │ X │
│ (green bg) │       │       │       │       │      │                 │   │
└────────────┴───────┴───────┴───────┴───────┴──────┴─────────────────┴───┘
```

## Expected Behavior After Implementation

**Scenario:** Creating order with 3 products for Customer A
- Arugula: 5 trays (needs to be ordered)
- Spinach: 3 trays (already in stock - checkbox checked)
- Tomatoes: 2 trays (needs to be ordered)

**Order Roundup will show:**
- Arugula: 5 trays, 90 units
- Tomatoes: 2 trays, 40 units
- *(Spinach excluded)*

**Consolidated Supplier Orders will show:**
- Only Arugula and Tomatoes

**Customer Packing List will show:**
- All 3 products (Arugula, Spinach, Tomatoes)

**Customer Invoice will include:**
- All 3 products with their prices and totals

