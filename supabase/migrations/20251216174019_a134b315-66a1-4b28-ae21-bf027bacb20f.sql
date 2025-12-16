-- Add delivery zone to customers
ALTER TABLE public.fnb_customers 
ADD COLUMN delivery_zone text;

-- Create index for zone queries
CREATE INDEX idx_fnb_customers_delivery_zone ON public.fnb_customers(delivery_zone);