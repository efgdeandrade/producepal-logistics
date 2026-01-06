-- Update major zones with center coordinates calculated from their sub-zones
-- Meimei (id: 2e3bb80c-b092-4fcb-911b-ecdf1cffa052)
UPDATE fnb_delivery_zones 
SET 
  center_latitude = (
    SELECT AVG(center_latitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '2e3bb80c-b092-4fcb-911b-ecdf1cffa052' 
    AND center_latitude IS NOT NULL
  ),
  center_longitude = (
    SELECT AVG(center_longitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '2e3bb80c-b092-4fcb-911b-ecdf1cffa052' 
    AND center_longitude IS NOT NULL
  ),
  radius_meters = 5000
WHERE id = '2e3bb80c-b092-4fcb-911b-ecdf1cffa052';

-- Pabou (id: 519878a0-9501-4edf-9915-c9e386d2fd90)
UPDATE fnb_delivery_zones 
SET 
  center_latitude = (
    SELECT AVG(center_latitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '519878a0-9501-4edf-9915-c9e386d2fd90' 
    AND center_latitude IS NOT NULL
  ),
  center_longitude = (
    SELECT AVG(center_longitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '519878a0-9501-4edf-9915-c9e386d2fd90' 
    AND center_longitude IS NOT NULL
  ),
  radius_meters = 8000
WHERE id = '519878a0-9501-4edf-9915-c9e386d2fd90';

-- Pariba (id: 05ca0392-896a-4c1a-8b6d-f8fdf561a2af)
UPDATE fnb_delivery_zones 
SET 
  center_latitude = (
    SELECT AVG(center_latitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '05ca0392-896a-4c1a-8b6d-f8fdf561a2af' 
    AND center_latitude IS NOT NULL
  ),
  center_longitude = (
    SELECT AVG(center_longitude) 
    FROM fnb_delivery_zones 
    WHERE parent_zone_id = '05ca0392-896a-4c1a-8b6d-f8fdf561a2af' 
    AND center_longitude IS NOT NULL
  ),
  radius_meters = 6000
WHERE id = '05ca0392-896a-4c1a-8b6d-f8fdf561a2af';

-- Fix customers: set major_zone_id based on delivery_zone (sub-zone name)
UPDATE fnb_customers c
SET major_zone_id = sz.parent_zone_id
FROM fnb_delivery_zones sz
WHERE c.delivery_zone = sz.name
  AND sz.zone_type = 'sub'
  AND sz.parent_zone_id IS NOT NULL
  AND c.major_zone_id IS NULL;