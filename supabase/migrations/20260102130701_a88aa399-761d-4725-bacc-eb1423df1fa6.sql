-- Add delivery_station field to fnb_orders for tracking department/location within a customer
ALTER TABLE fnb_orders ADD COLUMN delivery_station TEXT;