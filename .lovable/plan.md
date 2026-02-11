

## Receipt Fine-Tuning (80mm Thermal Format)

Four targeted changes in `src/components/CustomerReceipt.tsx`, affecting only the thermal receipt format:

### 1. Date Format: "10 Feb 2026"
- Currently uses `new Date().toLocaleDateString()` which outputs locale-dependent format
- Change to use `format(new Date(), 'd MMM yyyy')` from the already-installed `date-fns` library
- This gives the exact format: `10 Feb 2026`

### 2. Larger Customer Name
- Current: `text-base` (16px)
- Change to: `text-xl` (20px) with extra bold weight
- Makes the customer name clearly stand out on the receipt

### 3. More Vertical Space Between Items
- Current table row padding: `py-1` (4px top/bottom)
- Change to: `py-2` (8px top/bottom) for all table cells in the receipt format
- Doubles the breathing room between line items

### 4. Taller Signature/Stamp Box
- Current height: `h-28` (112px)
- Change to: `h-36` (144px) -- roughly 30% taller

---

### Technical Details

**File:** `src/components/CustomerReceipt.tsx`

- Add `import { format } from 'date-fns';` at top
- Line 218: Replace `new Date().toLocaleDateString()` with `format(new Date(), 'd MMM yyyy')`
- Line 224: Change `text-base` to `text-xl` for customer name in receipt mode
- Lines 272, 283, 288, 293, 305, 310: Change `py-1` to `py-2` for receipt table rows
- Line 237: Change header `py-1` to `py-2` as well for consistency
- Line 321: Change `h-28` to `h-36` for the receipt signature box
