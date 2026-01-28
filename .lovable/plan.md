
# Add Consistent Spacing Across All Portal Layouts

## Summary

Fix missing margin/padding spacing by updating all layout files to include consistent padding on the `<main>` element. This is a one-time fix that ensures all current and future pages have proper breathing room from the edges.

## Current State

| Layout | Desktop Padding | Mobile Padding |
|--------|-----------------|----------------|
| ImportLayout | None | None |
| DistributionLayout | None | None |
| LogisticsLayout | None | None |
| ProductionLayout | None | None |
| HRLayout | None | None |
| AdminLayout | `p-6` | `p-4` |

Only AdminLayout currently has proper spacing. The other 5 layouts leave it to individual pages, causing inconsistency.

## Solution

Add `p-4 md:p-6` to desktop main and `p-4` to mobile main across all layouts, matching AdminLayout's pattern.

## Files to Modify

### 1. ImportLayout.tsx
- **Desktop main (line 118):** `flex-1` → `flex-1 p-4 md:p-6`
- **Mobile main (line 81):** `flex-1 pb-20` → `flex-1 pb-20 p-4`

### 2. DistributionLayout.tsx
- **Desktop main (line 130):** `flex-1` → `flex-1 p-4 md:p-6`
- **Mobile main (line 91):** Add `p-4` to existing classes

### 3. LogisticsLayout.tsx
- **Desktop main:** `flex-1` → `flex-1 p-4 md:p-6`
- **Mobile main:** `flex-1 pb-20` → `flex-1 pb-20 p-4`

### 4. ProductionLayout.tsx
- **Desktop main:** `flex-1` → `flex-1 p-4 md:p-6`
- **Mobile main:** `flex-1 pb-20` → `flex-1 pb-20 p-4`

### 5. HRLayout.tsx
- **Desktop main:** `flex-1` → `flex-1 p-4 md:p-6`
- **Mobile main:** `flex-1 pb-20` → `flex-1 pb-20 p-4`

### 6. AdminLayout.tsx
- Already has proper padding - no changes needed

## Result

All pages across all portals will have:
- **Mobile:** 16px (1rem) padding on all sides
- **Desktop:** 24px (1.5rem) padding on all sides

This creates consistent breathing room and ensures no content touches the edges.

## Benefits

- Single source of truth for spacing
- All existing pages automatically get proper margins
- New pages added in the future will inherit consistent spacing
- No need to add container/padding classes to individual page components
