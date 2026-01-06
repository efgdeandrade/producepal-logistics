-- Create table to store unmatched items for AI learning
CREATE TABLE public.fnb_unmatched_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  customer_id UUID REFERENCES public.fnb_customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.fnb_conversations(id) ON DELETE SET NULL,
  detected_language TEXT,
  detected_quantity NUMERIC,
  detected_unit TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_product_id UUID REFERENCES public.fnb_products(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  added_as_global_alias BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fnb_unmatched_items ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view unmatched items"
ON public.fnb_unmatched_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert unmatched items"
ON public.fnb_unmatched_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update unmatched items"
ON public.fnb_unmatched_items
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete unmatched items"
ON public.fnb_unmatched_items
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_fnb_unmatched_items_resolved ON public.fnb_unmatched_items(is_resolved);
CREATE INDEX idx_fnb_unmatched_items_customer ON public.fnb_unmatched_items(customer_id);