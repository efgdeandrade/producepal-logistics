-- Create pricing tiers table
CREATE TABLE public.fnb_pricing_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product tier prices table
CREATE TABLE public.fnb_product_tier_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.fnb_products(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.fnb_pricing_tiers(id) ON DELETE CASCADE,
  price_xcg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, tier_id)
);

-- Add pricing tier to customers
ALTER TABLE public.fnb_customers 
ADD COLUMN pricing_tier_id UUID REFERENCES public.fnb_pricing_tiers(id);

-- Enable RLS
ALTER TABLE public.fnb_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_product_tier_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing tiers
CREATE POLICY "Authenticated users can view pricing tiers"
ON public.fnb_pricing_tiers FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage pricing tiers"
ON public.fnb_pricing_tiers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for product tier prices
CREATE POLICY "Authenticated users can view product tier prices"
ON public.fnb_product_tier_prices FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage product tier prices"
ON public.fnb_product_tier_prices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Seed default pricing tiers
INSERT INTO public.fnb_pricing_tiers (name, description, is_default, sort_order) VALUES
('Retail', 'Standard retail pricing for walk-in customers', true, 1),
('Wholesale', 'Discounted pricing for wholesale buyers', false, 2),
('Hotel', 'Special pricing for hotel and hospitality clients', false, 3);