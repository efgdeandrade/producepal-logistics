

# Fix: Exclude Stock from Supplier Orders and Roundup

## Problem
The "Total units to order" column in the order creation screen was fixed, but the **Supplier Order List** and **Order Roundup** documents still include stock quantities. For example, VDT ZEELANDIA has 5 cases of Cherry Tomatoes with `stock_quantity=5`, meaning all 5 are from stock. Zero should go to the supplier, but currently all 5 appear on the supplier PO.

## Root Cause
Both `SupplierOrderList.tsx` and `RoundupTable.tsx` use `item.quantity` without subtracting `stock_quantity`. Neither component even includes `stock_quantity` in its data interface.

## Changes

### 1. `src/components/SupplierOrderList.tsx`
- Add `stock_quantity` to the `OrderItem` interface
- In `getConsolidatedGroups()`, subtract `stock_quantity` from `quantity` before processing:
  - Net quantity = `Math.max(0, item.quantity - (item.stock_quantity || 0))`
- Skip items entirely where net quantity is zero (fully from stock)

### 2. `src/components/RoundupTable.tsx`
- Add `stock_quantity` to the `OrderItem` interface
- In `buildConsolidatedData()`, subtract `stock_quantity` from `quantity` when aggregating:
  - Net quantity = `Math.max(0, item.quantity - (item.stock_quantity || 0))`
- Skip items where net quantity is zero

### 3. Verify data flow
The components receive `orderItems` from the parent page which queries `order_items` directly. The `stock_quantity` column already exists in the database and is populated (confirmed from the live data). No database changes needed.

## Example (VDT ZEELANDIA CTO_250)
- quantity = 5, stock_quantity = 5
- Net = max(0, 5 - 5) = 0
- Result: Cherry Tomatoes will NOT appear on the supplier order for STEFANNYS FRUITS

