
# Fix: Exclude "From Stock" Items from CIF Calculations

## Problem Identified

Items marked as `is_from_stock = true` in the order are incorrectly being included in CIF calculations. These items:
- Are **already in your warehouse** (not being imported)
- Should **NOT incur freight costs**
- Should **NOT affect CIF calculations**
- Should **NOT appear** in supplier groupings within the CIF tables

### Example
In order `ORD-1769616092581`, the BLB_125 (Blueberries 125g) items were marked as "from stock" but are still appearing under NAU supplier in the CIF view because the filtering is not applied.

### Current Behavior vs Expected

| Component | Current | Expected |
|-----------|---------|----------|
| Supplier Order List | Correctly filters stock items | No change needed |
| Roundup Table | Correctly filters stock items | No change needed |
| OrderCIFTable | Includes ALL items | Filter out stock items |
| CIFAnalytics | Includes ALL items | Filter out stock items |
| DitoAdvisor | Includes ALL items | Filter out stock items |
| ActualCIFForm | Includes ALL items | Filter out stock items |
| CIFComparison | Includes ALL items | Filter out stock items |
| ImportOrderCIFView | Includes ALL items | Filter out stock items |

---

## Solution

Apply the same filtering pattern used for `SupplierOrderList` and `RoundupTable` to all CIF-related components.

### Files to Modify

#### 1. `src/pages/OrderDetails.tsx`

**Changes:**
- Create a filtered array for CIF calculations: `const cifOrderItems = orderItems.filter(item => !item.is_from_stock);`
- Pass `cifOrderItems` instead of `orderItems` to:
  - `OrderCIFTable`
  - `CIFAnalytics`
  - `ActualCIFForm`
  - `CIFComparison`
- Update `calculateWeightData()` to filter stock items before processing

#### 2. `src/pages/import/ImportOrderCIFView.tsx`

**Changes:**
- Update `OrderItem` interface to include `is_from_stock?: boolean`
- Fetch `is_from_stock` column from database when querying order items
- Filter items before passing to components:
  - `const cifOrderItems = orderItems.filter(item => !item.is_from_stock);`
- Update `calculateWeightData()` to filter stock items

---

## Technical Implementation

### OrderDetails.tsx Changes

```text
Location: Line ~157 (calculateWeightData function)

Before:
  const consolidated = items.reduce(...)

After:
  // Filter out stock items - they don't need CIF calculation
  const importItems = items.filter(item => !item.is_from_stock);
  const consolidated = importItems.reduce(...)
```

```text
Location: Lines ~957-1006 (CIF component props)

Before:
  <OrderCIFTable orderItems={orderItems} .../>
  <CIFAnalytics orderItems={orderItems} .../>
  <ActualCIFForm orderItems={orderItems} .../>
  <CIFComparison orderItems={orderItems} .../>

After:
  // Create filtered list for CIF (exclude stock items)
  const cifOrderItems = orderItems.filter(item => !item.is_from_stock);

  <OrderCIFTable orderItems={cifOrderItems} .../>
  <CIFAnalytics orderItems={cifOrderItems} .../>
  <ActualCIFForm orderItems={cifOrderItems} .../>
  <CIFComparison orderItems={cifOrderItems} .../>
```

### ImportOrderCIFView.tsx Changes

```text
Location: Line ~18 (OrderItem interface)

Before:
  interface OrderItem {
    id: string;
    customer_name: string;
    product_code: string;
    quantity: number;
  }

After:
  interface OrderItem {
    id: string;
    customer_name: string;
    product_code: string;
    quantity: number;
    is_from_stock?: boolean;
  }
```

```text
Location: Line ~94 (fetchOrderDetails query)

Before:
  .select('*')

After:
  .select('id, customer_name, product_code, quantity, is_from_stock')
  // (or keep '*' which already includes is_from_stock)
```

```text
Location: Line ~113 (calculateWeightData)

Before:
  const consolidated = items.reduce(...)

After:
  // Filter out stock items from CIF calculations
  const importItems = items.filter(item => !item.is_from_stock);
  const consolidated = importItems.reduce(...)
```

```text
Location: Lines ~268-319 (component rendering)

Before:
  <OrderCIFTable orderItems={orderItems} .../>
  <CIFAnalytics orderItems={orderItems} .../>

After:
  const cifOrderItems = orderItems.filter(item => !item.is_from_stock);

  <OrderCIFTable orderItems={cifOrderItems} .../>
  <CIFAnalytics orderItems={cifOrderItems} .../>
```

---

## Expected Result After Fix

For order `ORD-1769616092581`:
- BLB_125 (Blueberries) marked as "from stock" will **NOT appear** in:
  - CIF calculations
  - Supplier groupings (NAU will not show if all its products are from stock)
  - Weight/freight calculations
  - Pallet configurations
  - Dito Advisor recommendations
- Only imported items will be included in CIF analysis
- Total freight costs will be calculated only on imported goods

---

## Visual Indicator (Optional Enhancement)

Consider adding a badge in the order summary showing:
- **X items from stock** (excluded from CIF)
- **Y items imported** (included in CIF)

This provides transparency about what's being calculated.
