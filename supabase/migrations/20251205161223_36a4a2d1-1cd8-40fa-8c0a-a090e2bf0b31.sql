-- Add pricing_tier column to customers table
ALTER TABLE public.customers 
ADD COLUMN pricing_tier TEXT NOT NULL DEFAULT 'wholesale' 
CHECK (pricing_tier IN ('wholesale', 'retail'));

-- Update known retail customers
UPDATE public.customers 
SET pricing_tier = 'retail' 
WHERE name ILIKE '%FUIK SHOP%' OR name ILIKE '%Sandals%';