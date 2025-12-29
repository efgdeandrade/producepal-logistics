-- Add unit-specific pricing and case information columns to fnb_products
ALTER TABLE fnb_products 
ADD COLUMN IF NOT EXISTS price_per_kg numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_per_lb numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_per_case numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_per_piece numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS items_per_case integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS case_weight_kg numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS product_description text DEFAULT NULL;