

# Add Editable Unit and Price to Quick Paste Order Review

## Problem
When AI parses a WhatsApp order in Quick Paste, users can review and edit quantity and select different products, but they **cannot edit the unit or price**. The unit is shown as read-only text and the price is auto-calculated from the product default.

## Solution
Add editable input fields for both unit and price in the review step, allowing users to:
- Change the unit (e.g., from "kg" to "pcs" or custom units)
- Override the price per unit for special deals or discounts

## Visual Changes

```text
Current UI:                          New UI:
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ "5 kilo tomato"             │      │ "5 kilo tomato"             │
│                             │      │                             │
│ Quantity        Unit        │      │ Quantity        Unit        │
│ ┌──────────┐   kg (text)    │      │ ┌──────────┐   ┌─────────┐  │
│ │    5     │                │      │ │    5     │   │   kg    │  │
│ └──────────┘                │      │ └──────────┘   └─────────┘  │
│                             │      │                             │
│ Product                     │      │ Product          Price/Unit │
│ ┌────────────────────────┐  │      │ ┌─────────────┐ ┌─────────┐ │
│ │ Select product...      │  │      │ │ Tomato Red  │ │  2.50   │ │
│ └────────────────────────┘  │      │ └─────────────┘ └─────────┘ │
│                             │      │                             │
│ [AI Match]     ƒ12.50 total │      │ [AI Match]     ƒ12.50 total │
└─────────────────────────────┘      └─────────────────────────────┘
```

## Technical Implementation

### File: `src/components/fnb/QuickPasteOrder.tsx`

**Change 1: Make Unit Editable (lines 308-326)**
Replace the read-only unit text span with an editable Input field:

```tsx
{/* Quantity + Unit - Side by side */}
<div className="space-y-2">
  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    Quantity & Unit
  </label>
  <div className="flex items-center gap-2">
    <Input
      type="number"
      value={item.quantity}
      onChange={(e) => updateMatchedItem(index, { quantity: Number(e.target.value) })}
      className="flex-1 h-12 text-center text-lg"
      min={0.1}
      step={0.1}
    />
    <Input
      type="text"
      value={item.unit}
      onChange={(e) => updateMatchedItem(index, { unit: e.target.value })}
      className="w-20 h-12 text-center"
      placeholder="unit"
    />
  </div>
</div>
```

**Change 2: Add Editable Price Field (lines 328-352)**
Add a price input next to the product selector, updating the layout to a 2-column approach:

```tsx
{/* Product + Price - Side by side on larger screens */}
<div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-3">
  <div className="space-y-2">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Product
    </label>
    <SearchableSelect ... />
  </div>
  <div className="space-y-2">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Price/Unit
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">ƒ</span>
      <Input
        type="number"
        value={item.suggested_price || ''}
        onChange={(e) => updateMatchedItem(index, { 
          suggested_price: e.target.value ? Number(e.target.value) : null 
        })}
        className="pl-7 h-10 w-24"
        min={0}
        step={0.01}
        placeholder="0.00"
      />
    </div>
  </div>
</div>
```

### File: `src/hooks/useConversationImport.ts`

**Update `updateMatchedItem` function** to support changing `unit` field:

The existing `updateMatchedItem` function already uses a generic update pattern, but we need to ensure it properly handles the `unit` field updates without marking them as "manually changed" for product purposes.

```tsx
const updateMatchedItem = useCallback((index: number, updates: Partial<MatchedConversationItem>) => {
  setMatchedItems(prev => {
    const newItems = [...prev];
    newItems[index] = {
      ...newItems[index],
      ...updates,
      // Only mark as manually changed if product was changed
      was_manually_changed: updates.matched_product_id !== undefined 
        ? true 
        : newItems[index].was_manually_changed
    };
    return newItems;
  });
}, []);
```

## Files to Modify

1. **`src/components/fnb/QuickPasteOrder.tsx`**
   - Convert unit display from text to editable Input
   - Add price per unit Input field
   - Adjust layout to accommodate new fields in a mobile-friendly way

2. **`src/hooks/useConversationImport.ts`**
   - Verify `updateMatchedItem` supports unit updates (already supports partial updates)
   - Ensure type interface allows unit to be updated

## User Experience Benefits

- **Flexible pricing**: Override AI-suggested price for special deals or bulk discounts
- **Correct units**: Fix misinterpreted units (e.g., AI parsed "kg" but customer meant "pcs")
- **Complete control**: Full editing capability before creating the order
- **Consistent with existing pattern**: Matches the editable price behavior in FnbNewOrder form

