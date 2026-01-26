-- Add conversation snapshot and cancellation tracking to distribution_orders
ALTER TABLE public.distribution_orders 
ADD COLUMN IF NOT EXISTS source_conversation TEXT,
ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES public.distribution_orders(id),
ADD COLUMN IF NOT EXISTS modification_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INTEGER DEFAULT 2;

-- Add cancellation tracking to distribution_order_items  
ALTER TABLE public.distribution_order_items
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Create index for parent order lookups
CREATE INDEX IF NOT EXISTS idx_distribution_orders_parent ON public.distribution_orders(parent_order_id);

-- Add comment for clarity
COMMENT ON COLUMN public.distribution_orders.source_conversation IS 'Original WhatsApp conversation text that led to this order';
COMMENT ON COLUMN public.distribution_orders.parent_order_id IS 'Reference to original order if this is a modification/addition';
COMMENT ON COLUMN public.distribution_orders.modification_type IS 'Type: addition, edit, partial_cancel';
COMMENT ON COLUMN public.distribution_order_items.is_cancelled IS 'Item cancelled but kept for history';