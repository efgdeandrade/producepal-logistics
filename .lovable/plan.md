

# Import Department AI Enhancement Plan

## Current AI Capabilities Assessment

### Existing AI Edge Functions
| Function | Purpose | Model Used | Status |
|----------|---------|------------|--------|
| `cif-advisor` | CIF allocation strategy recommendations | Gemini 2.5 Pro | Active, integrated in CIF Calculator |
| `cif-learning-engine` | Analyze historical CIF variances, generate adjustment patterns | Gemini 2.5 Flash | Available but not surfaced in UI |
| `document-parser` | Extract data from warehouse receipts and freight invoices | Gemini 2.5 Flash | Active |
| `market-price-advisor` | Research Curacao grocery prices for wholesale/retail positioning | Gemini 2.5 Pro | Active |
| `volumetric-weight-advisor` | Optimize freight costs via volumetric weight analysis | Gemini 2.5 Flash | Active |

### UI Components with AI
- `CIFLearningInsights.tsx` - Displays learning patterns but **not integrated** into any Import page
- `DitoAdvisor.tsx` - Volumetric recommendations, integrated in CIF flow

### Gaps Identified
1. **No AI Insights Panel in Import Analytics** - Charts show data but no AI-driven cost optimization recommendations
2. **CIF Learning Engine UI disconnected** - Component exists but not accessible from Import sidebar
3. **No Document Auto-Classification** - Uploaded documents require manual category selection
4. **No Supplier Performance AI** - The Suppliers page has no AI-driven reliability or cost efficiency analysis
5. **No Predictive Analytics** - No landed cost forecasting, exchange rate predictions, or demand forecasting

---

## Phase 1: Import AI Insights Dashboard

**Goal:** Add an AI-powered insights panel to Import Analytics that surfaces actionable cost optimization recommendations.

### 1.1 Create AI Insights Edge Function
Create `supabase/functions/import-ai-insights/index.ts`:
- Aggregate data from CIF calculations, bills, orders, and suppliers
- Analyze spending patterns, cost trends, supplier efficiency
- Generate structured insights including:
  - Cost optimization opportunities
  - Supplier performance rankings
  - Freight efficiency recommendations
  - Margin improvement suggestions
  - Anomaly detection (unusual cost spikes)

### 1.2 Create Import AI Insights Component
Create `src/components/import/ImportAIInsightsPanel.tsx`:
- "Generate Insights" button to trigger AI analysis
- Display structured recommendations in cards
- Categories: Opportunities, Warnings, Improvements
- Show confidence scores and supporting data

### 1.3 Integrate into Import Analytics
Update `src/pages/import/ImportAnalytics.tsx`:
- Add the AI Insights Panel at the top of the page
- Position as the primary strategic tool before charts

---

## Phase 2: CIF Learning Engine Integration

**Goal:** Surface the existing CIF Learning Engine in the Import department UI for continuous cost improvement.

### 2.1 Add CIF Learning to Import Sidebar
Update `src/layouts/ImportLayout.tsx`:
- Add "AI Learning" nav item linking to a dedicated page

### 2.2 Create CIF Learning Page
Create `src/pages/import/ImportCIFLearning.tsx`:
- Import and display the existing `CIFLearningInsights` component
- Add contextual header explaining the learning engine
- Show historical accuracy metrics
- Display adjustment factor recommendations

---

## Phase 3: Supplier Performance AI Advisor

**Goal:** Add AI-driven supplier analysis to help procurement decisions.

### 3.1 Create Supplier Performance Advisor Edge Function
Create `supabase/functions/supplier-performance-advisor/index.ts`:
- Analyze order history per supplier
- Calculate delivery reliability (on-time rate)
- Calculate cost efficiency (price trends, value for money)
- Compare weight accuracy (estimated vs actual)
- Generate supplier rankings and recommendations

### 3.2 Create Supplier AI Panel Component
Create `src/components/import/SupplierAIPanel.tsx`:
- Display supplier performance scores
- Show AI recommendations (e.g., "Consider consolidating orders with Supplier X for volume discounts")
- Highlight suppliers with declining performance

### 3.3 Integrate into Suppliers Page
Update `src/pages/Suppliers.tsx`:
- Add AI panel at the top or as a dedicated tab
- Allow analysis on-demand or for specific supplier

---

## Phase 4: Document Auto-Classification (Optional Enhancement)

**Goal:** Automatically categorize uploaded documents using AI vision.

### 4.1 Enhance Document Upload Flow
Update `src/hooks/useImportDocuments.ts`:
- After upload, optionally call AI to classify document type
- Use document-parser with classification prompt
- Auto-fill category dropdown based on AI suggestion

### 4.2 Update Upload Dialog
Update `src/components/import/UploadDocumentDialog.tsx`:
- Add "Auto-detect category" toggle
- Show AI-suggested category with confidence
- Allow user to confirm or override

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/import-ai-insights/index.ts` | AI-powered cost optimization insights |
| `supabase/functions/supplier-performance-advisor/index.ts` | Supplier reliability and efficiency analysis |
| `src/components/import/ImportAIInsightsPanel.tsx` | Display AI recommendations in analytics |
| `src/components/import/SupplierAIPanel.tsx` | Supplier performance AI widget |
| `src/pages/import/ImportCIFLearning.tsx` | Dedicated page for CIF learning engine |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/import/ImportAnalytics.tsx` | Add ImportAIInsightsPanel component |
| `src/pages/Suppliers.tsx` | Add SupplierAIPanel component |
| `src/layouts/ImportLayout.tsx` | Add "AI Learning" nav item to sidebar |
| `src/components/import/UploadDocumentDialog.tsx` | Optional: Add auto-classification toggle |
| `src/hooks/useImportDocuments.ts` | Optional: Add AI classification call after upload |

---

## Implementation Order

1. **Phase 1** - Import AI Insights (highest value)
   - Create edge function for aggregated analysis
   - Build insights panel component
   - Integrate into Import Analytics page

2. **Phase 2** - CIF Learning Integration (quick win)
   - Add sidebar nav item
   - Create dedicated page wrapping existing component

3. **Phase 3** - Supplier Performance AI
   - Create edge function for supplier analysis
   - Build supplier AI panel
   - Integrate into Suppliers page

4. **Phase 4** - Document Auto-Classification (optional)
   - Enhance upload hook with AI classification
   - Update upload dialog UI

---

## Technical Details

### Edge Function Pattern (Import AI Insights)
```typescript
// Aggregate metrics from multiple tables
const [cifData, billsData, ordersData, suppliersData] = await Promise.all([
  supabase.from('cif_calculations').select('*').order('created_at', { ascending: false }).limit(100),
  supabase.from('bills').select('*').order('bill_date', { ascending: false }).limit(100),
  supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
  supabase.from('suppliers').select('*')
]);

// Build AI prompt with business context and data summary
// Call Lovable AI (google/gemini-2.5-flash for speed)
// Return structured insights JSON
```

### AI Models Selection
- **Import AI Insights**: `google/gemini-2.5-flash` (fast, cost-effective for aggregated analysis)
- **Supplier Performance**: `google/gemini-2.5-flash` (structured output, fast response)
- **Document Classification**: `google/gemini-2.5-flash` (vision capable, efficient for classification)

---

## Result

After implementation:
- AI-powered insights panel in Import Analytics surfacing cost optimization opportunities
- CIF Learning Engine accessible from Import sidebar for continuous accuracy improvement
- Supplier Performance AI advisor helping procurement decisions
- Optional document auto-classification reducing manual categorization effort

