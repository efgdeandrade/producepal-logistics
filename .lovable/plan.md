
# Import Department Enhancement Plan

## Summary

Enhance the Import department with full CRUD capabilities for bills, functional document management with storage integration, real analytics with historical data, and import-specific reporting. This plan addresses the four key gaps you identified.

---

## Phase 1: Bills/Expenses Management

**Current State:** Read-only table, no create/edit functionality, no payment tracking

**Enhancements:**

### 1.1 Add Bill Dialog Component
Create `src/components/import/AddBillDialog.tsx`:
- Form fields: Bill number, vendor (dropdown from suppliers), date, due date, amount, currency, status, notes
- Validation with zod schema
- Support for both create and edit modes

### 1.2 Payment Status Enhancement
Database migration to add `payment_status` column to bills table:
- Values: `unpaid`, `partial`, `paid`
- Add `paid_date` and `paid_amount` columns for tracking

### 1.3 Update ImportBills Page
- Add "Add Bill" button in header
- Add row actions (Edit, Delete, Mark as Paid)
- Add payment status badge column
- Add filters for status/payment
- Add overdue indicator (highlight bills past due_date that are unpaid)

### 1.4 Aging Report Card
Add aging summary showing:
- Current (not yet due)
- 1-30 days overdue
- 31-60 days overdue
- 60+ days overdue

---

## Phase 2: Document Management

**Current State:** Static placeholders, non-functional upload

**Enhancements:**

### 2.1 Database Table
Create `import_documents` table:
- `id`, `file_name`, `file_path`, `file_type`, `file_size`
- `category` (customs, airwaybill, commercial, packing, certificates, phyto, other)
- `order_id` (optional FK to orders)
- `shipment_id` (optional FK for future shipments table)
- `uploaded_by`, `created_at`, `notes`

### 2.2 Storage Bucket
Create `import-documents` storage bucket with appropriate RLS policies

### 2.3 Upload Document Dialog
Create `src/components/import/UploadDocumentDialog.tsx`:
- File picker with drag-and-drop
- Category selection
- Optional order linking (dropdown)
- Notes field

### 2.4 Update ImportDocuments Page
- Wire Upload button to dialog
- Fetch documents from database
- Display in table with: file name, category, linked order, upload date
- Row actions: Download, Delete, View (for PDFs/images)
- Update category cards with real counts

---

## Phase 3: Analytics Depth

**Current State:** Static mock data for monthly chart, no cost/margin analysis

**Enhancements:**

### 3.1 Replace Mock Data with Real Queries
Update ImportAnalytics.tsx to:
- Query CIF calculations grouped by month
- Calculate actual monthly trends from `created_at` field

### 3.2 Add Cost Trend Charts
New chart section showing:
- Freight costs over time (from CIF calculations)
- Average CIF per kg/unit trends
- Exchange rate trends

### 3.3 Add Supplier Performance Metrics
New card section:
- Orders per supplier
- Average order value by supplier
- Lead time analysis (if shipment dates tracked)

### 3.4 Add Margin Analysis
Create margin insights from CIF data:
- Cost breakdown: FOB, Freight, Insurance, Duties
- Margin % by calculation type
- Comparison of allocated methods

---

## Phase 4: Import-Specific Reports

**Current State:** Report templates focus on distribution/sales, no import category

**Enhancements:**

### 4.1 Add "import" Category to Report Templates
Update `src/lib/reportTemplates.ts` to include:

**Supplier Spend Report:**
- Total spend by supplier
- Breakdown by product category
- Trend over time

**Landed Cost Analysis Report:**
- CIF breakdown (FOB, Freight, Insurance, Duties)
- Average landed cost per product
- Comparison by supplier

**Bill Aging Report:**
- Outstanding bills by age bracket
- Vendor-wise breakdown
- Payment trend analysis

**Shipment Status Report:**
- Active shipments by status
- ETD/ETA tracking
- Supplier performance metrics

### 4.2 Update Report Library Category Labels
Add "import" category with label "Import" and description "Supplier spend, landed costs, and bills"

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/import/AddBillDialog.tsx` | Create/edit bill form dialog |
| `src/components/import/UploadDocumentDialog.tsx` | Document upload with category selection |
| `src/hooks/useImportDocuments.ts` | Hook for document CRUD operations |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/import/ImportBills.tsx` | Add button, row actions, payment tracking, aging cards |
| `src/pages/import/ImportDocuments.tsx` | Wire upload, display documents from DB |
| `src/pages/import/ImportAnalytics.tsx` | Replace mock data, add cost/supplier/margin charts |
| `src/lib/reportTemplates.ts` | Add import category and 4 new templates |
| `src/pages/ReportLibrary.tsx` | Add import category to labels |

## Database Changes

```sql
-- Add payment tracking to bills
ALTER TABLE bills 
ADD COLUMN payment_status text DEFAULT 'unpaid',
ADD COLUMN paid_date date,
ADD COLUMN paid_amount numeric DEFAULT 0;

-- Create import documents table
CREATE TABLE import_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  category text NOT NULL,
  order_id uuid REFERENCES orders(id),
  notes text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE import_documents ENABLE ROW LEVEL SECURITY;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('import-documents', 'import-documents', false);
```

---

## Implementation Order

1. **Database migrations** - Add payment columns, create documents table and bucket
2. **Bills enhancements** - AddBillDialog, update ImportBills page
3. **Documents functionality** - UploadDocumentDialog, wire ImportDocuments page
4. **Analytics real data** - Replace mock charts, add new metric sections
5. **Report templates** - Add import category and templates

---

## Result

After implementation:
- Full CRUD for supplier bills with payment tracking and aging visibility
- Functional document upload with category organization and order linking
- Real-time analytics with cost trends, supplier metrics, and margin analysis
- Import-specific report templates for operational insights
