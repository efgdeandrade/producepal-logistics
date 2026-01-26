

# Collapsible Day Sections for Mobile Orders Page

## Problem
Looking at your screenshot, the mobile orders page shows all days stacked vertically (Mon Jan 26, Tue Jan 27, etc.). When you have many orders per day, you must scroll through all of them to get to another day. This makes it hard to focus on just the day you're currently working on.

## Solution
Make each day section collapsible on mobile, with the following behavior:
- **Today's date** starts expanded by default
- **Other days** start collapsed by default
- Tapping the day header expands/collapses that day's orders
- Add a clear visual indicator (chevron) showing collapse state
- Keep the day summary stats visible even when collapsed

## Visual Design

```text
Before (current):                    After (proposed):
┌─────────────────────┐              ┌─────────────────────┐
│ Mon Jan 26 [25] ⟩   │              │ Mon Jan 26 [25] ▼   │  ← Collapsed (shows chevron)
│ ┌─────────────────┐ │              │   (25 orders hidden)│
│ │ Order Card 1    │ │              └─────────────────────┘
│ │ Order Card 2    │ │              ┌─────────────────────┐
│ │ ...25 cards...  │ │              │ TODAY Tue Jan 27 ▲  │  ← Expanded (today)
│ └─────────────────┘ │              │ ┌─────────────────┐ │
├─────────────────────┤              │ │ Order Card 1    │ │
│ Tue Jan 27 [3]      │              │ │ Order Card 2    │ │
│ ┌─────────────────┐ │              │ │ Order Card 3    │ │
│ │ Order Card 1    │ │              │ └─────────────────┘ │
│ │ Order Card 2    │ │              └─────────────────────┘
│ │ Order Card 3    │ │              ┌─────────────────────┐
│ └─────────────────┘ │              │ Wed Jan 28 [0] ▼    │  ← Collapsed
...must scroll...                    │   No orders         │
                                     └─────────────────────┘
```

## Implementation Details

### File: `src/pages/fnb/FnbOrders.tsx`

1. **Add state to track collapsed days** (mobile only):
   ```tsx
   const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => {
     // Start with all days collapsed except today
     const todayStr = format(todayCuracao(), 'yyyy-MM-dd');
     const allDays = new Set(
       Array.from({ length: 6 }, (_, i) => 
         format(addDays(startOfWeekCuracao(), i), 'yyyy-MM-dd')
       )
     );
     allDays.delete(todayStr); // Today starts expanded
     return allDays;
   });
   ```

2. **Add toggle function**:
   ```tsx
   const toggleDayCollapsed = (dateStr: string) => {
     setCollapsedDays(prev => {
       const newSet = new Set(prev);
       if (newSet.has(dateStr)) {
         newSet.delete(dateStr);
       } else {
         newSet.add(dateStr);
       }
       return newSet;
     });
   };
   ```

3. **Update day card rendering** (wrap content in Collapsible):
   - On mobile (`md:hidden`), use the Collapsible component
   - On desktop, keep the current grid layout unchanged
   - The day header becomes the collapsible trigger
   - Show a chevron icon that rotates based on state
   - When collapsed, show a summary line like "25 orders" or "No orders"

4. **Reset collapsed state when week changes**:
   - When navigating to a new week, reset the collapsed days based on the new week's "today"

### Mobile-Specific Behavior
- This collapsible behavior only applies on mobile (screens smaller than `md`)
- Desktop keeps the existing grid layout with all days visible
- Uses the existing `Collapsible` component from Radix UI

## Files to Modify

1. **`src/pages/fnb/FnbOrders.tsx`**
   - Add `collapsedDays` state with today expanded by default
   - Add `toggleDayCollapsed` function
   - Reset collapsed state when `weekStart` changes
   - Wrap mobile day cards with `Collapsible` component
   - Add chevron indicator to day headers on mobile
   - Show collapsed summary when day is collapsed

## User Experience Improvements
- Quickly focus on today's orders without scrolling past other days
- Expand only the days you need to review
- Still see summary stats (order count, XCG total) for collapsed days
- Chevron provides clear visual feedback on expand/collapse state

