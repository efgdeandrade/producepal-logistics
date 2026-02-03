
# CIF Estimation System - Professional Remodel Plan

## Current State Analysis

### What Exists Today

**Calculation Engine (cifCalculationsV2.ts)**
- 3 core distribution methods: Proportional (by weight), Value-Based (by cost), Smart Blend (hybrid)
- Chargeable weight correctly uses MAX(actual, volumetric)
- Exchange rate, wholesale/retail multipliers are configurable
- Learning adjustments can be applied via `calculateCIFWithLearning()`

**Settings/Tariffs (Settings.tsx)**
- `freight_exterior_tariff` - per kg rate for external freight (Champion)
- `freight_local_tariff` - per kg rate for local agent (Swissport)
- `local_logistics_usd` - fixed cost (default $91)
- `labor_xcg` - labor cost in XCG (default Cg50)
- `usd_to_xcg_rate` - currency conversion

**Database Schema**
- `cif_estimates` - stores estimated vs actual CIF with variance
- `cif_learning_patterns` - AI-derived adjustment factors per product
- `cif_audit_log` - calculation history with full input/output JSONB
- `cif_anomalies` - flagged outliers excluded from learning

**AI Components**
- `cif-learning-engine` edge function - analyzes historical variance, generates adjustment factors with safety caps (0.85-1.15), excludes anomalies (>25% variance)
- `dito-unified-advisor` - recommends CIF method, blend ratio, identifies risks
- Uses Gemini Flash via Lovable AI gateway

### Current Gaps Identified

1. **No automatic CIF estimate on order creation** - estimates are calculated on-demand when viewing order details
2. **No supplier-specific fixed costs** - all suppliers use same tariffs
3. **Actual cost entry is fragmented** - ActualCIFForm exists but requires manual weight entry per supplier
4. **No side-by-side estimate vs actual comparison view** after actuals are entered
5. **Learning engine not triggered automatically** when actuals are saved
6. **Settings lack supplier-level cost configuration**

---

## Proposed Architecture

### Phase 1: Supplier Fixed Costs in Settings

**New Database Table: `supplier_cost_config`**
```text
- id (uuid)
- supplier_id (uuid, FK to suppliers)
- fixed_cost_per_shipment_usd (numeric) - flat fee per import
- handling_notes (text) - description of what fixed cost covers
- is_active (boolean)
- created_at, updated_at
```

**Settings Page Enhancement**
- New "Import Suppliers" tab under Settings
- List all suppliers with editable fixed cost field
- Notes field for documenting what the charge covers

---

### Phase 2: Automatic CIF Estimate Generation

**Trigger Point**: When an import order is created/saved

**Formula for Estimated Total Freight:**
```text
Total Freight (USD) = 
  (Chargeable Weight × Exterior Tariff) 
+ (Chargeable Weight × Local Tariff)
+ Local Logistics Fixed Cost
+ Bank Charges
+ SUM(Supplier Fixed Costs for suppliers in this order)
```

**Chargeable Weight Calculation:**
```text
Per Product:
  Actual Weight = (Units × Gross Weight per Unit) / 1000
  Volumetric Weight = (Cases × L × W × H) / 6000
  
Order Chargeable Weight = MAX(Total Actual, Total Volumetric)
```

**CIF Per Unit Formula:**
```text
CIF per Unit (XCG) = [(Product Cost USD + Freight Share) × Exchange Rate] / Units

Where Freight Share depends on selected method:
- Proportional: (Product Chargeable Weight / Total Chargeable Weight) × Total Freight
- Value-Based: (Product Cost / Total Cost) × Total Freight  
- Smart Blend: (Weight Share × Ratio) + (Cost Share × (1-Ratio))
```

**Implementation:**
- Create edge function `cif-auto-estimate` that runs on order insert/update
- Store result in `cif_estimates` table with `calculation_type: 'auto_estimate'`
- Add "Recalculate Estimate" button in Order CIF view

---

### Phase 3: Actual Cost Entry Workflow

**Enhanced ActualCIFForm with structured cost categories:**

```text
┌─────────────────────────────────────────────────┐
│ ACTUAL COSTS ENTRY                              │
├─────────────────────────────────────────────────┤
│ External Freight (Champion)     [$ ______]      │
│ Local Agent (Swissport)         [$ ______]      │
│ Labor & Handling                [Cg ______]     │
│ Bank/Financial Charges          [$ ______]      │
│ Other Costs                     [$ ______]      │
│                                                 │
│ Total Actual Freight:           $X,XXX.XX       │
├─────────────────────────────────────────────────┤
│ [Upload Invoice] [Upload Receipt]               │
│                                                 │
│     [Save Actuals & Analyze Variance]           │
└─────────────────────────────────────────────────┘
```

**After Save - Comparison View:**
```text
┌────────────────────────────────────────────────────────┐
│ ESTIMATE vs ACTUAL COMPARISON                          │
├─────────────────┬───────────────┬──────────────────────┤
│ Category        │ Estimated     │ Actual    │ Variance │
├─────────────────┼───────────────┼───────────┼──────────┤
│ External Freight│ $1,200.00     │ $1,185.50 │ -1.2%    │
│ Local Agent     │ $450.00       │ $480.00   │ +6.7%    │
│ Local Logistics │ $91.00        │ $91.00    │ 0%       │
│ Labor           │ Cg50.00       │ Cg65.00   │ +30%     │
│ Bank Charges    │ $0.00         │ $25.00    │ NEW      │
├─────────────────┼───────────────┼───────────┼──────────┤
│ TOTAL           │ $1,786.00     │ $1,871.00 │ +4.8%    │
└─────────────────┴───────────────┴───────────┴──────────┘
```

---

### Phase 4: AI Learning Engine Enhancement

**Hybrid Application Model:**
- Confidence > 70%: Auto-apply adjustment factor to estimates
- Confidence 50-70%: Show as suggestion with "Apply" button
- Confidence < 50%: Do not apply, show in "Needs More Data" section

**Auto-Trigger Learning:**
When user clicks "Save Actuals & Analyze Variance":
1. Store actual costs in `cif_estimates`
2. Calculate variance per product
3. Flag anomalies (>25% variance) for review
4. Invoke `cif-learning-engine` to recalculate patterns
5. Show updated adjustment factors immediately

**Enhanced AI Recommendations:**
```text
┌─────────────────────────────────────────────────────────┐
│ 🤖 DITO AI ADVISOR                                      │
├─────────────────────────────────────────────────────────┤
│ ESTIMATE ANALYSIS (based on tariffs + learning)         │
│                                                         │
│ Recommended Method: Smart Blend (0.65 ratio)            │
│ Confidence: HIGH (based on 47 historical orders)        │
│                                                         │
│ ⚠️ Product Adjustments Applied:                         │
│   • BLB_125: +8.2% (learned from 12 samples)            │
│   • STB_500: -3.1% (learned from 8 samples)             │
│                                                         │
│ 💡 Recommendations:                                     │
│   • Consider consolidating supplier X shipments         │
│   • Volumetric limiting: 15kg gap costs extra           │
│                                                         │
│ 🎯 Estimated Accuracy: 94.2% (based on history)         │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 5: What We Keep (No Changes Needed)

- **Pallet Configuration Visualization** - current layout is good
- **CIF Analytics dashboard** - keep tabs for Analytics, Market Intelligence, Pricing Optimizer
- **Weight calculation formulas** in `weightCalculations.ts` - already correct
- **3 distribution methods** - Proportional, Value-Based, Smart Blend
- **Safety caps on learning** (0.85-1.15 factor range)
- **Anomaly detection** (>25% variance excluded)

---

## Technical Implementation Details

### Database Changes

**1. New table: `supplier_cost_config`**
```sql
CREATE TABLE supplier_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  fixed_cost_per_shipment_usd NUMERIC DEFAULT 0,
  handling_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id)
);
```

**2. Enhance `cif_estimates` table:**
- Add columns for categorized actual costs:
  - `actual_labor_xcg` (numeric)
  - `actual_other_costs_usd` (numeric)
  - `supplier_fixed_costs_usd` (numeric)

**3. Add `cif_calculation_snapshots` for order-level storage:**
```sql
CREATE TABLE cif_calculation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  snapshot_type TEXT NOT NULL, -- 'estimate' | 'actual'
  total_freight_usd NUMERIC,
  distribution_method TEXT,
  exchange_rate NUMERIC,
  products_data JSONB, -- full calculation results
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

### Edge Functions

**1. `cif-auto-estimate` (new)**
- Triggered after order creation
- Fetches tariffs, supplier fixed costs, product weights
- Calculates estimate using Smart Blend with AI adjustments
- Stores snapshot in database

**2. `cif-learning-engine` (enhance)**
- Add automatic invocation after actuals saved
- Add supplier-level pattern analysis
- Add seasonal quarter tracking
- Return real-time updated factors to UI

**3. `dito-unified-advisor` (enhance)**
- Accept estimate vs actual context
- Provide variance explanation
- Suggest tariff adjustments if consistent errors detected

### Frontend Components

**1. Settings Page - New "Import Costs" Tab**
- Supplier fixed cost configuration
- Bank charges default
- Labor cost default

**2. Order CIF View - Enhanced Tabs**
- Estimate Tab (auto-generated, recalculable)
- Actual Tab (structured cost entry)
- Comparison Tab (side-by-side analysis)
- AI Insights Tab (recommendations)

**3. CIF Learning Dashboard (existing, enhanced)**
- Show which adjustments are auto-applied vs suggested
- Allow manual override of adjustment factors
- Show confidence progression over time

---

## Implementation Sequence

**Week 1: Foundation**
1. Create `supplier_cost_config` table
2. Add Settings UI for supplier fixed costs
3. Add new columns to `cif_estimates`

**Week 2: Auto-Estimate**
4. Build `cif-auto-estimate` edge function
5. Integrate into order creation flow
6. Add recalculate button

**Week 3: Actual Cost Entry**
7. Restructure ActualCIFForm with categories
8. Build comparison view component
9. Auto-trigger learning after save

**Week 4: AI Enhancement**
10. Implement hybrid threshold logic
11. Enhance Dito advisor with variance context
12. Add confidence-based auto-apply

**Week 5: Polish**
13. Testing and refinement
14. Documentation
15. User training materials
