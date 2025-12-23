-- Add geographic columns to fnb_delivery_zones for map-based zone management
ALTER TABLE public.fnb_delivery_zones
ADD COLUMN IF NOT EXISTS center_latitude numeric,
ADD COLUMN IF NOT EXISTS center_longitude numeric,
ADD COLUMN IF NOT EXISTS radius_meters numeric DEFAULT 1000,
ADD COLUMN IF NOT EXISTS polygon_coordinates jsonb;

-- Add coordinate columns to fnb_customers for geocoding
ALTER TABLE public.fnb_customers
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add comments for documentation
COMMENT ON COLUMN public.fnb_delivery_zones.center_latitude IS 'Latitude of zone center point';
COMMENT ON COLUMN public.fnb_delivery_zones.center_longitude IS 'Longitude of zone center point';
COMMENT ON COLUMN public.fnb_delivery_zones.radius_meters IS 'Radius of circular zone in meters';
COMMENT ON COLUMN public.fnb_delivery_zones.polygon_coordinates IS 'GeoJSON coordinates for custom polygon boundaries';
COMMENT ON COLUMN public.fnb_customers.latitude IS 'Customer location latitude for zone assignment and routing';
COMMENT ON COLUMN public.fnb_customers.longitude IS 'Customer location longitude for zone assignment and routing';