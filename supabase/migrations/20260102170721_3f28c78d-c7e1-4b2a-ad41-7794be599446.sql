-- Add priority column to fnb_orders table for order urgency
ALTER TABLE fnb_orders 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

COMMENT ON COLUMN fnb_orders.priority IS 'Order urgency: 0=normal, 1=urgent, 2=critical';