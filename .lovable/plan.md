
# Fix: Supplier Order List Showing Stale Data After Order Update

## Problem Summary
When editing an order and saving, the printed supplier order list shows old data (previous items and wrong delivery date) instead of the updated values. This happens because:

1. **Navigation doesn't trigger refetch**: When navigating from edit page back to order details, the `useEffect` may not re-run since `orderId` hasn't changed
2. **Missing dependency on navigation state**: The component doesn't know it needs to refresh after an update

---

## Solution Overview

Two complementary fixes are needed:

### Fix 1: Force Refetch on Navigation Back from Edit Page
Add a navigation state or use React Router's `useLocation` to detect when returning from an edit action and force a data refetch.

### Fix 2: Use a Key to Force Remount on Navigation
Pass a unique key based on navigation to force the OrderDetails component to completely remount when returning from the edit page.

---

## Technical Implementation

### 1. Update NewOrder.tsx - Pass State When Navigating

After saving an order, pass state to indicate the page should refresh:

```typescript
// Line 597 in NewOrder.tsx - change navigate call
navigate(`/import/orders/${orderId}`, { state: { updated: Date.now() } });
```

### 2. Update OrderDetails.tsx - Detect Navigation State and Refetch

Add `useLocation` hook and update the useEffect to trigger refetch when state changes:

```typescript
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Inside component
const location = useLocation();

useEffect(() => {
  if (orderId) {
    fetchOrderDetails();
    fetchFreightSettings();
    checkActualCosts();
  }
}, [orderId, location.state]); // Add location.state as dependency
```

### 3. Alternative: Force Component Remount via Route Key

If the above doesn't work reliably, use a key on the route in App.tsx:

```tsx
<Route 
  path="/import/orders/:orderId" 
  element={
    <ProtectedImport>
      <OrderDetailsWrapper />
    </ProtectedImport>
  } 
/>
```

Where `OrderDetailsWrapper` passes a key from location state:

```typescript
const OrderDetailsWrapper = () => {
  const location = useLocation();
  return <OrderDetails key={location.state?.updated || 'default'} />;
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/NewOrder.tsx` | Pass `{ state: { updated: Date.now() } }` in navigate call |
| `src/pages/OrderDetails.tsx` | Add `useLocation` and include `location.state` in useEffect dependency |

---

## Testing Steps

1. Open an existing order
2. Click Edit
3. Change the delivery date (e.g., from Feb 2 to Feb 3)
4. Modify order items (add/remove products)
5. Save the order
6. Click "View" for Supplier Order List
7. **Verify**: The new delivery date and updated items appear
8. Download/Print the supplier order PDF
9. **Verify**: The PDF contains the correct updated data

---

## Why This Works

- Passing `state` with a timestamp ensures React Router treats this as a "new" navigation
- Including `location.state` in the useEffect dependencies forces the fetch functions to re-run
- The timestamp changes every time, guaranteeing fresh data after each save
