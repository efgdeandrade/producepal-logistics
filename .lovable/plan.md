
# Add Import Order Templates to Navigation

## Problem
The Standing Orders (Order Templates) feature for the Import department exists at `/import/standing-orders` but is not accessible because:
1. It's missing from the sidebar navigation in `ImportLayout.tsx`
2. It's missing from the mobile navigation in `ImportNav.tsx`

## Solution
Add the "Order Templates" link to both desktop sidebar and mobile navigation.

## Changes Required

### 1. Update ImportLayout.tsx
Add a new navigation item to the `importNavItems` array:
```typescript
{ path: '/import/standing-orders', label: 'Order Templates', icon: FileText }
```

### 2. Update ImportNav.tsx (Mobile Navigation)
Add the Order Templates link to the mobile bottom navigation for consistency.

## Technical Details

### File: `src/layouts/ImportLayout.tsx`
- Add `FileText` icon import from lucide-react
- Insert new nav item in the `importNavItems` array (position after "Suppliers" or before "Email Templates")

### File: `src/components/portals/ImportNav.tsx`
- Add Order Templates link to the mobile navigation menu

## Existing Functionality
The `StandingOrders.tsx` page provides:
- Day-based order templates (Tuesday, Wednesday, Friday)
- Customer + product management per template
- Auto-generate from last order feature
- Product roundup/aggregation view
- Uses `day_order_templates` and `day_order_template_items` database tables
