
# Plan: Unified Driver Packing Slips (Import + Distribution)

## The Concept

You're absolutely right - this is actually simpler than it sounds! Here's what we're solving:

**Current State:**
- Import orders (Supermarkets) have their own driver packing slips
- Distribution orders (Restaurants/Hotels) are completely separate

**Goal:**
When a driver has BOTH Import customers AND Distribution customers on the same day, generate ONE unified packing slip that shows:
1. All customers (Import + Distribution) assigned to that driver
2. Combined product totals - but ONLY for products that exist in Import

**The Smart Filter:**
If Import order has: Strawberries, Blueberries
Distribution can ONLY add: Customers who ordered Strawberries or Blueberries
Distribution customers ordering Banana? They won't appear (wrong product type)

---

## How It Will Work

### Step 1: Product Mapping Table
First, we need a way to connect Import products with Distribution products (since they have different codes/names).

Example:
| Import Product | Distribution Product |
|----------------|---------------------|
| STB_500 (Strawberries 500g) | STRAWBERRY_KG |
| BLB_125 (Blueberries 125g) | BLUEBERRY_125 |

### Step 2: Enhanced Driver Assignment Dialog
When you open "Driver Packing Slips" for an Import order:
1. Shows Import customers (as it does now)
2. NEW: Shows a toggle "Include Distribution orders for this date"
3. When enabled, automatically finds Distribution orders for the same delivery date
4. Filters to ONLY show Distribution customers whose orders contain mapped products

### Step 3: Unified Packing Slip Output
The packing slip will show:

```
Driver: Eduardo G.
Route #1 - 5 Stops

=== IMPORT CUSTOMERS (Supermarkets) ===
1. Centrum Supermarket
2. Mangusa Hypermarket

=== DISTRIBUTION CUSTOMERS (Restaurants) ===  
3. Kura Hulanda Restaurant
4. Blues Bar & Grill
5. Gouverneur Hotel

----------------------------
Products to Load:
┌──────────────────────────────┬────────┬───────┐
│ Product                      │ Qty    │ Units │
├──────────────────────────────┼────────┼───────┤
│ Strawberries 500g            │ 15     │ 150   │
│ Blueberries 125g             │ 8      │ 96    │
└──────────────────────────────┴────────┴───────┘
Total: 23 cases = 246 units
```

---

## Implementation Details

### Database Changes

**New Table: `cross_department_product_mappings`**
Links Import products to their Distribution equivalents:
```sql
CREATE TABLE cross_department_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_product_code TEXT NOT NULL,  -- From 'products' table
  distribution_product_id UUID NOT NULL, -- From 'distribution_products'
  conversion_factor NUMERIC DEFAULT 1, -- e.g., 1 Import case = X Distribution units
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Update: `import_order_driver_assignments`**
Add columns to track Distribution customers:
```sql
ALTER TABLE import_order_driver_assignments
ADD COLUMN distribution_customer_ids UUID[] DEFAULT '{}',
ADD COLUMN include_distribution BOOLEAN DEFAULT false;
```

### UI Changes

**DriverAssignmentDialog.tsx**
- Add toggle: "Include Distribution orders for this delivery date"
- When enabled, fetch Distribution orders for the same date
- Filter Distribution customers to only those with matching products
- Show Distribution customers in a separate section with visual distinction
- Allow assigning Distribution customers to drivers alongside Import customers

**DriverPackingSlip.tsx**
- Accept both Import order items AND Distribution order items
- Group customers by source (Import vs Distribution)
- Aggregate products using the mapping table
- Show unified totals

### New Component

**ProductMappingManager.tsx** (Settings page)
A simple interface to create/manage product mappings between Import and Distribution products:
- Left column: Import products
- Right column: Distribution products
- Click to link them

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/settings/ProductMappingManager.tsx` | UI to link Import ↔ Distribution products |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/DriverAssignmentDialog.tsx` | Add Distribution toggle, fetch matching orders, show combined customers |
| `src/components/DriverPackingSlip.tsx` | Support unified output from both sources |
| `src/pages/Settings.tsx` | Add Product Mapping section |
| Database Migration | Create mapping table, update assignments table |

---

## User Flow

```
Import Order (WK5-001) - Delivery Date: Feb 5, 2026
                    │
                    ▼
        ┌─────────────────────────────────┐
        │  Assign Customers to Drivers    │
        │  ═══════════════════════════    │
        │                                 │
        │  ☑ Include Distribution orders  │
        │    for Feb 5, 2026              │
        │                                 │
        │  ─── Driver: Eduardo G. ───     │
        │                                 │
        │  IMPORT CUSTOMERS:              │
        │  ☑ Centrum Supermarket          │
        │  ☑ Mangusa Hypermarket          │
        │                                 │
        │  DISTRIBUTION CUSTOMERS:        │
        │  (matching products only)       │
        │  ☑ Kura Hulanda (Strawberry)    │
        │  ☑ Blues Bar (Strawberry,       │
        │              Blueberry)         │
        │  ☐ Hotel X (Banana) ← disabled  │
        │                                 │
        │  ┌────────────────────────────┐ │
        │  │ Generate Unified Slips    │ │
        │  └────────────────────────────┘ │
        └─────────────────────────────────┘
```

---

## Product Mapping Example

To make this work seamlessly, you'll set up mappings once in Settings:

| Import Product | → | Distribution Product |
|----------------|---|---------------------|
| STB_500 | → | STRAWBERRY_KG |
| STB_250 | → | STRAWBERRY_250 |
| BLB_125 | → | BLUEBERRY_125 |
| BLB_250 | → | BLUEBERRY_250 |

Then the system automatically knows:
- If Import order has STB_500, show Distribution customers who ordered STRAWBERRY_KG
- Convert quantities using the conversion factor if needed

---

## Alternative Approach

If you prefer NOT to manually map products, we could use:
1. **Auto-matching by name**: System tries to match "Strawberries 500g" to "Strawberry" automatically
2. **Consolidation groups**: Use the existing `consolidation_group` field to group related products

Would you prefer the manual mapping approach (more accurate) or automatic name matching (easier setup but may have mismatches)?

---

## Testing Steps
1. Create product mappings in Settings (link 2-3 Import products to Distribution)
2. Create an Import order with those products for a specific date
3. Ensure there are Distribution orders with matching products on the same date
4. Open Driver Packing Slips for the Import order
5. Enable "Include Distribution orders"
6. Verify only matching Distribution customers appear
7. Assign customers from both departments to a driver
8. Generate the unified packing slip
9. Verify products are aggregated correctly across both sources
