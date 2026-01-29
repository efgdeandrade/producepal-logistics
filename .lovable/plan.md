
# Implementation Plan: Optional Receipt Editing Before Creation

## Overview
This plan adds an optional "Edit Before Creating" step in the receipt creation flow, allowing last-minute adjustments (quantity changes, adding items, moving items between customers) for the **customer receipt only** without affecting the supplier PO data.

## Files to Create

### 1. `src/components/ReceiptEditDialog.tsx` (NEW)

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

**Component Structure:**
```typescript
interface ReceiptEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItems: OrderItem[];
  selectedCustomers: string[];
  onConfirm: (editedItems: OrderItem[]) => void;
}
```

**Key State:**
- `editedItems` - Copy of order items that user modifies (in-memory only)
- `products` - Product catalog for pricing and add item dropdown
- `showAddItemDialog` - Controls add item modal per customer
- `showMoveDialog` - Controls move item modal

**UI Layout:**
```text
┌────────────────────────────────────────────────────────────────┐
│  Edit Receipt Items                                       [X]  │
│  Adjust quantities... These changes will NOT affect the order │
├────────────────────────────────────────────────────────────────┤
│  ┌── Customer Name ────────────────── Total: Cg 151.00 ────┐  │
│  │ Product      │ Qty(trays) │ Price  │ Total   │ Actions  │  │
│  │──────────────────────────────────────────────────────────│  │
│  │ STB_500      │   [10]     │ Cg 5.50│ Cg 55.00│ ➡️ 🗑    │  │
│  │ Strawberry   │            │        │         │          │  │
│  │ ×10 = 100 un │            │        │         │          │  │
│  │──────────────────────────────────────────────────────────│  │
│  │ [+ Add Item]                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│                              [Cancel]  [Continue to Print]     │
└────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### 2. `src/pages/OrderDetails.tsx`

**Add new state variables:**
```typescript
const [editableReceiptItems, setEditableReceiptItems] = useState<OrderItem[]>([]);
const [showEditReceiptDialog, setShowEditReceiptDialog] = useState(false);
```

**Update import:**
```typescript
import { ReceiptEditDialog } from '@/components/ReceiptEditDialog';
import { Edit } from 'lucide-react';
```

**Update customer selection dialog** (lines 926-957):

Add two buttons after customer selection:
- "Create Receipt" - Direct flow (existing)
- "Edit Before Creating" - Opens edit dialog first (new)

**New handler for edit flow:**
```typescript
const handleEditBeforeReceipt = () => {
  if (selectedCustomers.length === 0) {
    toast.error('Please select at least one customer');
    return;
  }
  setShowReceiptCustomerDialog(false);
  setShowEditReceiptDialog(true);
};

const handleConfirmEditedReceipt = (editedItems: OrderItem[]) => {
  setEditableReceiptItems(editedItems);
  setShowEditReceiptDialog(false);
  setPendingAction({ type: 'receipt', action: 'view' });
  setShowFormatDialog(true);
};
```

**Update receipt rendering** (lines 1013-1030):

Use `editableReceiptItems` if available, otherwise use original `orderItems`:
```typescript
{viewDialog === 'receipt' && order && (
  <div className="space-y-8">
    {selectedCustomers.map((customerName, index) => (
      <div 
        key={customerName}
        data-customer={customerName}
        className={index < selectedCustomers.length - 1 ? 'print:page-break-after-always' : ''}
      >
        <CustomerReceipt
          order={order}
          orderItems={editableReceiptItems.length > 0 ? editableReceiptItems : orderItems}
          customerName={customerName}
          format={printFormat}
          receiptNumber={receiptNumbers[customerName]}
        />
      </div>
    ))}
  </div>
)}
```

**Add ReceiptEditDialog component** (before closing `</div>`):
```typescript
<ReceiptEditDialog
  open={showEditReceiptDialog}
  onOpenChange={setShowEditReceiptDialog}
  orderItems={orderItems}
  selectedCustomers={selectedCustomers}
  onConfirm={handleConfirmEditedReceipt}
/>
```

**Reset edited items on dialog close:**
Update the view dialog close handler to also reset `editableReceiptItems`:
```typescript
onOpenChange={() => {
  setViewDialog(null);
  setPendingAction(null);
  setSelectedCustomers([]);
  setEditableReceiptItems([]); // Reset edited items
}}
```

---

## Updated User Flow

```text
1. Click "Create Receipt" button
      ↓
2. Select Customers Dialog (existing)
      ↓
3. Two buttons appear:
   ├── [Create Receipt] → 4a. Format Dialog → 5. Generate & Print/Download
   │
   └── [Edit Before Creating] → 4b. Edit Receipt Dialog
                                        ↓
                                 - Adjust quantities
                                 - Add/remove items
                                 - Move between customers
                                        ↓
                                 [Continue to Print]
                                        ↓
                                 4c. Format Dialog → 5. Generate with edited items
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

This feature operates entirely on the frontend with in-memory state. The `order_items` table and all supplier-related data remain untouched. Receipt records saved to `receipt_numbers` table will reflect the edited amounts.

---

## Files Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/components/ReceiptEditDialog.tsx` | Create | ~350 lines |
| `src/pages/OrderDetails.tsx` | Modify | ~40 lines added/changed |
