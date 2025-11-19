-- Add supplier pallet configuration columns
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS cases_per_pallet INTEGER,
ADD COLUMN IF NOT EXISTS pallet_stacking_pattern TEXT,
ADD COLUMN IF NOT EXISTS notes_pallet_config TEXT;

-- Add comments for documentation
COMMENT ON COLUMN suppliers.cases_per_pallet IS 'Manual override for cases per pallet (e.g., Hortifresco=24, Steffanis=80)';
COMMENT ON COLUMN suppliers.pallet_stacking_pattern IS 'Description of stacking pattern (e.g., "4x6 pattern, 2 layers")';
COMMENT ON COLUMN suppliers.notes_pallet_config IS 'Special pallet handling or stacking instructions';