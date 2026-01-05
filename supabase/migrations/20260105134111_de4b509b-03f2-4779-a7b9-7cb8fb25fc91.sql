-- Add price_per_tros column to fnb_products table
ALTER TABLE public.fnb_products 
ADD COLUMN price_per_tros numeric NULL;