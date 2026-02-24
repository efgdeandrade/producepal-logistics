
-- Receipt versions table: each edit creates a new version
CREATE TABLE public.receipt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  delivery_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_current BOOLEAN NOT NULL DEFAULT true
);

-- Receipt line items: the actual items on each version
CREATE TABLE public.receipt_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_version_id UUID NOT NULL REFERENCES public.receipt_versions(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_receipt_versions_receipt_number ON public.receipt_versions(receipt_number);
CREATE INDEX idx_receipt_versions_order_id ON public.receipt_versions(order_id);
CREATE INDEX idx_receipt_versions_current ON public.receipt_versions(receipt_number, is_current) WHERE is_current = true;
CREATE INDEX idx_receipt_line_items_version ON public.receipt_line_items(receipt_version_id);

-- Enable RLS
ALTER TABLE public.receipt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can CRUD (role-based access handled at app level)
CREATE POLICY "Authenticated users can view receipt versions"
  ON public.receipt_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create receipt versions"
  ON public.receipt_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update receipt versions"
  ON public.receipt_versions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view receipt line items"
  ON public.receipt_line_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create receipt line items"
  ON public.receipt_line_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update receipt line items"
  ON public.receipt_line_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete receipt line items"
  ON public.receipt_line_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
