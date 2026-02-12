
# Add Margin Hover Popup + Method Filter + Fix Retail Column

## Overview
When you hover over a product row in the CIF allocation table, a popup will appear showing margin details comparing the CIF-calculated prices against the product's current selling price (`price_xcg` from the products table). The allocation method will be added as a filter dropdown (like Per Piece / Estimate). The blank Retail column will also be fixed.

## Changes (all in `src/components/import/LandedCostPanel.tsx`)

### 1. Fetch current selling price
Add `price_xcg` and `price_per_piece` to the product query (line 60) so we have the current selling prices to compare against:
```
.select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd_per_unit, price_usd, price_xcg, price_per_piece")
```

### 2. Add Method filter dropdown
Add a new `Select` dropdown next to the existing Estimate/Actual and Per Piece/Per Case filters (around line 437). Options will include:
- Chargeable Weight (default)
- Actual Weight
- Volume
- Value
- Cases
- Pieces
- Equal

When changed, the selected method will be applied to all effective cost components' `allocation_basis`, causing the engine to recalculate costs using that distribution method.

### 3. Hover popup on each table row
Wrap each `TableRow` (line 548) in a `HoverCard` component. When the user hovers on a row, a popup will show:

```
------------------------------------
STB_500 - Strawberry 500g
------------------------------------
Wholesale (CIF):   $X.XX
Current Sell Price: $Y.YY (XCG)
W. Margin:         20%
Actual Margin:     Z%  (calculated from sell price vs landed cost)
------------------------------------
Retail (CIF):      $X.XX
R. Margin:         44%
------------------------------------
```

This compares the engine's suggested prices (with the configured 20%/44% margins) against the product's actual current selling price, showing the real margin the business is making.

### 4. Fix blank Retail column
Add a null-safe fallback so the Retail cell displays `--` when the value is null or undefined.

## Technical Details

- Uses the existing `HoverCard` / `HoverCardTrigger` / `HoverCardContent` components already in the project
- The current selling price comes from `products.price_xcg` (per case in XCG) and `products.price_per_piece`
- Actual margin is calculated as: `(selling_price - landed_cost) / selling_price * 100`
- The product data (`prod`) is already available in the `cifProducts` memo -- we just need to store it alongside so it's accessible during rendering
- A new state variable `allocationMethod` controls the method filter
