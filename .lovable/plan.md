

# Multi-Supplier Product Pricing - Workflow Design

## Current State

Products currently have a single `supplier_id` field with one cost price. The user needs to:
1. Buy the same product from **different suppliers** at **different prices**
2. **Manually select** which supplier to use per order (no automatic preference)

---

## Recommended Workflow

### Adding a New Product with Multiple Suppliers

When adding/editing a product, the form will have a new **"Supplier Pricing"** section:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Add New Product                                                │
├─────────────────────────────────────────────────────────────────┤
│  Product Code: [BLB_125]       Name: [Blueberries 125g]        │
│  Units/Case: [12]              Unit: [kg]                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  SUPPLIER PRICING                              [+ Add Supplier] │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Supplier: Farm Fresh Co                              [X] │  │
│  │ Cost USD/Unit: $3.20    Cost XCG/Unit: Cg 5.82          │  │
│  │ Lead Time: 3 days       Min Order Qty: 10               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Supplier: Berry Best Inc                             [X] │  │
│  │ Cost USD/Unit: $3.50    Cost XCG/Unit: Cg 6.37          │  │
│  │ Lead Time: 5 days       Min Order Qty: 5                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  SALE PRICES (Wholesale/Retail)                                │
│  [Existing fields stay the same]                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:
- **No "preferred" supplier** - user always chooses manually
- Each supplier entry has its own cost price (USD & XCG)
- Can add/remove suppliers at any time
- Sale prices (wholesale/retail) remain on the product since they're what you sell for

### Creating Orders - Manual Supplier Selection

When creating an order and generating supplier orders:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Supplier Order Summary                                         │
├─────────────────────────────────────────────────────────────────┤
│  Product              Qty    Supplier              Cost/Unit    │
│  ─────────────────────────────────────────────────────────────  │
│  Blueberries 125g     50     [Farm Fresh Co    ▼]   $3.20      │
│  Strawberries 500g    30     [Farm Fresh Co    ▼]   $4.50      │
│  Raspberries 125g     20     [Berry Best Inc   ▼]   $5.00      │
└─────────────────────────────────────────────────────────────────┘
                               ↑ Dropdown shows all suppliers
                                 for this product with their prices
```

---

## Technical Implementation

### 1. Database Changes

**Create `product_supplier_prices` table:**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID (FK) | Reference to products |
| supplier_id | UUID (FK) | Reference to suppliers |
| cost_price_usd | NUMERIC | Cost per unit in USD |
| cost_price_xcg | NUMERIC | Cost per unit in XCG |
| lead_time_days | INTEGER | Days to receive |
| min_order_qty | INTEGER | Minimum order quantity |
| notes | TEXT | Optional notes |
| created_at | TIMESTAMP | Auto timestamp |
| updated_at | TIMESTAMP | Auto timestamp |

- **Unique constraint** on (product_id, supplier_id)
- **No `is_preferred` field** since selection is always manual

### 2. Product Form Changes

Modify `ProductFormDialog.tsx`:
- Keep existing "primary supplier" dropdown for backward compatibility (optional)
- Add collapsible "Supplier Pricing" section below cost prices
- Each supplier entry shows: supplier dropdown, cost USD, cost XCG, lead time, min qty
- "Add Supplier" button to add more entries
- Remove button (X) on each entry

### 3. Order Flow Changes

Update order creation/summary:
- When calculating supplier orders, show a supplier selection dropdown per product
- Dropdown lists all suppliers for that product with their cost prices
- If product has no supplier pricing entries, use the legacy `supplier_id` from product
- Cost is pulled from the selected supplier's pricing

### 4. Migration Strategy

- Keep existing `supplier_id` and cost prices on products table (backward compatibility)
- New `product_supplier_prices` table stores the multi-supplier data
- Gradually migrate: when editing a product, can convert single supplier to multi-supplier

---

## Files to Modify

| File | Changes |
|------|---------|
| **Database** | New `product_supplier_prices` table |
| `src/components/ProductFormDialog.tsx` | Add supplier pricing section with add/remove capability |
| `src/pages/Products.tsx` | Handle CRUD for supplier pricing entries |
| `src/pages/NewOrder.tsx` | Add supplier selection dropdown per product in supplier order summary |
| `src/integrations/supabase/types.ts` | Auto-generated after migration |

---

## User Flow Summary

1. **Add Product** → Fill basic info → Click "Add Supplier" → Select supplier, enter cost → Repeat for more suppliers → Save
2. **Edit Product** → Modify supplier pricing entries as needed → Save
3. **Create Order** → Add customer orders → View supplier summary → **Select supplier per product** from dropdown → Submit

