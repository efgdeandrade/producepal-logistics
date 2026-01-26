
# Fix Mobile Header Layout - Cramped Spacing Issue

## Problem Analysis
Looking at your screenshot, there are two issues:
1. **Visual crowding**: "Dashboard" in the header and "Executive Dashboard" title in the page content appear too close together
2. **Insufficient spacing**: The header border/line sits too close to the page content

## Root Cause
- The mobile header (`AppLayout.tsx`) shows the page title "Dashboard" from breadcrumbs
- The Executive Dashboard page also renders its own large "Executive Dashboard" heading
- This creates redundant information with cramped vertical spacing

## Solution

### Approach A: Hide Page Title on Mobile (Recommended)
Since the mobile header already shows the current page name, we can hide the page-level h1 on mobile devices to avoid duplication and improve spacing.

**Files to modify:**

1. **`src/pages/ExecutiveDashboard.tsx`**
   - Add `hidden md:block` to the page header section on mobile
   - Keep the date subtitle visible but with adjusted styling

   ```tsx
   {/* Header */}
   <div className="flex flex-col gap-2">
     <div className="flex items-center justify-between">
       <h1 className="hidden md:block text-3xl font-bold tracking-tight">
         Executive Dashboard
       </h1>
       {lastUpdate && (
         <Badge variant="outline" className="gap-1 text-xs">
           <Zap className="h-3 w-3 text-green-500" />
           Live • {format(lastUpdate, "h:mm:ss a")}
         </Badge>
       )}
     </div>
     <p className="text-muted-foreground text-sm md:text-base">
       Overview of all business operations • {format(new Date(), "EEEE, MMMM d, yyyy")}
     </p>
   </div>
   ```

2. **`src/components/layout/AppLayout.tsx`**
   - Increase main content top padding on mobile for better breathing room
   - Add subtle visual separation after header

   ```tsx
   {/* Main content with improved mobile spacing */}
   <main className="flex-1 p-4 pt-2 pb-24">
   ```

### Visual Result
| Before | After |
|--------|-------|
| Dashboard (header) | Dashboard (header) |
| Executive Dashboard (h1) | |
| Overview of all... | Overview of all... (with better spacing) |
| [cramped cards] | [well-spaced cards] |

## Technical Details

### Change 1: ExecutiveDashboard.tsx (lines 369-382)
Hide the h1 title on mobile since it's redundant with the header:
- Add `hidden md:block` to the main title
- Adjust the Live badge positioning for mobile
- Make subtitle text slightly smaller on mobile with `text-sm md:text-base`

### Change 2: AppLayout.tsx (line 108)
Adjust mobile main content padding:
- Change from `p-4 pb-24` to `p-4 pt-2 pb-24` for slightly tighter top padding
- This works because we're removing the duplicate h1

## Files to Modify
1. `src/pages/ExecutiveDashboard.tsx` - Hide redundant title on mobile
2. `src/components/layout/AppLayout.tsx` - Adjust mobile content padding
