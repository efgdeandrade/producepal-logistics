-- Create fnb_customer_product_mappings table for storing learned customer product names
CREATE TABLE public.fnb_customer_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.fnb_customers(id) ON DELETE CASCADE NOT NULL,
  customer_sku TEXT NOT NULL,
  customer_product_name TEXT NOT NULL,
  product_id UUID REFERENCES public.fnb_products(id) ON DELETE CASCADE NOT NULL,
  confidence_score NUMERIC DEFAULT 1.0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, customer_sku)
);

-- Create fnb_po_imports table for tracking PO import history
CREATE TABLE public.fnb_po_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.fnb_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.fnb_orders(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  po_file_url TEXT,
  delivery_date DATE,
  items_imported INTEGER DEFAULT 0,
  items_matched INTEGER DEFAULT 0,
  items_unmatched INTEGER DEFAULT 0,
  raw_extracted_data JSONB,
  imported_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.fnb_customer_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_po_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies for fnb_customer_product_mappings
CREATE POLICY "Authenticated users can view product mappings"
ON public.fnb_customer_product_mappings
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage product mappings"
ON public.fnb_customer_product_mappings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for fnb_po_imports
CREATE POLICY "Authenticated users can view PO imports"
ON public.fnb_po_imports
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage PO imports"
ON public.fnb_po_imports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Create updated_at trigger for mappings table
CREATE TRIGGER update_fnb_customer_product_mappings_updated_at
BEFORE UPDATE ON public.fnb_customer_product_mappings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();