-- Add customer_notes column to order_items table
ALTER TABLE public.order_items ADD COLUMN customer_notes TEXT NULL;