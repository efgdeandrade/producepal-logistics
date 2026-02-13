

# Fix: Deduct Stock from "Total units to order"

## Problem
The current formula `product.trays * product.packSize` does not subtract stock quantity. So if you order 10 cases and have 5 in stock, it still shows 10 * packSize instead of 5 * packSize.

## Fix (single line change in `src/pages/NewOrder.tsx`)

**Line 933** -- change:
```
const totalUnitsToOrder = product.trays * product.packSize;
```
to:
```
const totalUnitsToOrder = Math.max(0, product.trays - product.stockTrays) * product.packSize;
```

This ensures stock is deducted from the import order quantity. `Math.max(0, ...)` prevents negative values if stock exceeds order qty.

**Example**: Order Qty = 10 cases, Stock Qty = 5 cases, Pack Size = 20 --> Total units to order = (10 - 5) * 20 = **100**

No other files need to change.

