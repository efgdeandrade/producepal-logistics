# Implementation Plan: Optional Receipt Editing Before Creation

## Status: ✅ COMPLETED

## Overview
This plan adds an optional "Edit Before Creating" step in the receipt creation flow, allowing last-minute adjustments (quantity changes, adding items, moving items between customers) for the **customer receipt only** without affecting the supplier PO data.

## Files Created

### 1. `src/components/ReceiptEditDialog.tsx` ✅

A new dialog component that allows editing receipt items before generation.

**Features:**
- Displays items grouped by selected customer
- Inline quantity editing (number input per item)
- Remove item button (trash icon)
- "Add Item" button per customer to add any product from the catalog
- "Move to Another Customer" button when multiple customers selected
- Read-only price display with auto-calculated line totals
- Customer total and grand total display
- "Continue to Print" button that passes edited items back

---

## Files Modified

### 2. `src/pages/OrderDetails.tsx` ✅

- Added new state: `editableReceiptItems` and `showEditReceiptDialog`
- Added import for `ReceiptEditDialog` and `FileEdit` icon
- Added `handleEditBeforeReceipt()` and `handleConfirmEditedReceipt()` handlers
- Updated customer selection dialog with two buttons: "Create Receipt" and "Edit Before Creating"
- Updated receipt rendering to use `editableReceiptItems` when available
- Updated receipt number generation to use edited items
- Updated download handler to use edited items
- Reset `editableReceiptItems` on dialog close

---

## User Flow

```text
1. Click "Create Receipt" button
      ↓
2. Select Customers Dialog
      ↓
3. Two buttons appear:
   ├── [Create Receipt] → Direct to format selection → Generate & Print/Download
   │
   └── [Edit Before Creating] → Edit Receipt Dialog
                                        ↓
                                 - Adjust quantities
                                 - Add/remove items
                                 - Move between customers
                                        ↓
                                 [Continue to Print]
                                        ↓
                                 Format Dialog → Generate with edited items
```

---

## Key Behaviors

| Feature | Behavior |
|---------|----------|
| Quantity adjustment | Edit inline, auto-calculates totals |
| Add item | Opens dropdown with all products, adds to customer |
| Remove item | Removes from receipt only (not from order) |
| Move item | Transfers item to another selected customer |
| Data persistence | **None** - edited items are in-memory only |
| Original order | **Unchanged** - order_items table is never modified |
| Cancel edit | Discards all changes, returns to customer selection |
| Skip editing | User can use "Create Receipt" to skip entirely |

---

## No Database Changes Required

This feature operates entirely on the frontend with in-memory state. The `order_items` table and all supplier-related data remain untouched.
