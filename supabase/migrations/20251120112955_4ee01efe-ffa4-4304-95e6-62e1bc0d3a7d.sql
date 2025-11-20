-- Create CIF Calculations table for saving/loading calculations
CREATE TABLE IF NOT EXISTS public.cif_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  calculation_name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('estimate', 'actual')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Calculation Inputs
  exchange_rate NUMERIC NOT NULL,
  freight_exterior_per_kg NUMERIC NOT NULL,
  freight_local_per_kg NUMERIC NOT NULL,
  freight_champion_cost NUMERIC,
  swissport_cost NUMERIC,
  
  -- Products Data (JSONB for flexibility)
  products JSONB NOT NULL,
  
  -- Calculation Results (JSONB)
  results JSONB NOT NULL,
  
  -- Summary Metrics
  total_pallets INTEGER,
  total_chargeable_weight NUMERIC,
  limiting_factor TEXT,
  selected_distribution_method TEXT,
  
  -- Notes
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_cif_calculations_created_by ON public.cif_calculations(created_by);
CREATE INDEX idx_cif_calculations_created_at ON public.cif_calculations(created_at DESC);
CREATE INDEX idx_cif_calculations_type ON public.cif_calculations(calculation_type);

-- Enable RLS
ALTER TABLE public.cif_calculations ENABLE ROW LEVEL SECURITY;

-- Users can view their own calculations
CREATE POLICY "Users can view own calculations"
  ON public.cif_calculations FOR SELECT
  USING (auth.uid() = created_by);

-- Users can create calculations
CREATE POLICY "Users can create calculations"
  ON public.cif_calculations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own calculations
CREATE POLICY "Users can update own calculations"
  ON public.cif_calculations FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete their own calculations
CREATE POLICY "Users can delete own calculations"
  ON public.cif_calculations FOR DELETE
  USING (auth.uid() = created_by);

-- Admins can view all
CREATE POLICY "Admins can view all calculations"
  ON public.cif_calculations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER handle_cif_calculations_updated_at 
  BEFORE UPDATE ON public.cif_calculations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();