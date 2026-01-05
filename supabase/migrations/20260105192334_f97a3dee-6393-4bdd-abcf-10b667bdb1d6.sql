-- Add picker_name column for displaying who picked each item
ALTER TABLE fnb_order_items ADD COLUMN IF NOT EXISTS picker_name TEXT;

-- Index for faster queries on picked items
CREATE INDEX IF NOT EXISTS idx_fnb_order_items_picked_by ON fnb_order_items(picked_by);