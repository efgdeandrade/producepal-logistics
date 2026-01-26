
# Fix Mobile Toast Notifications Blocking UI

## Problem
On mobile devices, notification banners (toasts) appear at the top of the screen, blocking the header and menu. Users must swipe away each notification before they can interact with any menu items - this disrupts workflow significantly.

## Root Cause
In `src/components/ui/toast.tsx`, the `ToastViewport` has these classes:
```
fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 
sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]
```

This means:
- **Mobile (default)**: Toasts appear at the TOP (`top-0`) with full width (`w-full`)
- **Desktop (sm+)**: Toasts appear at the BOTTOM-RIGHT (`sm:bottom-0 sm:right-0`)

The mobile header has `z-40`, while toasts have `z-[100]`, so toasts cover everything.

## Solution
Move toasts to the **bottom** of the screen on mobile, keeping them out of the way of the header and navigation. This matches the expected mobile UX pattern where notifications appear at the bottom.

## Changes Required

### File: `src/components/ui/toast.tsx`

**Current code (line 17):**
```tsx
"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
```

**Updated code:**
```tsx
"fixed bottom-20 left-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 pointer-events-none sm:bottom-0 sm:right-0 sm:left-auto sm:flex-col md:max-w-[420px] [&>*]:pointer-events-auto"
```

**Key changes:**
| Change | Before | After | Why |
|--------|--------|-------|-----|
| Position | `top-0` | `bottom-20` | Places toasts above bottom nav (which has `pb-24`) |
| Direction | `flex-col-reverse` | `flex-col` | Stack toasts naturally from bottom up |
| Horizontal | (full width) | `left-0 right-0` | Centered on mobile |
| Pointer events | (blocks all) | `pointer-events-none` + `[&>*]:pointer-events-auto` | Container doesn't block clicks, only toasts do |

### File: `src/components/ui/sonner.tsx` (if using Sonner toasts)

Add `position="bottom-center"` prop to ensure Sonner toasts also appear at the bottom on mobile:

```tsx
<Sonner
  theme={theme}
  position="bottom-center"
  className="toaster group"
  // ... rest of config
/>
```

## Visual Result

**Before:**
```text
┌─────────────────────┐
│ [TOAST BLOCKS HERE] │  ← Can't tap menu!
├─────────────────────┤
│     Header          │
├─────────────────────┤
│                     │
│     Content         │
│                     │
├─────────────────────┤
│   Bottom Nav        │
└─────────────────────┘
```

**After:**
```text
┌─────────────────────┐
│     Header          │  ← Fully accessible!
├─────────────────────┤
│                     │
│     Content         │
│                     │
├─────────────────────┤
│  [TOAST APPEARS]    │  ← Above bottom nav
├─────────────────────┤
│   Bottom Nav        │
└─────────────────────┘
```

## Technical Details

1. **`bottom-20` (80px)**: This positions toasts just above the bottom navigation area (which has `pb-24` = 96px padding), ensuring they don't overlap with nav buttons

2. **`pointer-events-none` + `[&>*]:pointer-events-auto`**: The viewport container won't block clicks on content behind it, but individual toast elements will still be interactive

3. **Keeping desktop behavior**: The `sm:` prefixed classes maintain the existing bottom-right positioning on larger screens

## Files to Modify
1. `src/components/ui/toast.tsx` - Change ToastViewport positioning for mobile
2. `src/components/ui/sonner.tsx` - Add position prop for consistency
