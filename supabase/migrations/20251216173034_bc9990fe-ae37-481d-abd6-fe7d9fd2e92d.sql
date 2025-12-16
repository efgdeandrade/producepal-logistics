-- Add delivery-related columns to fnb_orders table
ALTER TABLE public.fnb_orders 
ADD COLUMN driver_id uuid REFERENCES auth.users(id),
ADD COLUMN driver_name text,
ADD COLUMN assigned_at timestamp with time zone,
ADD COLUMN delivered_at timestamp with time zone;

-- Create index for driver queries
CREATE INDEX idx_fnb_orders_driver_id ON public.fnb_orders(driver_id);
CREATE INDEX idx_fnb_orders_status ON public.fnb_orders(status);