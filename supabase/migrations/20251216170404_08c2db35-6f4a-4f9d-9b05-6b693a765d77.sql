-- Add columns to fnb_order_items for tracking shorts during picking
ALTER TABLE fnb_order_items 
ADD COLUMN IF NOT EXISTS short_quantity numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS short_reason text;

-- Add comment for documentation
COMMENT ON COLUMN fnb_order_items.short_quantity IS 'Quantity that was short during picking (ordered - picked)';
COMMENT ON COLUMN fnb_order_items.short_reason IS 'Reason for shortage: out_of_stock, damaged, quality_issue, other';