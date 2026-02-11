

## Receipt Layout Improvements (80mm Thermal) - Extra Large Fonts

Three changes to the thermal receipt format only (A4 unchanged):

### 1. Font Sizes - Bumped Two Steps Up from Current

| Element | Current | Proposed |
|---|---|---|
| Logo height | h-8 | h-12 |
| Company name | text-sm | text-xl |
| Company details | text-[10px] | text-sm |
| "RECEIPT" title | text-base | text-2xl |
| Receipt number/date | text-[10px] | text-sm |
| Customer name | text-xs | text-base |
| Table headers | text-[10px] | text-sm |
| Table cells | text-[10px] | text-sm |
| Signature label | text-[9px] | text-xs |
| Signature footer | text-[8px] | text-[10px] |

### 2. Zero Side Margins
- Container padding: `p-3` changes to `py-3 px-0`
- PDF generator margin: 2mm changes to 0mm

### 3. Taller Signature/Stamp Box
- Height: `h-20` changes to `h-28`

### Technical Details

**Files to modify:**
- `src/components/CustomerReceipt.tsx` -- all font size increases, padding removal, signature box height
- `src/utils/receiptGenerator.ts` -- set `marginPt` to `0` for receipt format in both single and multi-receipt code paths

