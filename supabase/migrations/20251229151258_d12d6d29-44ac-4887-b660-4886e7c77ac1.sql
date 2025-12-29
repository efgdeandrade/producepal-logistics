-- Add unit columns to fnb_order_items table
ALTER TABLE public.fnb_order_items 
  ADD COLUMN order_unit text,
  ADD COLUMN picked_unit text;