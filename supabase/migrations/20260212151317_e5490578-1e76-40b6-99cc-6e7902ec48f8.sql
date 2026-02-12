
-- Add supplier_cost_usd_per_case to order_items for per-line CIF tracking
-- This allows historical orders to store supplier cost at order time
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS supplier_cost_usd_per_case numeric DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.order_items.supplier_cost_usd_per_case IS 'Supplier cost per case at time of order, used for CIF calculations. Falls back to product default if NULL.';
