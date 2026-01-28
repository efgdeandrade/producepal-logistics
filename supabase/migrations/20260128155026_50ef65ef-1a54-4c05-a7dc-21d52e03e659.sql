-- Add sale_price_xcg column to order_items table for custom pricing
ALTER TABLE order_items 
ADD COLUMN sale_price_xcg NUMERIC DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN order_items.sale_price_xcg IS 'Custom sale price in XCG at time of order. NULL means default tier price was used.';