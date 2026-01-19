-- Add default_unit column to distribution_standing_order_items
ALTER TABLE distribution_standing_order_items 
ADD COLUMN default_unit text;