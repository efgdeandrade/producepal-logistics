-- Add configurable cost columns to cif_calculations table
ALTER TABLE cif_calculations 
ADD COLUMN IF NOT EXISTS local_logistics_usd numeric DEFAULT 91,
ADD COLUMN IF NOT EXISTS labor_xcg numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS bank_charges_usd numeric DEFAULT 0;

COMMENT ON COLUMN cif_calculations.local_logistics_usd IS 'Local logistics cost in USD, configurable per calculation';
COMMENT ON COLUMN cif_calculations.labor_xcg IS 'Labor cost in XCG, configurable per calculation';
COMMENT ON COLUMN cif_calculations.bank_charges_usd IS 'Bank charges in USD, optional';