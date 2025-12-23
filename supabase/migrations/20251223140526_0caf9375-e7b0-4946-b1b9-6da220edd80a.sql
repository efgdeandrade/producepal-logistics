-- Add is_pickup column to fnb_orders table
ALTER TABLE public.fnb_orders ADD COLUMN is_pickup boolean DEFAULT false;