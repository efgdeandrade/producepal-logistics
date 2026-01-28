-- Create customer_product_prices table for custom pricing per customer-product combination
CREATE TABLE public.customer_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price_xcg NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID,
  UNIQUE (customer_id, product_id)
);

-- Enable RLS
ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view customer prices"
ON public.customer_product_prices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customer prices"
ON public.customer_product_prices FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer prices"
ON public.customer_product_prices FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete customer prices"
ON public.customer_product_prices FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_customer_product_prices_updated_at
BEFORE UPDATE ON public.customer_product_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_customer_product_prices_customer ON public.customer_product_prices(customer_id);
CREATE INDEX idx_customer_product_prices_product ON public.customer_product_prices(product_id);