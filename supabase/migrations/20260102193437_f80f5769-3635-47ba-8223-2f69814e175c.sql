-- Add column to track which template an order came from
ALTER TABLE fnb_orders 
ADD COLUMN standing_order_template_id uuid REFERENCES fnb_standing_order_templates(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_fnb_orders_standing_order_template_id 
ON fnb_orders(standing_order_template_id) 
WHERE standing_order_template_id IS NOT NULL;