-- Add COD tracking columns to fnb_orders
ALTER TABLE public.fnb_orders 
ADD COLUMN payment_method text DEFAULT 'cod',
ADD COLUMN cod_amount_due numeric DEFAULT 0,
ADD COLUMN cod_amount_collected numeric,
ADD COLUMN cod_collected_at timestamp with time zone,
ADD COLUMN cod_reconciled_at timestamp with time zone,
ADD COLUMN cod_reconciled_by uuid REFERENCES auth.users(id),
ADD COLUMN cod_notes text;

-- Create index for COD reconciliation queries
CREATE INDEX idx_fnb_orders_cod_status ON public.fnb_orders(payment_method, cod_collected_at, cod_reconciled_at);