
# Fix: 404 Error When Editing Import Orders

## Problem Identified

In `src/pages/OrderDetails.tsx` (line 608), the **Edit Order** button navigates to an incorrect URL:

```typescript
// INCORRECT - This route doesn't exist
navigate(`/order/edit/${order.id}`)
```

But the actual route defined in `App.tsx` (line 268) is:

```typescript
// CORRECT route definition
<Route path="/import/orders/edit/:orderId" element={...} />
```

The navigation path `/order/edit/...` doesn't match any route in the application, causing the 404 error.

## Solution

Update the navigation path in `OrderDetails.tsx` to use the correct route:

```typescript
// FIXED
navigate(`/import/orders/edit/${order.id}`)
```

## Technical Change

| File | Line | Change |
|------|------|--------|
| `src/pages/OrderDetails.tsx` | 608 | Change `/order/edit/` to `/import/orders/edit/` |

### Code Change

**Before:**
```typescript
onClick={() => navigate(`/order/edit/${order.id}`)}
```

**After:**
```typescript
onClick={() => navigate(`/import/orders/edit/${order.id}`)}
```

## Expected Result

After this fix:
1. User creates an order successfully
2. User views the order in Order Details
3. User clicks "Edit Order" button
4. User is correctly navigated to the edit page with the order data loaded (instead of seeing 404)
