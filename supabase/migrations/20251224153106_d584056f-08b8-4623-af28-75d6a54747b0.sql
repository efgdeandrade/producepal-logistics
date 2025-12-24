-- Add columns to track shortage resolution by pickers
ALTER TABLE fnb_order_items 
  ADD COLUMN IF NOT EXISTS shortage_resolved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS shortage_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS shortage_resolution_notes text;