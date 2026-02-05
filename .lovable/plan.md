
# Duplicate Customer Feature for Distribution

## Overview
Add a "Duplicate" button to the Customers table that clones an existing customer's data (appending " (Copy)" to the name), clears the phone number (since it must be unique), and opens the edit dialog for immediate modification before saving.

## Use Case
Franchise businesses like "Burger Haus" have multiple locations (e.g., "Burger Haus CCB") that share similar attributes but have different addresses and phone numbers.

## Implementation

### Changes to `src/pages/fnb/FnbCustomers.tsx`

1. **Add Copy icon import**
   - Add `Copy` to the existing lucide-react imports

2. **Create `handleDuplicateCustomer` function**
   - Similar to the existing `handleDuplicateProduct` pattern in Products.tsx
   - Clone all customer fields except:
     - `id` (new customer)
     - `name` → append " (Copy)" 
     - `whatsapp_phone` → clear (user must enter unique phone)
   - Preserve: address, delivery zone, major zone, customer type, pricing tier, language, notes, coordinates
   - Open dialog in "create" mode (not edit mode)

3. **Add Duplicate button in Actions column**
   - Place between Edit and Delete buttons
   - Use `Copy` icon with tooltip "Duplicate this customer"
   - Trigger `handleDuplicateCustomer(customer)` on click

## Technical Details

```text
┌─────────────────────────────────────────────────────────────┐
│  Customers Table                                            │
├────────────┬────────────┬────────┬────────┬─────────────────┤
│ Name       │ WhatsApp   │ Zone   │ Lang   │ Actions         │
├────────────┼────────────┼────────┼────────┼─────────────────┤
│ Burger Haus│ +5999...   │ ...    │ PAP    │ ✏️ 📋 🗑️        │
│            │            │        │        │ Edit|Copy|Del   │
└────────────┴────────────┴────────┴────────┴─────────────────┘
                                              ↑
                                        New button
```

**New function logic:**
```typescript
const handleDuplicateCustomer = (customer: FnbCustomer) => {
  setEditingCustomer(null); // Create mode, not edit
  setFormData({
    name: `${customer.name} (Copy)`,
    whatsapp_phone: '', // Must be unique - user needs to enter new
    preferred_language: customer.preferred_language,
    address: customer.address || '',
    delivery_zone: customer.delivery_zone || '',
    major_zone_id: customer.major_zone_id || null,
    customer_type: customer.customer_type,
    notes: customer.notes || '',
    pricing_tier_id: customer.pricing_tier_id || null,
    latitude: null, // Clear - new location likely different
    longitude: null,
  });
  setDetectedZoneInfo(null);
  setIsDialogOpen(true);
  toast.success('Customer duplicated - enter new phone number and save');
};
```

## Behavior Summary
| Field | Duplicated? | Notes |
|-------|-------------|-------|
| Name | ✅ + " (Copy)" | User should edit for new location |
| Phone | ❌ Clear | Required unique - user must enter |
| Language | ✅ | Same franchise, same language |
| Address | ✅ | User can modify |
| Zones | ✅ | Preserved for nearby locations |
| Customer Type | ✅ | Same business type |
| Pricing Tier | ✅ | Same franchise pricing |
| Notes | ✅ | Can be edited |
| Coordinates | ❌ Clear | New location needs new coords |

## Files Changed
- `src/pages/fnb/FnbCustomers.tsx` - Add import, handler function, and UI button
