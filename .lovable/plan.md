

# Dynamic Quantity Column Based on Unit Filter

## What Changes
When you switch the unit filter (Piece / Case / Kg), the "Cases" column will update to show quantities in that unit. Hovering over the value will show the alternate representation.

## Behavior

| Unit Filter | Column Header | Column Value | Hover Tooltip |
|-------------|--------------|--------------|---------------|
| Piece       | Pieces       | qty_cases x pack_size | "X cases" |
| Case        | Cases        | qty_cases | "X pieces" |
| Kg          | Weight (kg)  | qty_cases x weight_per_case | "X cases" |

## Technical Details (single file: `src/components/import/LandedCostPanel.tsx`)

### 1. Update the column header (line 663)
Change from hardcoded `Cases` to dynamic based on `unitView`:
- `piece` -> "Pieces"
- `case` -> "Cases"  
- `kg` -> "Weight (kg)"

### 2. Update the cell value (line 686)
Replace the hardcoded `{alloc.qty_cases}` with:
- **piece**: `alloc.qty_cases * alloc.case_pack`
- **case**: `alloc.qty_cases`
- **kg**: `(alloc.qty_cases * alloc.weight_case_kg).toFixed(1)`

### 3. Add a hover tooltip on the cell
Wrap the value in a Tooltip (already imported via existing UI components) showing the alternate info:
- **piece**: tooltip says "X cases"
- **case**: tooltip says "X pieces (pack size: Y)"
- **kg**: tooltip says "X cases"

No new dependencies or database changes needed.
