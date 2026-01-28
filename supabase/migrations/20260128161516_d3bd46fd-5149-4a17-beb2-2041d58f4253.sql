-- Add is_from_stock column to track items from existing inventory
ALTER TABLE order_items 
ADD COLUMN is_from_stock BOOLEAN DEFAULT false;