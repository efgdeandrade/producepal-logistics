-- Add missing columns to cif_learning_patterns
ALTER TABLE cif_learning_patterns 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cif_learning_patterns
ADD COLUMN IF NOT EXISTS season_quarter INTEGER;

ALTER TABLE cif_learning_patterns
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Create trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION update_cif_learning_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS cif_learning_pattern_timestamp ON cif_learning_patterns;

CREATE TRIGGER cif_learning_pattern_timestamp
BEFORE UPDATE ON cif_learning_patterns
FOR EACH ROW EXECUTE FUNCTION update_cif_learning_pattern_timestamp();