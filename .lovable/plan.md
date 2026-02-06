
# Add Price Per Unit Column to Import Order Receipts

## Summary
This plan adds a "Price per unit" column to the 80mm thermal receipt format for Import orders and ensures the receipt uses the maximum available paper width (80mm).

## Changes Overview

### 1. Update CustomerReceipt Component Layout

**File:** `src/components/CustomerReceipt.tsx`

**Width optimization:**
- Change from `max-w-[80mm]` to `w-[80mm]` to ensure full paper width usage
- The component already sets `style={{ width: fixedWidth }}` which is correct, but the container class needs updating

**Add Price column to 80mm format:**
- Current 80mm format: Product | Qty | Amount (3 columns)
- New 80mm format: Product | Qty | Price | Amount (4 columns)
- Adjust column widths to fit all data on 80mm paper

### 2. Include Sale Price from Order Items

**File:** `src/components/CustomerReceipt.tsx`

Update the `OrderItem` interface to include the `sale_price_xcg` field:
```typescript
interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  sale_price_xcg?: number | null;  // Add this field
}
```

Update price calculation logic:
- Use `item.sale_price_xcg` (actual sale price at order time) when available
- Fall back to `product.wholesale_price_xcg_per_unit` if not set

### 3. Update OrderDetails Interface

**File:** `src/pages/OrderDetails.tsx`

Update the `OrderItem` interface to include `sale_price_xcg`:
```typescript
interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  units_quantity?: number | null;
  po_number?: string;
  is_from_stock?: boolean;
  sale_price_xcg?: number | null;  // Add this field
}
```

The query already uses `select('*')` so the data is already being fetched.

---

## Technical Details

### Column Layout for 80mm Receipt

```text
┌────────────────────────────────────────────────────────┐
│                    80mm Receipt                         │
├─────────────────┬────────┬──────────┬─────────────────┤
│     Product     │  Qty   │  Price   │      Amount     │
│     (flex-1)    │ (w-8)  │  (w-12)  │      (w-14)     │
├─────────────────┼────────┼──────────┼─────────────────┤
│ Strawberries    │   10   │   2.50   │        25.00    │
│ Blueberries     │   20   │   3.00   │        60.00    │
└─────────────────┴────────┴──────────┴─────────────────┘
```

- Text size remains at `text-[10px]` for compact layout
- "Price" column header abbreviated for space efficiency
- All monetary values right-aligned

### Price Priority Logic

```typescript
// Use order-specific price if available, otherwise fall back to product default
const price = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
```

This ensures customer-specific pricing from the order is shown rather than the default product price.
