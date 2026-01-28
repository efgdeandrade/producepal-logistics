
# Add Custom Sale Price Editing to Import Orders

## Current Situation
- The Import order creation page (`NewOrder.tsx`) only shows quantity (Trays/Cases and Units)
- No price column exists in the `order_items` database table
- Products have `retail_price_xcg_per_unit` and `wholesale_price_xcg_per_unit` fields
- Customers have a `pricing_tier` field (wholesale/retail) that determines their default price

## What You Need
- See product prices when adding items to an order
- Override/edit prices for customers with custom pricing agreements
- Save the actual sale price used (whether default or custom)

## Solution

### Phase 1: Database Changes
Add a `sale_price_xcg` column to the `order_items` table to store the price at time of order (whether standard or custom):

```sql
ALTER TABLE order_items 
ADD COLUMN sale_price_xcg NUMERIC DEFAULT NULL;
```

### Phase 2: Update Order Creation Form (`NewOrder.tsx`)

**Enhance product data fetching:**
- Include `retail_price_xcg_per_unit` and `wholesale_price_xcg_per_unit` in the products query
- Include customer `pricing_tier` in the customers query

**Add price column to the order item table:**
```text
Before: Product | Trays/Cases | Units | Pack Size | [Delete]
After:  Product | Trays/Cases | Units | Price (XCG) | Pack Size | [Delete]
```

**Price input behavior:**
- Auto-populate with the correct tier price when a product is added (based on customer's pricing_tier)
- Make the price field editable so you can override it
- Show visual indicator when price differs from default (e.g., highlighted border)

**Update the OrderProduct interface:**
```typescript
interface OrderProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  packSize: number;
  trays: number;
  units: number;
  salePriceXcg: number | null;  // NEW: editable price field
  defaultPriceXcg: number | null;  // NEW: for comparison
}
```

### Phase 3: Save Price with Order Items
Update the save logic to include the sale price when inserting order items:

```typescript
const orderItems = customerOrders.flatMap(co => 
  co.products.map(p => ({
    order_id: order.id,
    customer_name: co.customerName,
    product_code: p.productCode,
    quantity: p.trays,
    sale_price_xcg: p.salePriceXcg,  // NEW
    po_number: null,
    customer_notes: co.notes || null,
  }))
);
```

### Phase 4: Show Line Totals (Optional Enhancement)
Add a "Total" column showing `quantity * price`:
```text
Product | Trays | Units | Price | Total | Pack Size
```

And show order total at the bottom of each customer's section.

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `sale_price_xcg` column to `order_items` |
| `src/pages/NewOrder.tsx` | Add price column, fetch tier prices, editable price input |
| `src/integrations/supabase/types.ts` | Auto-generated after migration |

## UI Preview

The product row in the order form will look like:

```text
┌─────────────────┬────────────┬────────┬──────────────┬───────────┬────┐
│ Product         │ Trays/Cases│ Units  │ Price (XCG)  │ Pack Size │    │
├─────────────────┼────────────┼────────┼──────────────┼───────────┼────┤
│ Arugula Baby    │ [  5  ]    │ [  90 ]│ [  4.65  ]   │ 18        │ 🗑 │
│ Spinach Baby    │ [  3  ]    │ [  54 ]│ [  5.50  ]*  │ 18        │ 🗑 │
└─────────────────┴────────────┴────────┴──────────────┴───────────┴────┘
* asterisk or highlight indicates custom price (different from default)
```

## Future Enhancement (Optional)
Create a `customer_product_prices` table to persist custom prices per customer-product combination, so custom pricing is remembered for future orders. This would be a follow-up feature.
