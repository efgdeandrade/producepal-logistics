

# Fix Retail Column Text Color

## Problem
The Retail column on line 705 uses the CSS class `text-accent-foreground`, which resolves to white (`0 0% 100%`) in both light and dark themes. This makes the retail price text invisible against the white table background.

## Fix

**File: `src/components/import/LandedCostPanel.tsx`, line 705**

Change:
```
text-accent-foreground
```
To:
```
text-foreground
```

This uses the standard foreground color (dark text on light backgrounds, light text on dark backgrounds), matching the other columns in the table.

**One-line change. No other files affected.**
