
# Fix Margin Popup to Use Actual Wholesale & Retail Prices

## Problem
The hover popup currently uses `price_xcg` (a generic per-case price) as the "Current Sell Price" for margin calculations. But the products table has dedicated columns -- `wholesale_price_xcg_per_unit` (e.g. 9.00 for STB_500) and `retail_price_xcg_per_unit` (e.g. 12.95) -- that hold the real prices set on the product detail page.

## Fix (single file: `src/components/import/LandedCostPanel.tsx`)

### 1. Fetch the wholesale and retail prices from the database
Update the product query (line 73) to include:
- `wholesale_price_xcg_per_unit`
- `retail_price_xcg_per_unit`

### 2. Rewrite the margin popup to use the correct prices
In `renderMarginPopup` (lines 440-537):

**Wholesale section:**
- "Current Sell" uses `wholesale_price_xcg_per_unit` from the product (e.g. 9.00 XCG for STB_500)
- "Actual Margin" = `(wholesale_sell - landed_per_piece) / wholesale_sell * 100`

**Retail section:**
- "Current Sell" uses `retail_price_xcg_per_unit` (e.g. 12.95 XCG for STB_500)
- "Actual Margin" = `(retail_sell - landed_per_piece) / retail_sell * 100`

Both sections will compare per-unit (per-piece) values since the database prices are per-unit.

### 3. Remove the old "Per Piece" section
The separate per-piece block at the bottom (lines 507-528) becomes redundant since both Wholesale and Retail now show per-unit comparisons.

### 4. Update the "no price" fallback
Show the message only if both wholesale and retail prices are missing from the product record.

## Example: STB_500 popup after fix
```
STB_500 -- Strawberries Jumbo 500g
---------------------------------
WHOLESALE
  CIF Suggested:   $X.XX (per unit)
  Current Sell:    $9.00 (per unit)
  Target Margin:   20%
  Actual Margin:   Y.Y%
---------------------------------
RETAIL
  CIF Suggested:   $X.XX (per unit)
  Current Sell:    $12.95 (per unit)
  Target Margin:   44%
  Actual Margin:   Z.Z%
```
