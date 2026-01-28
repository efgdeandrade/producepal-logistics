

# Auto-Generate Product Codes in Import

## Summary

Automatically generate a unique product code when creating new products in the Import department. The code will follow the format `IMP-XXXXXX` (e.g., `IMP-003510`) using a sequential number that auto-increments based on existing products.

---

## Implementation Approach

### Option 1: Client-Side Generation (Recommended)

Generate the code when the "Add Product" dialog opens, similar to how employee numbers are generated in the HR module.

**Advantages:**
- Immediate feedback to the user
- Simpler implementation (no database changes needed)
- User can still modify the code if desired

**Pattern:**
```typescript
const generateProductCode = async () => {
  // Query the highest existing numeric product code
  const { data } = await supabase
    .from('products')
    .select('code')
    .order('code', { ascending: false })
    .limit(100);
  
  // Find the highest numeric portion from IMP-XXXXXX codes or pure numeric codes
  let maxNum = 0;
  data?.forEach(p => {
    const impMatch = p.code.match(/^IMP-(\d+)$/);
    const numMatch = p.code.match(/^(\d+)/);
    if (impMatch) maxNum = Math.max(maxNum, parseInt(impMatch[1]));
    else if (numMatch) maxNum = Math.max(maxNum, parseInt(numMatch[1]));
  });
  
  return `IMP-${String(maxNum + 1).padStart(6, '0')}`;
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Products.tsx` | Add `generateProductCode` function and call it in `handleOpenDialog` when creating new product |
| `src/components/ProductFormDialog.tsx` | Add visual indicator showing the code is auto-generated, with option to edit |

---

## Detailed Changes

### 1. Update Products.tsx

**Add a product code generator function:**
- Query existing products to find the highest code number
- Parse both `IMP-XXXXXX` format and pure numeric codes
- Generate next sequential code in `IMP-XXXXXX` format
- Set this as the default code when opening dialog for new product

**Modify `handleOpenDialog`:**
- When `product` is null (creating new), call `generateProductCode()`
- Pre-fill the `code` field with the generated value

### 2. Update ProductFormDialog.tsx

**Add auto-generation indicator:**
- Show a small badge or icon next to the code field when auto-generated
- Include a "Regenerate" button to get a new code if needed
- Keep the field editable so users can override if desired

---

## Code Flow

```text
User clicks "Add Product"
       │
       ▼
handleOpenDialog(null)
       │
       ▼
generateProductCode()
       │
       ├─── Query products table
       │
       ├─── Find highest IMP-XXXXXX or numeric code
       │
       └─── Return IMP-{next_number}
       │
       ▼
Set formData.code = generated code
       │
       ▼
Open dialog with pre-filled code
       │
       ▼
User can edit or keep auto-generated code
       │
       ▼
Save product with final code
```

---

## Code Format

**Format:** `IMP-XXXXXX`

**Examples:**
- `IMP-003510` (next after current max of 3509)
- `IMP-003511`
- `IMP-003512`

**Why this format:**
- `IMP` prefix clearly identifies Import department products
- 6-digit padding ensures proper alphabetical sorting
- Sequential numbering prevents duplicates
- User can still override with custom codes like `BLB_125` if desired

---

## Edge Cases Handled

1. **No existing products**: Start from `IMP-000001`
2. **Mixed code formats**: Parse both `IMP-XXXXXX` and pure numeric codes
3. **User wants custom code**: Field remains editable
4. **Duplicate check**: The existing validation will catch duplicates on save

---

## Result

After implementation:
- New products automatically receive a unique `IMP-XXXXXX` code
- Users see the generated code immediately when opening the dialog
- The code can be edited if a custom format is preferred
- No database changes required

