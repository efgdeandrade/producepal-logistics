
# Plan: Fix Import Receipt 80mm Layout and Multi-Customer Page Separation

## Problem Summary
1. **80mm Receipt Width Issues**: The current CustomerReceipt layout has content that doesn't fit well on 80mm thermal paper width
2. **Multi-Customer Page Separation**: When multiple customers are selected, each customer should appear on a completely separate page

## Root Cause Analysis

### 80mm Width Issues
The CustomerReceipt component uses:
- A 4-column table (Item, Qty, Price, Total) which is cramped on 80mm
- Column borders (`border-l border-black`) taking up valuable space
- Some text may be too large for the narrow format

### Page Separation
The current code DOES use `generateMultipleReceiptsPDF` which creates separate pages, but we need to ensure:
- The `data-customer` attribute is correctly detected
- Each customer's content fits properly without overflow

---

## Solution

### 1. Optimize CustomerReceipt for 80mm Thermal Paper

**Changes to `src/components/CustomerReceipt.tsx`:**

| Current Issue | Fix |
|---------------|-----|
| 4-column table too wide | Use 3 columns for receipt: Product, Qty, Amount (combine price calculation) |
| Column borders take space | Remove internal column borders for receipt format |
| Text size still large | Use smaller font sizes (text-xs for headers, text-sm for body) |
| Padding too generous | Reduce padding (p-2 instead of p-3 or p-6) |
| Logo too large | Reduce logo height to h-6 for receipt format |
| Full header on receipt | Streamline header info for thermal width |

**Optimized 80mm Layout Structure:**
```
┌─────────────────────────────────────┐
│        [Logo h-6]                   │
│     Company Name                    │
│   Address • Phone • Email           │
├─────────────────────────────────────┤
│          RECEIPT                    │
│   #: XXX-YYY | 2026-02-03          │
├─────────────────────────────────────┤
│   Customer: Example Shop            │
├─────────────────────────────────────┤
│ Product            Qty    Amount    │
├─────────────────────────────────────┤
│ Strawberries 500g   50    150.00    │
│ Blueberries 125g    36     72.00    │
├─────────────────────────────────────┤
│              Total: Cg 222.00       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │     SIGNATURE / STAMP           │ │
│ │                                 │ │
│ │ - - - - - - - - - - - - - - - - │ │
│ │   Received in good condition    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2. Ensure Proper Page Separation in PDF Generation

**Verify in `src/pages/OrderDetails.tsx`:**
- The receipt download logic already uses `generateMultipleReceiptsPDF`
- Each customer is wrapped in a div with `data-customer` attribute
- The function iterates through each customer element and creates separate pages

**No changes needed for page separation** - the current implementation is correct. The issue may be a visual preview concern, but the downloaded PDF will have separate pages.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/CustomerReceipt.tsx` | Optimize layout for 80mm: reduce columns, smaller fonts, remove internal borders, compact spacing |

---

## Detailed Changes for CustomerReceipt.tsx

### Table Structure Change (Receipt Format Only)
**From:** 4 columns (Item, Qty, Price, Total) with borders
**To:** 3 columns (Product, Qty, Amount) without internal borders

### Font Size Adjustments (Receipt Format)
- Headers: `text-xs` (was `text-sm`)
- Body content: `text-sm` (keep)
- Receipt title: `text-base` (was `text-lg`)
- Company name: `text-sm` (was `text-base`)

### Spacing Adjustments (Receipt Format)
- Container padding: `p-2` (was `p-3`)
- Section margins: `mb-1` (was `mb-2`)
- Table row padding: `py-1` (was `py-3`)
- Signature box height: `h-16` (was `h-20`)

### Remove for Receipt Format
- Column borders (`border-l border-black`)
- Quantity breakdown (`3×10`)
- Reduce header info to single line

---

## Testing Verification Steps
1. Navigate to an Import order with multiple customers
2. Click on "Customer Receipts" and select 2+ customers
3. Choose "Receipt (80mm)" format
4. Click "Download PDF"
5. Open the PDF and verify:
   - Each customer appears on a completely separate page
   - Content fits within 80mm width without overflow
   - Text is legible and properly sized
   - Table columns are not cramped
6. Test printing on actual thermal printer if available
