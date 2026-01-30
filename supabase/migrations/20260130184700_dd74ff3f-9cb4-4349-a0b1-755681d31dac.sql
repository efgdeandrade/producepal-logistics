-- Add units_quantity column to store exact unit counts when edited directly
ALTER TABLE public.order_items 
ADD COLUMN units_quantity integer DEFAULT NULL;

COMMENT ON COLUMN public.order_items.units_quantity IS 
  'Explicit unit quantity when user edits units directly. When null, calculate as quantity * product.pack_size';