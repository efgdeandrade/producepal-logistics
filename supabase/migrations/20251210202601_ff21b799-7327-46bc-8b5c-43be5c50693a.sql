-- Add consolidation_group column to products table
ALTER TABLE products ADD COLUMN consolidation_group TEXT;

-- Create index for efficient grouping queries
CREATE INDEX idx_products_consolidation_group ON products(consolidation_group);

-- Set consolidation groups for Hortifresco Baby Greens (4 products only)
UPDATE products 
SET consolidation_group = 'BABY_GREENS_150G'
WHERE supplier_id = '3d537a0a-4fa2-4cd5-b8ea-dd4399e7d4ff'
AND code IN ('003385-001', '003086-006', '003386-001', '003387-003');

-- Set consolidation group for ALL Morenos/Kiska products
UPDATE products 
SET consolidation_group = 'HERBS_500G'
WHERE supplier_id = 'ee3933dd-ba1b-4256-83c7-9c4353ebf3f5';