

# Receipt Layout Optimization Plan

## Summary
Optimize the 80mm thermal receipt layout by making it more compact: smaller logo, condensed company info, simplified item display, and streamlined footer.

## Changes

### File: `src/components/CustomerReceipt.tsx`

#### 1. Logo - Make Smaller
- Change logo height from `h-12` to `h-6` for receipt format
- Add `crossOrigin="anonymous"` to fix PDF rendering

#### 2. Company Information - Smaller Font
- Reduce from `text-sm` to `text-xs` 
- Combine address into fewer lines
- Make contact info more compact (single line)

#### 3. Item Display - Remove Product Code
- Remove the product code line completely
- Show only product name
- Change quantity from `2 trays × 10 = 20 units` to `2 trays × 10`

#### 4. Footer - Streamlined
- Remove "Payment Information" header
- Remove "Payment Method" line
- Keep signature line
- Shorten "Thank you" message
- Reduce vertical spacing

## Before vs After

**Before:**
```
[LARGE LOGO]
Company Name
Address Line 1
Address Line 2  
City, Postal
Tel: XXX | Email: XXX

PROD-001
Product Name
2 trays × 10 = 20 units

Payment Information
Payment Method: ___________
Signature: _______________
Thank you for your business!
```

**After:**
```
[small logo]
Company Name
Address, City, Postal
Tel: XXX | Email: XXX

Product Name
2 trays × 10

Signature: _______________
Thank you!
```

## Expected Result
- ~40% shorter receipt height
- Logo renders correctly in PDF
- Cleaner, more professional appearance

