

# Plan: Add Supplier Selection for Downloading Supplier Order Lists

## Problem
Currently, when downloading supplier order lists, the system either downloads only 1 supplier or all suppliers without giving the user a choice. The user wants:
1. **Download All**: Each supplier as a separate PDF file (already works when multiple suppliers exist)
2. **Download Selected**: Ability to choose specific suppliers to download

## Solution Overview
Add a supplier selection dialog (similar to the existing customer selection for receipts) that appears before downloading supplier order lists. Users can select all or specific suppliers, then each selected supplier generates as a separate PDF file.

---

## Implementation Details

### 1. Add New State Variables
Add state to track:
- `showSupplierSelectDialog` - Controls visibility of supplier selection dialog
- `selectedSuppliers` - Array of selected supplier names

### 2. Create Supplier Selection Dialog
Create a new dialog component similar to the receipt customer selection dialog that:
- Lists all suppliers from the order
- Allows multi-select via checkboxes
- Has "Select All" / "Deselect All" options
- Shows count of selected suppliers

### 3. Update Download Flow
Modify the supplier download workflow:
1. When user clicks "Download" for supplier orders, show the selection dialog first
2. Filter supplier divs based on selected suppliers
3. Generate separate PDF for each selected supplier

### 4. Update SupplierOrderList Component
Ensure the component properly exposes which suppliers are available so the parent can list them for selection.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/OrderDetails.tsx` | Add supplier selection state, dialog, and updated download logic |

---

## UI Flow

```
User clicks "Download" on Supplier Order Lists
         │
         ▼
┌─────────────────────────────────┐
│  Select Suppliers to Download   │
│  ☑ Select All                   │
│  ─────────────────────────────  │
│  ☑ Supplier A                   │
│  ☑ Supplier B                   │
│  ☐ Supplier C                   │
│  ─────────────────────────────  │
│  2 suppliers selected           │
│  ┌─────────┐  ┌───────────────┐ │
│  │ Cancel  │  │ Download PDFs │ │
│  └─────────┘  └───────────────┘ │
└─────────────────────────────────┘
         │
         ▼
Downloads separate PDF for each selected supplier:
- Supplier-WK5-001-SupplierA.pdf
- Supplier-WK5-001-SupplierB.pdf
```

---

## Technical Details

### New State Variables
```typescript
const [showSupplierSelectDialog, setShowSupplierSelectDialog] = useState(false);
const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
```

### Supplier Discovery Function
Extract unique suppliers from order items by looking up product supplier relationships:
```typescript
const getUniqueSuppliers = async () => {
  // Fetch products with their suppliers
  // Return unique supplier names from order items
};
```

### Updated Download Logic
```typescript
// Filter to only selected suppliers
const suppliers = Array.from(supplierDivs)
  .filter(div => selectedSuppliers.includes(div.getAttribute('data-supplier') || ''))
  .map((div) => ({
    element: div as HTMLElement,
    supplierName: div.getAttribute('data-supplier') || 'Unknown'
  }));
```

---

## Testing Steps
1. Navigate to an order with items from multiple suppliers
2. Click "Download" for Supplier Order Lists
3. Verify the supplier selection dialog appears
4. Select specific suppliers
5. Click "Download PDFs"
6. Verify only selected suppliers are downloaded as separate PDFs
7. Test "Select All" functionality
8. Test downloading with only one supplier selected

