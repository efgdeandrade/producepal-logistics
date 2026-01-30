
# CIF Module Hardening & Verification Plan

## Executive Summary

This plan outlines a comprehensive approach to making the CIF calculation system bulletproof. Given that this is the core of your business, I've designed a multi-layered defense strategy with validation gates, audit trails, and fail-safes.

---

## Current State Assessment

### What's Working Well
- **Dual calculation engines** (V1: `cifCalculations.ts`, V2: `cifCalculationsV2.ts`) with consistent formulas
- **Comprehensive test coverage** - 491 lines of edge case tests
- **Learning engine** with historical pattern analysis
- **Unified Dito Advisor** integrating AI recommendations
- **Freight allocation verification** function already exists

### Identified Gaps
| Area | Issue | Risk Level |
|------|-------|------------|
| Input Validation | No pre-calculation checks for missing data | High |
| "From Stock" Filtering | Recently fixed, but needs broader application | Medium |
| Audit Trail | No record of calculation inputs/outputs | High |
| Learning Safety | Adjustment factors have no safety caps | Medium |
| UI Transparency | Users can't verify calculation steps | Medium |
| Exchange Rate | No staleness check or source validation | Medium |

---

## Phase 1: Input Validation Layer (Critical)

### 1.1 Create CIF Validator Module

Create a new file: `src/lib/cifValidator.ts`

**Purpose**: Gate all CIF calculations with mandatory pre-checks

**Validation Rules**:
```text
1. Every product MUST have:
   ├─ Valid supplier assignment (not null/empty)
   ├─ Positive weight data (gross_weight > 0 OR netto_weight > 0)
   ├─ Valid cost per unit (≥ 0)
   └─ Valid quantity (> 0)

2. Order-level checks:
   ├─ Exchange rate is current (< 24 hours old)
   ├─ Total freight is positive
   ├─ At least one import item exists (after stock filtering)
   └─ No duplicate product codes in input

3. Returns:
   ├─ { valid: true, warnings: [] } → Proceed with calculation
   ├─ { valid: false, errors: [], warnings: [] } → Block calculation
   └─ Show user-friendly error messages
```

### 1.2 Integrate Validator into Components

**Files to modify**:
- `src/components/OrderCIFTable.tsx`
- `src/components/ActualCIFForm.tsx`
- `src/pages/import/ImportOrderCIFView.tsx`

**Changes**:
- Add validation call before `calculateCIFByMethod`
- Display warning badges for products with issues
- Show blocking modal if critical data missing

---

## Phase 2: Calculation Verification Layer

### 2.1 Freight Allocation Checksum

Implement automatic verification that freight shares sum to 100%:

```text
After every CIF calculation:
  1. Sum all freightCost values
  2. Compare to totalFreight input
  3. If |difference| > 0.01 USD → Log error + alert user
  4. Display verification badge: ✓ Freight verified (100.00%)
```

**Existing function to leverage**: `verifyFreightAllocation()` in `cifCalculations.ts`

### 2.2 Dual-Path Verification (Optional Advanced)

For high-value orders (> $5,000 freight):
- Calculate using both V1 and V2 engines
- Compare results for each product
- Flag any CIF per unit variance > 1%

### 2.3 Margin Consistency Check

After calculating CIF, verify:
```text
For each product:
  wholesaleMargin = wholesalePrice - cifPerUnit
  retailMargin = retailPrice - cifPerUnit
  
  If wholesaleMargin < 0 → Alert: "Negative margin on {product}"
  If retailMargin < targetRetailMargin * 0.5 → Warning: "Low margin on {product}"
```

---

## Phase 3: Audit Trail System

### 3.1 Database Table

Create new table: `cif_audit_log`

```text
Columns:
  id: uuid (primary key)
  order_id: text
  calculation_type: text ('estimate' | 'actual')
  calculation_timestamp: timestamp
  exchange_rate_used: numeric
  total_freight_usd: numeric
  distribution_method: text
  blend_ratio: numeric (nullable)
  products_input: jsonb (array of inputs)
  products_output: jsonb (array of results)
  validation_status: text ('passed' | 'warnings' | 'failed')
  validation_messages: jsonb
  learning_adjustments_applied: jsonb
  created_by: uuid (user id)
```

### 3.2 Automatic Logging

**Where to log**:
- When "Save Actual CIF" is clicked
- When CIF estimates are generated for an order
- When learning adjustments are applied

**What to log**:
- All input parameters
- Complete output results
- Which warnings were shown
- User who performed the action

---

## Phase 4: Learning Engine Safety Gates

### 4.1 Adjustment Factor Caps

Modify `supabase/functions/cif-learning-engine/index.ts`:

```text
Before storing adjustment_factor:
  1. Cap between 0.85 and 1.15 (±15% max)
  2. If pattern suggests > ±15%, flag for manual review
  3. Require minimum 5 data points before applying
  4. Require confidence score ≥ 60% before applying
```

### 4.2 Anomaly Detection

Add checks to learning engine:
```text
If variance > 25% between estimate and actual:
  1. Log to cif_anomalies table
  2. Do NOT include in pattern calculation
  3. Alert admin for manual review
```

### 4.3 Seasonal Awareness

Track patterns by quarter (already exists as `season_quarter` column):
- Compare current quarter patterns to annual average
- Alert if seasonal adjustment > 10%

---

## Phase 5: UI Transparency Enhancements

### 5.1 Calculation Breakdown Panel

Add expandable "How was this calculated?" section:

```text
For each product:
  ├─ Product Cost: 100 units × $1.50 = $150.00
  ├─ Freight Share: 25.5% of $500 = $127.50
  │   └─ Method: Proportional (by weight)
  │   └─ Weight contribution: 127.5 kg of 500 kg total
  ├─ CIF USD: $150.00 + $127.50 = $277.50
  ├─ CIF XCG: $277.50 × 1.82 = Cg 505.05
  ├─ CIF per Unit: Cg 505.05 ÷ 100 = Cg 5.05
  └─ Learning Adjustment: +3.2% applied (85% confidence)
```

### 5.2 Verification Badges

Display at top of CIF table:
- ✓ **Freight Verified**: 100.00% allocated
- ⚠️ **5 items from stock excluded**
- ✓ **Exchange Rate**: 1.82 (updated 2h ago)
- ⚠️ **Learning Applied**: 3 products adjusted

### 5.3 Side-by-Side Comparison

In `CIFComparison.tsx`, add:
- Highlight variance > 5% in yellow
- Highlight variance > 10% in red
- Show exact $ and % difference per product

---

## Phase 6: Expanded Test Coverage

### 6.1 New Test Categories

Add to `src/lib/__tests__/cifHardening.test.ts`:

```text
Test Cases:
  1. Real order patterns (use anonymized production data)
  2. Multi-supplier order with stock items excluded
  3. Exchange rate edge cases (0, negative, very high)
  4. Learning adjustment cap enforcement
  5. Audit log creation verification
  6. Validator blocking on missing data
  7. Concurrent calculation consistency
```

### 6.2 Integration Tests

Create `src/lib/__tests__/cifIntegration.test.ts`:
- Test full flow from order items → CIF table display
- Verify stock items never appear in CIF output
- Verify supplier groupings are correct

---

## Implementation Priority

| Phase | Description | Effort | Impact |
|-------|-------------|--------|--------|
| 1 | Input Validation Layer | 2-3 hours | Prevents bad data entering system |
| 2.1 | Freight Checksum | 30 min | Catches calculation errors |
| 3 | Audit Trail | 2 hours | Enables debugging + compliance |
| 4.1 | Learning Caps | 1 hour | Prevents runaway adjustments |
| 5.2 | Verification Badges | 1 hour | User confidence + transparency |
| 5.1 | Calculation Breakdown | 2 hours | Full transparency |
| 6 | Test Expansion | 3 hours | Long-term reliability |

---

## Expected Outcomes

After implementation:
- **Zero undetected calculation errors** through multi-layer verification
- **Full transparency** on every CIF value with step-by-step breakdown
- **Confidence indicators** on all AI-adjusted values
- **Audit trail** for compliance and debugging
- **Automated safety nets** preventing bad data from affecting calculations
- **Clear user feedback** when issues are detected

---

## Technical Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/cifValidator.ts` | Create | Input validation module |
| `src/lib/cifCalculations.ts` | Modify | Add checksum verification |
| `src/components/OrderCIFTable.tsx` | Modify | Add validation + badges |
| `src/components/ActualCIFForm.tsx` | Modify | Add validation + audit logging |
| `src/components/CIFVerificationBadges.tsx` | Create | Reusable verification display |
| `src/components/CIFBreakdownPanel.tsx` | Create | Calculation transparency |
| `supabase/functions/cif-learning-engine/index.ts` | Modify | Add safety caps |
| Database migration | Create | Add cif_audit_log table |
| `src/lib/__tests__/cifHardening.test.ts` | Create | New test suite |

