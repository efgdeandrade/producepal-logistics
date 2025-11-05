-- Add wholesale selling prices to products table
ALTER TABLE public.products 
ADD COLUMN wholesale_price_usd_per_unit numeric,
ADD COLUMN wholesale_price_xcg_per_unit numeric;

COMMENT ON COLUMN public.products.wholesale_price_usd_per_unit IS 'Wholesale selling price per unit in USD';
COMMENT ON COLUMN public.products.wholesale_price_xcg_per_unit IS 'Wholesale selling price per unit in XCG';