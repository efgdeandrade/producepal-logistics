-- Add new columns for detailed product specifications
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS case_size TEXT,
  ADD COLUMN IF NOT EXISTS netto_weight_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_weight_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS empty_case_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS price_usd_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS price_xcg_per_unit NUMERIC;

-- Migrate existing weight data to netto_weight_per_unit
UPDATE products 
SET netto_weight_per_unit = weight 
WHERE weight IS NOT NULL AND netto_weight_per_unit IS NULL;

-- Migrate existing prices (they were per case, convert to per unit)
UPDATE products 
SET price_usd_per_unit = price_usd / NULLIF(pack_size, 0)
WHERE price_usd IS NOT NULL AND price_usd_per_unit IS NULL;

UPDATE products 
SET price_xcg_per_unit = price_xcg / NULLIF(pack_size, 0)
WHERE price_xcg IS NOT NULL AND price_xcg_per_unit IS NULL;

-- Keep old columns for now for backwards compatibility
-- We can remove them later: weight, price_usd, price_xcg