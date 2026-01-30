
# Plan: Enable Editable Units with Persistence in Import Orders

## Summary
This plan adds a new `units_quantity` column to the `order_items` table so that when you edit "Units" directly (even for less than a full case), the exact value you enter is saved and persists correctly. Both "Trays/Cases" and "Units" will remain editable - whichever you change last will be saved as the source of truth.

---

## What Changes

### 1. Database Schema Update
Add a new column `units_quantity` to the `order_items` table to store the exact unit count you enter.

- Column: `units_quantity` (integer, nullable, default null)
- When `units_quantity` is set, it becomes the saved truth for quantity
- When null, the system falls back to the existing `quantity` (trays) * pack_size calculation

### 2. Edit Order Screen (`src/pages/NewOrder.tsx`)

**Current behavior:**
- When you load an order, Units = `quantity * pack_size`
- When you edit Units, it recalculates trays as `ceil(units / pack_size)`
- On save, only `trays` is saved to the database
- On reload, Units is recalculated, losing your exact value

**New behavior:**
- Track which field was last edited (Units or Trays/Cases)
- When saving:
  - If Units was last edited: save `units_quantity` = your Units value, `quantity` = ceil(units / pack_size)
  - If Trays was last edited: save `quantity` = trays, `units_quantity` = null (calculated on load)
- On load: if `units_quantity` exists, use it; otherwise calculate from `quantity * pack_size`

### 3. Order Details and CIF Views

Update these pages to use `units_quantity` when available:
- `src/pages/OrderDetails.tsx`
- `src/pages/import/ImportOrderCIFView.tsx`
- `src/components/OrderCIFTable.tsx`

The logic: `totalUnits = item.units_quantity ?? (item.quantity * pack_size)`

---

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Add `units_quantity` column to `order_items` |
| `src/pages/NewOrder.tsx` | Track last-edited field, save `units_quantity`, load correctly |
| `src/pages/OrderDetails.tsx` | Use `units_quantity` when calculating total units |
| `src/pages/import/ImportOrderCIFView.tsx` | Use `units_quantity` when calculating total units |
| `src/components/OrderCIFTable.tsx` | Use `units_quantity` when present |

---

## Technical Details

### Database Migration SQL
```sql
ALTER TABLE public.order_items 
ADD COLUMN units_quantity integer DEFAULT NULL;

COMMENT ON COLUMN public.order_items.units_quantity IS 
  'Explicit unit quantity when user edits units directly. 
   When null, calculate as quantity * product.pack_size';
```

### State Tracking in NewOrder.tsx
Add a field to track which was last edited:
```typescript
interface OrderProduct {
  // existing fields...
  lastEditedField: 'trays' | 'units' | null;
  unitsQuantity: number | null; // explicit units from DB
}
```

### Save Logic Update
```typescript
// When saving order items:
const orderItems = customerOrders.flatMap(co => 
  co.products.map(p => ({
    order_id: orderId,
    customer_name: co.customerName,
    product_code: p.productCode,
    quantity: p.trays,
    units_quantity: p.lastEditedField === 'units' ? p.units : null,
    sale_price_xcg: p.salePriceXcg,
    is_from_stock: p.isFromStock,
    // ...
  }))
);
```

### Load Logic Update
```typescript
// When loading order items:
const orderProduct = {
  trays: item.quantity,
  units: item.units_quantity ?? (item.quantity * product.pack_size),
  unitsQuantity: item.units_quantity,
  lastEditedField: item.units_quantity ? 'units' : null,
};
```

---

## Validation and Edge Cases

1. **Partial cases**: When units < pack_size, trays will be calculated as 1 (rounded up) but exact units are preserved
2. **Mixed editing**: If you edit trays first, then units - the last edit wins
3. **Backward compatibility**: Existing orders without `units_quantity` continue working (calculated from trays)
4. **CIF calculations**: Will use the correct unit count for weight and cost calculations
5. **Roundup table**: Will show correct totals based on actual units ordered

---

## Testing Checklist

After implementation:
- [ ] Create new order with partial case (e.g., 5 units when pack size is 12)
- [ ] Save and reopen - verify units still shows 5
- [ ] Edit trays field, save, reopen - verify units recalculates correctly
- [ ] Check CIF calculations use correct unit values
- [ ] Verify roundup totals are accurate
- [ ] Test editing by another staff member (management role)
