

# Fix: Exclude "In Stock" Items from Supplier PO and Roundup

## Problem

Items marked as `is_from_stock = true` are currently appearing on:
- Supplier Order List (PO to send to suppliers)
- Order Roundup (checklist for receiving products)

This is incorrect behavior. "In stock" items should only appear on:
- Customer receipts
- Customer packing slips

## Root Cause

The `SupplierOrderList` and `RoundupTable` components receive all `orderItems` without filtering out items where `is_from_stock = true`.

## Solution

Filter out items with `is_from_stock = true` when passing `orderItems` to these components.

## Technical Changes

| File | Changes |
|------|---------|
| `src/pages/OrderDetails.tsx` | Update OrderItem interface to include `is_from_stock`, filter items before passing to SupplierOrderList and RoundupTable |
| `src/components/SupplierOrderList.tsx` | Update OrderItem interface to include `is_from_stock` for type safety |
| `src/components/RoundupTable.tsx` | Update OrderItem interface to include `is_from_stock` for type safety |

### 1. Update OrderDetails.tsx

**Update the OrderItem interface** (around line 43-49):
```typescript
interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  is_from_stock?: boolean;  // NEW
}
```

**Filter items for Supplier and Roundup views** (around lines 1057-1068):

Replace:
```typescript
{viewDialog === 'supplier' && order && (
  <SupplierOrderList 
    order={order} 
    orderItems={orderItems} 
    format={printFormat}
  />
)}
{viewDialog === 'roundup' && order && (
  <RoundupTable 
    order={order} 
    orderItems={orderItems} 
    format={printFormat}
  />
)}
```

With:
```typescript
{viewDialog === 'supplier' && order && (
  <SupplierOrderList 
    order={order} 
    orderItems={orderItems.filter(item => !item.is_from_stock)} 
    format={printFormat}
  />
)}
{viewDialog === 'roundup' && order && (
  <RoundupTable 
    order={order} 
    orderItems={orderItems.filter(item => !item.is_from_stock)} 
    format={printFormat}
  />
)}
```

### 2. Update SupplierOrderList.tsx

**Update OrderItem interface** (lines 4-9):
```typescript
interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  is_from_stock?: boolean;
}
```

### 3. Update RoundupTable.tsx

**Update OrderItem interface** (lines 4-9):
```typescript
interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  is_from_stock?: boolean;
}
```

## Expected Result After Fix

| Document Type | "In Stock" Items |
|---------------|------------------|
| Customer Receipt | Included |
| Customer Packing Slip | Included |
| Supplier Order (PO) | **Excluded** |
| Order Roundup | **Excluded** |

This aligns with the intended behavior: stock items are already in your warehouse, so they don't need to be ordered from suppliers or counted when receiving shipments.

## Files Summary

| File | Action |
|------|--------|
| `src/pages/OrderDetails.tsx` | Modify interface + filter orderItems |
| `src/components/SupplierOrderList.tsx` | Update interface for type safety |
| `src/components/RoundupTable.tsx` | Update interface for type safety |

