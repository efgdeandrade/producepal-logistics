

# Logo + Receipt Spacing Fix

## The Problem

The logo fails to appear in PDF downloads because:
1. The current logo URL points to an external Shopify CDN (`https://www.fuik.shop/...`)
2. When `html2canvas` captures the page, external images get blocked due to CORS (Cross-Origin Resource Sharing) restrictions
3. Even with `crossOrigin="anonymous"`, the external server doesn't send proper headers

## The Solution

You've uploaded your logo directly - this is the best approach. We'll:
1. Store the logo in your project's `public/images/` folder
2. Use this local path in the receipt component
3. Increase row spacing (medium increase as requested)

---

## Implementation Details

### Step 1: Copy Logo to Project

Copy the uploaded logo to `public/images/fuik-logo.png`

This ensures the logo is always available from your own domain with no CORS issues.

### Step 2: Update CustomerReceipt.tsx

**Changes:**

1. **Use Local Logo as Fallback**
   - Check if `companyInfo.logo_url` exists
   - Always prefer the local logo for PDF reliability
   - Add a constant for the local logo path

2. **Medium Spacing Increase**
   - Header row: keep at `py-1` (compact header)
   - Body rows: `py-2` → `py-3` (medium increase)
   - Footer row: `py-2` → `py-3` (consistent with body)

### Code Changes

```typescript
// Add constant at top of component
const LOCAL_LOGO_PATH = '/images/fuik-logo.png';

// In the logo img tag - prioritize local logo
<img 
  src={LOCAL_LOGO_PATH}  // Always use local logo for PDF reliability
  alt="Company Logo" 
  className={`mx-auto ${format === 'receipt' ? 'h-8 mb-1' : 'h-16 mb-1'} object-contain`}
/>

// Body row padding increase (lines 198, 202-204)
// Change: py-2 → py-3

// Footer row padding increase (lines 211-212)
// Change: py-2 → py-3
```

---

## Summary of Changes

| Change | Before | After |
|--------|--------|-------|
| Logo source | External URL (CORS blocked) | Local file `/images/fuik-logo.png` |
| Body row padding | `py-2` (8px) | `py-3` (12px) |
| Footer row padding | `py-2` (8px) | `py-3` (12px) |
| Logo height (receipt) | `h-6` | `h-8` (slightly larger for visibility) |

## Files to Modify

1. **Copy**: `user-uploads://Primary_Logo.png` → `public/images/fuik-logo.png`
2. **Edit**: `src/components/CustomerReceipt.tsx`
   - Add local logo constant
   - Update logo img src to use local path
   - Increase row padding from `py-2` to `py-3`

## Expected Result

- Logo will always appear in downloaded PDFs (guaranteed, no CORS issues)
- Item rows will have comfortable medium spacing
- Receipt remains compact but readable

