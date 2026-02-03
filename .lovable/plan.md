
# Plan: Add Driver Packing Slips to Import Order Details ✅ IMPLEMENTED

## Status: Complete
Add a new document type "Driver Packing Slips" to the Import Order Details page. This feature allows you to:
1. Plan how many drivers will handle deliveries for an order
2. Assign customers to specific drivers for their routes
3. Generate a packing slip per driver showing their assigned customers and **aggregated totals** of all products across those customers

## What You'll See

### New Document Option
A new "Driver Packing Slips" section will appear in the Document Options card, alongside the existing Customer Packing Slips, Supplier Order Lists, and Total Roundup Table.

### Driver Planning Flow
1. Click "View" or "Download" on Driver Packing Slips
2. A dialog appears where you can:
   - Add/remove drivers (by name or select from existing drivers)
   - Drag-and-drop or checkbox-assign customers to each driver
   - See a preview of product totals for each driver
3. Generate/download the packing slips

### Driver Packing Slip Output (Per Driver)
Each driver gets their own slip showing:
- Driver name and route info
- List of customers assigned to them
- **Aggregated product totals** - Example:
  ```
  Driver A - 2 Customers:
  - Customer X
  - Customer Y
  
  Products to Load:
  ┌─────────────────────┬────────┬───────┐
  │ Product             │ Cases  │ Units │
  ├─────────────────────┼────────┼───────┤
  │ Strawberries 500g   │ 5      │ 50    │
  │ Blueberries 125g    │ 3      │ 36    │
  └─────────────────────┴────────┴───────┘
  Total: 8 cases = 86 units
  ```

---

## Implementation Details

### 1. Database: Driver Route Assignments for Orders
Create a new table to store driver-customer assignments per order:

```sql
CREATE TABLE import_order_driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  driver_id UUID REFERENCES profiles(id),
  customer_names TEXT[] NOT NULL,
  sequence_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

This stores which customers are assigned to which driver for a specific import order.

### 2. New Component: DriverPackingSlip
A component similar to `CustomerPackingSlip` but aggregates products:

| Props | Type | Description |
|-------|------|-------------|
| order | Order | The order details |
| orderItems | OrderItem[] | All order items |
| driverAssignments | Assignment[] | Driver-customer mappings |
| format | 'a4' \| 'receipt' | Print format |

The component will:
- Loop through each driver assignment
- Filter order items to only those customers
- Aggregate quantities by product code
- Display totals with cases/units calculation

### 3. New Component: DriverAssignmentDialog
A dialog for planning routes with:
- "Add Driver" button (text input or dropdown of existing drivers)
- List of unassigned customers from the order
- Per-driver customer list with add/remove capability
- Real-time preview of product totals per driver
- Save assignments to database

### 4. Update OrderDetails.tsx
Add new state and handlers:
```typescript
// New state
const [showDriverAssignmentDialog, setShowDriverAssignmentDialog] = useState(false);
const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);

// New viewDialog type
type ViewDialogType = 'packing' | 'supplier' | 'roundup' | 'receipt' | 'driver';
```

Add new document option card for "Driver Packing Slips" with View/Print/Download buttons.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/DriverPackingSlip.tsx` | Renders the aggregated packing slip per driver |
| `src/components/DriverAssignmentDialog.tsx` | UI for assigning customers to drivers |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/OrderDetails.tsx` | Add Driver Packing Slips section, state, handlers, and dialog rendering |
| Database Migration | Create `import_order_driver_assignments` table |

---

## UI Flow Diagram

```
Document Options Card
         │
         ├── Customer Packing Slips
         ├── Supplier Order Lists  
         ├── Total Roundup Table
         └── Driver Packing Slips ← NEW
                    │
                    ▼
     ┌─────────────────────────────────────┐
     │   Assign Customers to Drivers       │
     │   ─────────────────────────────     │
     │   [+ Add Driver]                    │
     │                                     │
     │   Driver: Eduardo G.                │
     │   ☑ Customer X                      │
     │   ☑ Customer Y                      │
     │   Preview: 5 cases strawberry...    │
     │                                     │
     │   Driver: (Add new driver...)       │
     │   ☐ Customer Z (unassigned)         │
     │                                     │
     │   ┌─────────┐  ┌─────────────────┐  │
     │   │ Cancel  │  │ View/Download   │  │
     │   └─────────┘  └─────────────────┘  │
     └─────────────────────────────────────┘
```

---

## Testing Steps
1. Navigate to an Import order with multiple customers
2. Click "View" on Driver Packing Slips
3. Add a driver (type a name)
4. Assign customers to the driver using checkboxes
5. Verify the product totals update correctly
6. Add a second driver and split customers
7. Click "Download" - verify each driver gets a separate PDF
8. Verify the totals aggregate correctly (e.g., 3 + 2 strawberry cases = 5 total)
