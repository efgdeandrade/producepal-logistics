-- Phase 1: Add product dimensions and create CIF tracking tables

-- Add dimension columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS length_cm NUMERIC,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS volumetric_weight_kg NUMERIC;

-- Create CIF estimates table for tracking estimated vs actual costs
CREATE TABLE IF NOT EXISTS cif_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  estimated_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Weight calculations
  actual_weight_kg NUMERIC NOT NULL,
  volumetric_weight_kg NUMERIC NOT NULL,
  chargeable_weight_kg NUMERIC NOT NULL,
  weight_type_used TEXT CHECK (weight_type_used IN ('actual', 'volumetric')),
  
  -- Estimated costs
  estimated_freight_exterior_usd NUMERIC,
  estimated_freight_local_usd NUMERIC,
  estimated_other_costs_usd NUMERIC,
  estimated_total_freight_usd NUMERIC,
  estimated_cif_xcg NUMERIC,
  
  -- Actual costs (filled in later)
  actual_freight_exterior_usd NUMERIC,
  actual_freight_local_usd NUMERIC,
  actual_other_costs_usd NUMERIC,
  actual_total_freight_usd NUMERIC,
  actual_cif_xcg NUMERIC,
  
  -- Variance tracking
  variance_percentage NUMERIC,
  variance_amount_usd NUMERIC,
  
  -- Pallet configuration
  pallets_used INTEGER,
  pallet_utilization_percentage NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pallet configuration table
CREATE TABLE IF NOT EXISTS pallet_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  configuration_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  total_pallets INTEGER NOT NULL,
  total_actual_weight_kg NUMERIC,
  total_volumetric_weight_kg NUMERIC,
  total_chargeable_weight_kg NUMERIC,
  limiting_factor TEXT CHECK (limiting_factor IN ('actual_weight', 'volumetric_weight', 'balanced')),
  
  -- Europallet specifics
  pallet_length_cm NUMERIC DEFAULT 120,
  pallet_width_cm NUMERIC DEFAULT 80,
  max_height_cm NUMERIC DEFAULT 155,
  pallet_weight_kg NUMERIC DEFAULT 26,
  
  utilization_percentage NUMERIC,
  recommendations JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create CIF learning patterns table for AI learning
CREATE TABLE IF NOT EXISTS cif_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('product', 'supplier', 'seasonal', 'weight_range')),
  pattern_key TEXT NOT NULL,
  
  sample_size INTEGER DEFAULT 0,
  avg_variance_percentage NUMERIC,
  std_deviation NUMERIC,
  
  adjustment_factor NUMERIC DEFAULT 1.0,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(pattern_type, pattern_key)
);

-- Enable RLS on new tables
ALTER TABLE cif_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallet_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cif_learning_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for cif_estimates
CREATE POLICY "Authenticated users can view CIF estimates"
ON cif_estimates FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage CIF estimates"
ON cif_estimates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for pallet_configurations
CREATE POLICY "Authenticated users can view pallet configurations"
ON pallet_configurations FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage pallet configurations"
ON pallet_configurations FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for cif_learning_patterns
CREATE POLICY "Authenticated users can view learning patterns"
ON cif_learning_patterns FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage learning patterns"
ON cif_learning_patterns FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_cif_estimates_updated_at
  BEFORE UPDATE ON cif_estimates
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cif_estimates_order_id ON cif_estimates(order_id);
CREATE INDEX IF NOT EXISTS idx_cif_estimates_product_code ON cif_estimates(product_code);
CREATE INDEX IF NOT EXISTS idx_pallet_configurations_order_id ON pallet_configurations(order_id);
CREATE INDEX IF NOT EXISTS idx_cif_learning_patterns_type_key ON cif_learning_patterns(pattern_type, pattern_key);