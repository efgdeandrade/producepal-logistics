

# Adjust Import Order Column Labels and Formula

## Changes (single file: `src/pages/NewOrder.tsx`)

### 1. Rename "Price (XCG)" to "Price (XCG) p/unit"
Line 923: Update the column header text.

### 2. Rename "Total" to "Total units to order"
Line 924: Update the column header text.

### 3. Fix the formula
Lines 932-933 and 992: Currently the "Total" column calculates a monetary total (`totalTrays * salePriceXcg`). Change it to show the number of units being ordered from the supplier (excluding stock):

- **Formula**: `product.trays * product.packSize`
- This gives the actual units to be ordered (import portion only, not counting stock)
- Example: Order Qty = 2 cases, Pack Size = 20 -> Total units to order = 40. If Stock Qty = 1 case, those stock units are excluded since `trays` only represents the import quantity.

Display as an integer (no decimal formatting), with a dash when zero.

