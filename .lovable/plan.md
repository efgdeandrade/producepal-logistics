
# Add Signature/Stamp Box to Receipt

## What You Asked For

Add a designated box at the bottom of the receipt for signatures or stamps. This prevents customers from stamping over important information and gives them a clear space for their acknowledgment.

## Design

The signature/stamp box will be:
- A bordered rectangular area below the total
- Large enough to accommodate stamps (common business stamps are around 40-50mm wide)
- Labeled clearly so customers know where to sign/stamp
- Sized appropriately for both 80mm thermal receipt and A4 formats

## Visual Preview

```text
┌─────────────────────────────────────┐
│           [Receipt Content]          │
│                                       │
│  Total:                    Cg 150.00  │
├───────────────────────────────────────┤
│                                       │
│                                       │
│     SIGNATURE / STAMP                 │
│                                       │
│                                       │
│                                       │
└───────────────────────────────────────┘
```

---

## Technical Changes

### File: `src/components/CustomerReceipt.tsx`

**Current (lines 216-218):**
```jsx
<div className={`${format === 'receipt' ? 'mt-1 pt-1 text-xs' : 'mt-4 pt-2'} border-t border-black`}>
  <p className="font-bold">Sig: _______________</p>
</div>
```

**New:**
```jsx
{/* Signature/Stamp Box */}
<div className={`${format === 'receipt' ? 'mt-2' : 'mt-4'}`}>
  <div 
    className={`border-2 border-black ${format === 'receipt' ? 'h-20' : 'h-28'} w-full flex flex-col justify-between p-2`}
  >
    <p className={`${format === 'receipt' ? 'text-xs' : 'text-sm'} font-bold text-center`}>
      SIGNATURE / STAMP
    </p>
    <div className="flex-1"></div>
    <div className="border-t border-dashed border-gray-400 mt-2 pt-1">
      <p className={`${format === 'receipt' ? 'text-[10px]' : 'text-xs'} text-gray-600 text-center`}>
        Received in good condition
      </p>
    </div>
  </div>
</div>
```

## Box Dimensions

| Format | Height | Purpose |
|--------|--------|---------|
| 80mm Receipt | `h-20` (80px) | Compact but fits standard stamps |
| A4 | `h-28` (112px) | More spacious for larger stamps |

## Summary

| Element | Description |
|---------|-------------|
| Box border | 2px solid black border for clear visibility |
| Header label | "SIGNATURE / STAMP" centered at top |
| Empty space | Large area for stamp or signature |
| Footer note | "Received in good condition" as a dashed separator |
