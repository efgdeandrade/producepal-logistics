-- Create table for tracking AI match logs to enable learning
CREATE TABLE fnb_ai_match_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  interpreted_text TEXT,
  customer_id UUID REFERENCES fnb_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES fnb_orders(id) ON DELETE SET NULL,
  matched_product_id UUID REFERENCES fnb_products(id) ON DELETE SET NULL,
  match_source TEXT, -- 'verified', 'customer_mapping', 'global_alias', 'ai_match', 'product_name', 'manual', 'unmatched'
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  was_corrected BOOLEAN DEFAULT FALSE,
  corrected_product_id UUID REFERENCES fnb_products(id) ON DELETE SET NULL,
  detected_language TEXT,
  detected_quantity NUMERIC,
  detected_unit TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_match_logs_needs_review ON fnb_ai_match_logs(needs_review) WHERE needs_review = true;
CREATE INDEX idx_match_logs_customer ON fnb_ai_match_logs(customer_id);
CREATE INDEX idx_match_logs_created ON fnb_ai_match_logs(created_at DESC);

-- Enable RLS
ALTER TABLE fnb_ai_match_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can manage
CREATE POLICY "Authenticated users can view match logs"
ON fnb_ai_match_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert match logs"
ON fnb_ai_match_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update match logs"
ON fnb_ai_match_logs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete match logs"
ON fnb_ai_match_logs FOR DELETE
TO authenticated
USING (true);