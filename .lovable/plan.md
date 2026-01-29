

# Optimize Receipt Printing for Thermal Printers

## Overview

This plan addresses the light ink output issue on thermal receipt printers by enhancing font weight, increasing text contrast, and improving border visibility across all receipt components.

## Components to Update

| Component | Location |
|-----------|----------|
| CustomerReceipt | `src/components/CustomerReceipt.tsx` |
| CustomerPackingSlip | `src/components/CustomerPackingSlip.tsx` |
| ProductionReceipt | `src/components/ProductionReceipt.tsx` |

## Optimization Strategy

### 1. Font Weight Improvements
- Change all product names, quantities, and totals from regular to **bold** (`font-bold`)
- Use `font-extrabold` for critical values like totals and headers

### 2. Font Size Increases
- Upgrade `text-xs` (12px) to `text-sm` (14px) for better legibility
- Keep receipt format slightly smaller but still readable

### 3. Border Enhancements
- Replace `border-b` (1px) with `border-b-2` (2px) for table rows
- Use `border-b-4` for major section dividers
- Replace gray borders (`border-gray-300`) with black (`border-black`)

### 4. Eliminate Gray Text
- Replace all gray text colors (`text-gray-600`, `text-gray-500`, `text-gray-400`) with `text-black`
- Ensure maximum contrast for thermal printing

### 5. Font Family
- Switch from thin monospace (`Courier New`) to heavier sans-serif for receipt format
- Use `font-sans` with explicit bold weights

### 6. Print-Specific High Contrast Mode
- Add `@media print` CSS rules to force maximum contrast
- Ensure bold text is properly rendered during printing

---

## Technical Changes

### CustomerReceipt.tsx

| Line | Change |
|------|--------|
| 102-103 | Add print-optimized class and high-contrast styles |
| 116-122 | Replace `text-gray-700` with `text-black`, add `font-medium` |
| 160-170 | Make product codes `font-bold`, remove gray text colors |
| 173-178 | Use `font-extrabold` for totals |
| Add | Include print-specific CSS for high contrast |

### CustomerPackingSlip.tsx

| Line | Change |
|------|--------|
| 60-63 | Add high-contrast print class |
| 88-92 | Replace 1px borders with 2px, use black color |
| 99-107 | Make product codes `font-bold`, replace gray with black |
| 110-124 | Use `font-extrabold` for totals |
| 133-142 | Enhance print CSS with high-contrast rules |

### ProductionReceipt.tsx

| Line | Change |
|------|--------|
| 48-70 | Switch to sans-serif font family, add high-contrast print CSS |
| 75-78 | Make date text `font-bold` and upgrade from `text-xs` to `text-sm` |
| 82-85 | Replace `border-gray-400` with `border-black`, use `font-bold` |
| 92-115 | Make all table text bold, replace gray borders with black |
| 129-142 | Use `font-bold` for signature labels |

---

## New Print CSS Block (to be added to each component)

```css
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .high-contrast-print {
    font-family: Arial, Helvetica, sans-serif !important;
  }
  .high-contrast-print * {
    color: #000 !important;
    font-weight: 600 !important;
  }
  .high-contrast-print h1,
  .high-contrast-print h2,
  .high-contrast-print .font-bold,
  .high-contrast-print .font-extrabold,
  .high-contrast-print th,
  .high-contrast-print tfoot td {
    font-weight: 900 !important;
  }
  .high-contrast-print table {
    border-collapse: collapse;
  }
  .high-contrast-print tr {
    border-bottom: 2px solid #000 !important;
  }
}
```

---

## Expected Results

| Before | After |
|--------|-------|
| Light, thin text | Bold, heavy text |
| Gray secondary text | Pure black text |
| 1px gray borders | 2px black borders |
| Courier New (thin) | Arial/Sans-serif (heavier) |
| Mixed font weights | Consistent bold/extrabold |

## Files to Modify

1. `src/components/CustomerReceipt.tsx`
2. `src/components/CustomerPackingSlip.tsx`
3. `src/components/ProductionReceipt.tsx`

