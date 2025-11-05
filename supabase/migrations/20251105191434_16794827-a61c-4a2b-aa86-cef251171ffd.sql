-- Add retail selling prices to products table
ALTER TABLE public.products 
ADD COLUMN retail_price_usd_per_unit numeric,
ADD COLUMN retail_price_xcg_per_unit numeric;

COMMENT ON COLUMN public.products.retail_price_usd_per_unit IS 'Retail selling price per unit in USD';
COMMENT ON COLUMN public.products.retail_price_xcg_per_unit IS 'Retail selling price per unit in XCG';