
# Enhanced Pallet Configuration Visualization

## Current Issues

The existing PalletVisualization component has several problems that affect both functionality and user experience:

| Issue | Impact |
|-------|--------|
| CSS variables in Canvas don't resolve | Colors render as black instead of theme colors |
| Fixed 800px canvas width | Breaks on mobile devices |
| No interactivity | Users can't explore pallet details |
| Isometric calculations complex | Hard to maintain and debug |
| Missing product placement details | Can't see how cases are arranged |

## Proposed Solution

Replace the Canvas-based approach with a modern React component architecture using styled divs and SVG elements for better compatibility, responsiveness, and interactivity.

## New Features

### 1. Overview Dashboard
- Visual progress bars showing weight utilization
- Actual vs Volumetric weight comparison gauges
- Chargeable weight indicator with color coding

### 2. Interactive Pallet Grid
- Responsive grid of pallet cards
- Color-coded by supplier
- Hover to see detailed metrics
- Click to expand and see case arrangement

### 3. Weight Distribution Chart
- Horizontal bar chart showing actual vs volumetric per supplier
- Highlight the "gap" (air being paid for)
- Show limiting factor with visual indicator

### 4. Case Stacking Visualization
- 2D top-down view of pallet footprint
- Layer-by-layer slider to see stacking
- Product codes displayed on each case position

### 5. Optimization Alerts
- Inline warnings for underutilized pallets
- Suggestions to improve weight balance
- Link to Dito Advisor for AI recommendations

## Technical Changes

### PalletVisualization.tsx - Complete Rewrite

The new component will be structured as follows:

```text
PalletVisualization
├── PalletOverviewStats (KPI cards)
├── PalletWeightGauge (visual weight comparison)
├── PalletGrid (responsive pallet cards)
│   └── PalletCard (individual pallet)
│       ├── PalletHeader (supplier, weight)
│       ├── PalletMetrics (utilization, limiting factor)
│       └── PalletStackView (case arrangement)
└── SupplierBreakdown (detailed tables)
```

### Key Technical Improvements

**1. Replace Canvas with React Components**
- Use flexbox/grid for responsive layouts
- Use CSS transitions for animations
- Use proper React state for interactivity

**2. Fix Color Resolution**
- Use Tailwind classes (`bg-primary`, `text-muted-foreground`)
- For dynamic colors, use `getComputedStyle()` to resolve CSS variables

**3. Add Progress Bars for Utilization**
- Visual representation of capacity usage
- Color gradient from green (optimal) to red (overloaded)

**4. Mobile-First Responsive Design**
- Stack cards vertically on mobile
- Grid layout on desktop
- Collapsible details for touch interfaces

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/PalletVisualization.tsx` | Complete rewrite with new component architecture |

## New Sub-Components (within same file)

| Component | Purpose |
|-----------|---------|
| `PalletOverviewCards` | Summary stats (total pallets, weight, utilization) |
| `WeightComparisonBars` | Visual actual vs volumetric comparison |
| `PalletGridView` | Responsive grid of pallet cards |
| `PalletDetailCard` | Individual pallet with expandable details |
| `UtilizationGauge` | Circular/linear gauge for capacity |
| `SupplierWeightTable` | Detailed breakdown per supplier |

## Visual Design

### Color Scheme
- **Actual Weight**: Blue shade (`bg-blue-500`)
- **Volumetric Weight**: Orange shade (`bg-orange-500`)  
- **Chargeable Weight**: Purple shade (`bg-purple-500`)
- **Gap/Air**: Red shade with pattern (`bg-red-200 with stripes`)

### Limiting Factor Indicators
- **Weight Limited**: Blue badge with weight icon
- **Volume Limited**: Orange badge with box icon
- **Balanced**: Green badge with checkmark

### Utilization Colors
- 0-50%: Red (underutilized)
- 50-80%: Yellow (acceptable)
- 80-95%: Green (optimal)
- 95%+: Blue (near capacity)

## Additional Enhancements

### Export Functionality
- Download pallet plan as PDF
- Print-optimized layout
- Include for warehouse receiving team

### Animation
- Smooth transitions when switching tabs
- Progress bar fill animations
- Card expand/collapse animations

## Expected Results

| Before | After |
|--------|-------|
| Black/broken colors | Proper theme colors |
| Fixed width breaks mobile | Responsive at all sizes |
| Static display | Interactive hover/click |
| Just numbers | Visual gauges and charts |
| Hard to understand | Clear visual hierarchy |

## Implementation Notes

- Will use existing Radix UI components (Progress, Tooltip, Collapsible)
- Leverage Tailwind CSS for all styling
- Maintain compatibility with existing `OrderPalletConfig` interface
- No new dependencies required
