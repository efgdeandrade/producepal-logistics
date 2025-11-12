-- Add unique constraint for order_id + product_code to support upsert operations
ALTER TABLE cif_estimates 
ADD CONSTRAINT cif_estimates_order_product_unique 
UNIQUE (order_id, product_code);

-- This allows upsert operations to correctly update existing records
-- instead of failing on duplicate inserts