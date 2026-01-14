-- Add quickbooks_item_id column to fnb_products table for caching QuickBooks Item IDs
ALTER TABLE fnb_products 
ADD COLUMN IF NOT EXISTS quickbooks_item_id TEXT;