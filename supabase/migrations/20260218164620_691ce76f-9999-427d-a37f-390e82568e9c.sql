
-- Add explicit weight model fields to products table
-- These replace the ambiguous "weight" field for CIF calculations

-- Weight mode enum-like text column
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS weight_mode text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_net_g numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_gross_g numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS case_tare_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_gross_g numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS case_weight_override_enabled boolean DEFAULT false;

-- Add constraint for weight_mode values
ALTER TABLE public.products 
  ADD CONSTRAINT chk_weight_mode 
  CHECK (weight_mode IS NULL OR weight_mode IN ('CASE_GROSS', 'UNIT_NET_PLUS_TARE', 'UNIT_GROSS_PLUS_TARE'));

-- Add comments for documentation
COMMENT ON COLUMN public.products.weight_mode IS 'Weight resolution mode: CASE_GROSS (manual case weight), UNIT_NET_PLUS_TARE (computed from unit net * pack + tare), UNIT_GROSS_PLUS_TARE (computed from unit gross * pack + tare)';
COMMENT ON COLUMN public.products.unit_net_g IS 'Net weight per individual unit/piece in grams';
COMMENT ON COLUMN public.products.unit_gross_g IS 'Gross weight per individual unit/piece in grams (optional)';
COMMENT ON COLUMN public.products.case_tare_g IS 'Weight of empty case/tray in grams';
COMMENT ON COLUMN public.products.case_gross_g IS 'Total gross weight of a full case in grams';
COMMENT ON COLUMN public.products.case_weight_override_enabled IS 'When true, case_gross_g is always used regardless of weight_mode';
