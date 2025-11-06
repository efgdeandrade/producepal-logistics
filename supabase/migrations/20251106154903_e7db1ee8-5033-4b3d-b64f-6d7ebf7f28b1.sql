-- Add new columns to market_price_snapshots for enhanced Curaçao market intelligence
ALTER TABLE market_price_snapshots
ADD COLUMN IF NOT EXISTS retail_price_found numeric,
ADD COLUMN IF NOT EXISTS wholesale_conversion_factor numeric DEFAULT 1.40,
ADD COLUMN IF NOT EXISTS calculated_wholesale numeric,
ADD COLUMN IF NOT EXISTS region text DEFAULT 'curacao',
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS import_source_country text,
ADD COLUMN IF NOT EXISTS seasonal_factor text,
ADD COLUMN IF NOT EXISTS supply_demand_index numeric,
ADD COLUMN IF NOT EXISTS confidence_score numeric,
ADD COLUMN IF NOT EXISTS scraped_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_region ON market_price_snapshots(region);
CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_product_code ON market_price_snapshots(product_code);
CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_snapshot_date ON market_price_snapshots(snapshot_date DESC);

-- Add comment explaining the wholesale conversion
COMMENT ON COLUMN market_price_snapshots.retail_price_found IS 'Retail price scraped from online grocery stores in Curaçao';
COMMENT ON COLUMN market_price_snapshots.wholesale_conversion_factor IS 'Factor used to convert retail to wholesale (typically 1.40 in Curaçao = 40% markup)';
COMMENT ON COLUMN market_price_snapshots.calculated_wholesale IS 'Calculated wholesale price (retail_price_found ÷ wholesale_conversion_factor)';
COMMENT ON COLUMN market_price_snapshots.import_source_country IS 'Primary import source: usa, nld, or other';
COMMENT ON COLUMN market_price_snapshots.seasonal_factor IS 'Seasonal indicator: high_season (Nov-Apr tourism) or low_season';
COMMENT ON COLUMN market_price_snapshots.supply_demand_index IS 'Supply/demand indicator from 0 (low supply/demand) to 1 (high supply/demand)';
COMMENT ON COLUMN market_price_snapshots.confidence_score IS 'Data confidence score from 0 to 1 based on source reliability';