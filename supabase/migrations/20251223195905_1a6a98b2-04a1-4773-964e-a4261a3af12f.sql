-- Phase 1: Add weight-based fields to fnb_products
ALTER TABLE fnb_products ADD COLUMN IF NOT EXISTS is_weight_based boolean DEFAULT false;
ALTER TABLE fnb_products ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'kg';

-- Phase 1: Add actual weight tracking to fnb_order_items for billing
ALTER TABLE fnb_order_items ADD COLUMN IF NOT EXISTS actual_weight_kg numeric;
ALTER TABLE fnb_order_items ADD COLUMN IF NOT EXISTS is_over_picked boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN fnb_products.is_weight_based IS 'If true, product is picked by weight (allows decimal input and over-picking)';
COMMENT ON COLUMN fnb_products.weight_unit IS 'Unit for weight-based products (kg, lb, g)';
COMMENT ON COLUMN fnb_order_items.actual_weight_kg IS 'Actual weight picked for weight-based items';
COMMENT ON COLUMN fnb_order_items.is_over_picked IS 'True if picked quantity exceeds ordered quantity (allowed for weight items)';