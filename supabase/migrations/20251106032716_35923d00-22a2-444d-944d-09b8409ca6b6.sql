-- Create pricing_recommendations table
CREATE TABLE pricing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  current_wholesale_price NUMERIC NOT NULL,
  current_retail_price NUMERIC,
  recommended_wholesale_price NUMERIC NOT NULL,
  recommended_retail_price NUMERIC,
  expected_profit_impact NUMERIC,
  expected_margin_change NUMERIC,
  reasoning TEXT NOT NULL,
  data_sources JSONB,
  confidence_score TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  applied_by UUID
);

-- Add indexes for pricing_recommendations
CREATE INDEX idx_pricing_recommendations_product ON pricing_recommendations(product_code);
CREATE INDEX idx_pricing_recommendations_status ON pricing_recommendations(status);
CREATE INDEX idx_pricing_recommendations_created ON pricing_recommendations(created_at);

-- Enable RLS on pricing_recommendations
ALTER TABLE pricing_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pricing_recommendations
CREATE POLICY "Authenticated users can view pricing recommendations"
  ON pricing_recommendations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage pricing recommendations"
  ON pricing_recommendations FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role)
  );

-- Create demand_patterns table
CREATE TABLE demand_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  avg_order_quantity NUMERIC,
  order_frequency INTEGER,
  total_ordered INTEGER,
  avg_waste_rate NUMERIC,
  last_order_date DATE,
  price_sensitivity TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_code, customer_id)
);

-- Add indexes for demand_patterns
CREATE INDEX idx_demand_patterns_product ON demand_patterns(product_code);
CREATE INDEX idx_demand_patterns_customer ON demand_patterns(customer_id);

-- Enable RLS on demand_patterns
ALTER TABLE demand_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for demand_patterns
CREATE POLICY "Authenticated users can view demand patterns"
  ON demand_patterns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage demand patterns"
  ON demand_patterns FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role)
  );