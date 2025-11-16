-- Create tables for weight estimation learning and pallet optimization

-- Table to track historical accuracy of weight estimates
CREATE TABLE IF NOT EXISTS public.weight_estimation_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  product_code TEXT NOT NULL,
  estimated_actual_weight_kg NUMERIC NOT NULL,
  estimated_volumetric_weight_kg NUMERIC NOT NULL,
  estimated_chargeable_weight_kg NUMERIC NOT NULL,
  actual_actual_weight_kg NUMERIC,
  actual_volumetric_weight_kg NUMERIC,
  actual_chargeable_weight_kg NUMERIC,
  variance_percentage NUMERIC,
  variance_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table to track pallet configurations and their efficiency
CREATE TABLE IF NOT EXISTS public.pallet_configuration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  estimated_pallets INTEGER NOT NULL,
  actual_pallets INTEGER,
  estimated_utilization_pct NUMERIC NOT NULL,
  actual_utilization_pct NUMERIC,
  limiting_factor TEXT, -- 'weight' or 'volume' or 'balanced'
  configuration_data JSONB, -- Store detailed pallet stacking info
  ai_recommendations JSONB, -- Store AI suggestions for this configuration
  recommendation_accuracy NUMERIC, -- How accurate were AI suggestions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store learned adjustment factors
CREATE TABLE IF NOT EXISTS public.weight_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key TEXT UNIQUE NOT NULL, -- e.g., "product:STB_500" or "supplier:xyz"
  pattern_type TEXT NOT NULL, -- 'product', 'supplier', 'seasonal', 'product_supplier'
  adjustment_factor NUMERIC DEFAULT 1.0,
  confidence_score NUMERIC, -- 0-1 score based on sample size and variance
  sample_size INTEGER DEFAULT 0,
  avg_variance_percentage NUMERIC,
  std_deviation NUMERIC,
  last_calculated TIMESTAMPTZ DEFAULT now(),
  metadata JSONB, -- Additional context (e.g., seasonal patterns)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_estimation_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_configuration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_learning_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view weight accuracy"
  ON public.weight_estimation_accuracy FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage weight accuracy"
  ON public.weight_estimation_accuracy FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Authenticated users can view pallet history"
  ON public.pallet_configuration_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage pallet history"
  ON public.pallet_configuration_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Authenticated users can view learning patterns"
  ON public.weight_learning_patterns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage learning patterns"
  ON public.weight_learning_patterns FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weight_accuracy_product ON public.weight_estimation_accuracy(product_code);
CREATE INDEX IF NOT EXISTS idx_weight_accuracy_order ON public.weight_estimation_accuracy(order_id);
CREATE INDEX IF NOT EXISTS idx_pallet_history_supplier ON public.pallet_configuration_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pallet_history_order ON public.pallet_configuration_history(order_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_key ON public.weight_learning_patterns(pattern_key);