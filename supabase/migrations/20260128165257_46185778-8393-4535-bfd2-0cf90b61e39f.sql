-- Create product_supplier_prices table for multi-supplier pricing
CREATE TABLE public.product_supplier_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  cost_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price_xcg NUMERIC(10,2) NOT NULL DEFAULT 0,
  lead_time_days INTEGER,
  min_order_qty INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one price entry per product-supplier combination
  CONSTRAINT unique_product_supplier UNIQUE (product_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.product_supplier_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view product supplier prices"
ON public.product_supplier_prices
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert product supplier prices"
ON public.product_supplier_prices
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update product supplier prices"
ON public.product_supplier_prices
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete product supplier prices"
ON public.product_supplier_prices
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_product_supplier_prices_updated_at
BEFORE UPDATE ON public.product_supplier_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_product_supplier_prices_product_id ON public.product_supplier_prices(product_id);
CREATE INDEX idx_product_supplier_prices_supplier_id ON public.product_supplier_prices(supplier_id);