-- Add major_zone_id column to fnb_customers
ALTER TABLE fnb_customers 
ADD COLUMN major_zone_id UUID REFERENCES fnb_delivery_zones(id);

-- Create index for efficient querying
CREATE INDEX idx_fnb_customers_major_zone ON fnb_customers(major_zone_id);