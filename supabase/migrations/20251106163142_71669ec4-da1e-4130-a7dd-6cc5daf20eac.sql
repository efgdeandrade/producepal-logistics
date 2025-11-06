-- Create table for tracking CIF allocation decisions and performance
CREATE TABLE IF NOT EXISTS public.cif_allocation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  decision_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recommended_method TEXT NOT NULL,
  chosen_method TEXT NOT NULL,
  confidence_level TEXT,
  total_products INTEGER NOT NULL,
  total_weight_kg NUMERIC(10,2),
  total_cost_usd NUMERIC(10,2),
  total_freight_usd NUMERIC(10,2),
  predicted_profit_xcg NUMERIC(10,2),
  actual_profit_xcg NUMERIC(10,2),
  ai_reasoning JSONB,
  market_context JSONB,
  strategic_insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for product-level CIF performance tracking
CREATE TABLE IF NOT EXISTS public.cif_product_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES cif_allocation_decisions(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  allocation_method TEXT NOT NULL,
  freight_allocated_usd NUMERIC(10,2),
  cif_per_unit_xcg NUMERIC(10,2),
  wholesale_price_xcg NUMERIC(10,2),
  predicted_margin_percentage NUMERIC(5,2),
  predicted_margin_xcg NUMERIC(10,2),
  actual_margin_xcg NUMERIC(10,2),
  quantity INTEGER NOT NULL,
  waste_quantity INTEGER DEFAULT 0,
  market_position TEXT,
  competitive_gap_percentage NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_cif_decisions_date ON cif_allocation_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_cif_decisions_method ON cif_allocation_decisions(chosen_method);
CREATE INDEX IF NOT EXISTS idx_cif_product_perf_product ON cif_product_performance(product_code);
CREATE INDEX IF NOT EXISTS idx_cif_product_perf_decision ON cif_product_performance(decision_id);

-- Add index on demand_patterns for velocity analysis
CREATE INDEX IF NOT EXISTS idx_demand_patterns_product_customer ON demand_patterns(product_code, customer_id);
CREATE INDEX IF NOT EXISTS idx_demand_patterns_frequency ON demand_patterns(order_frequency DESC);

-- Enable RLS
ALTER TABLE public.cif_allocation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_product_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cif_allocation_decisions
CREATE POLICY "Authenticated users can view CIF decisions"
  ON public.cif_allocation_decisions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage CIF decisions"
  ON public.cif_allocation_decisions
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role)
  );

-- RLS Policies for cif_product_performance
CREATE POLICY "Authenticated users can view product performance"
  ON public.cif_product_performance
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage product performance"
  ON public.cif_product_performance
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role)
  );

-- Add trigger for updated_at
CREATE TRIGGER update_cif_allocation_decisions_updated_at
  BEFORE UPDATE ON public.cif_allocation_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();