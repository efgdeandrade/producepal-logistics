

# Balanced Receipt Layout Fix

## Issues Identified from PDF

1. **Logo not rendering** - The image isn't loading before PDF capture
2. **Missing company info** - Only phone shown, address and email removed
3. **Table rows too cramped** - `py-0.5` makes text hard to read
4. **Item names need more space** - Currently using `text-xs` which is too small

## Solution - Single File Edit

### File: `src/components/CustomerReceipt.tsx`

**1. Fix Logo Loading**
Add a preload mechanism to ensure the logo is fully loaded before the component renders. This will fix the PDF capture issue.

**2. Restore Company Credentials (Compact)**
Change from phone-only to a 2-line compact format:
```
Address Line, City
Tel: phone | email
```

**3. Improve Table Readability**
- Increase item row padding from `py-0.5` to `py-1`
- Change item font from `text-xs` to `text-sm` for better legibility
- Keep headers at `text-xs` to save space

**4. Better Visual Balance**
- Logo: `h-6` (small but visible)
- Company name: `text-base` (keep current)
- Item names: `text-sm` with `font-bold`
- Quantity/Total columns: `text-sm`

## Expected Result

**Current (broken):**
```
FUIK COMPANY B.V.
+5999 7363845

Item                      Qty  Total
Strawberries Jumbo 500g   150  1350.00
[cramped rows]
```

**After (fixed):**
```
[Logo]
FUIK COMPANY B.V.
Address, City
Tel: +5999 7363845 | email@fuik.com

Item                      Qty  Total
Strawberries Jumbo 500g   150  1350.00
[comfortable spacing]
```

## Technical Details

### Logo Fix
Add an image preload state to ensure the logo is loaded before render:
```typescript
const [logoLoaded, setLogoLoaded] = useState(false);

// In img tag:
onLoad={() => setLogoLoaded(true)}
```

### Company Info Section
Replace current receipt format block (lines 155-157) with:
```jsx
{format === 'receipt' && (
  <div className="text-xs leading-tight">
    <p>{companyInfo.address_line1}, {companyInfo.city}</p>
    <p>Tel: {companyInfo.phone} | {companyInfo.email}</p>
  </div>
)}
```

### Table Improvements
Change row styling from:
- `text-xs py-0.5` → `text-sm py-1`

This gives better readability while still being compact.

## Space Budget

| Element | Before | After |
|---------|--------|-------|
| Logo | Not showing | h-6 (small) |
| Company info | 1 line | 2 lines |
| Table rows | Cramped | Readable |
| Overall | Illegible | Professional |

Net result: Slightly taller but fully functional and readable receipt.

