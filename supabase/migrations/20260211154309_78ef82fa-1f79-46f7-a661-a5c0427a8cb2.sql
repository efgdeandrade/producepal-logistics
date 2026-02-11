-- Add stock_quantity column to order_items for split stock/import tracking
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.order_items.stock_quantity IS 'Quantity already in stock - excluded from supplier POs but included in customer receipts';
