-- Table to store detected order anomalies
CREATE TABLE public.distribution_order_anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.distribution_customers(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('missing_order', 'missing_item', 'quantity_change', 'inactive_customer')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expected_date DATE,
  details JSONB DEFAULT '{}',
  suggested_message_en TEXT,
  suggested_message_pap TEXT,
  suggested_message_nl TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'resolved', 'dismissed')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table to store learned customer order schedules
CREATE TABLE public.distribution_customer_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.distribution_customers(id) ON DELETE CASCADE UNIQUE,
  expected_order_days INTEGER[] DEFAULT '{}',
  typical_order_time TIME,
  confidence_score NUMERIC DEFAULT 0,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  total_orders_analyzed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distribution_order_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_customer_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for anomalies
CREATE POLICY "Allow authenticated users to view anomalies"
  ON public.distribution_order_anomalies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert anomalies"
  ON public.distribution_order_anomalies FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update anomalies"
  ON public.distribution_order_anomalies FOR UPDATE
  TO authenticated USING (true);

-- RLS policies for schedules
CREATE POLICY "Allow authenticated users to view schedules"
  ON public.distribution_customer_schedules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert schedules"
  ON public.distribution_customer_schedules FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update schedules"
  ON public.distribution_customer_schedules FOR UPDATE
  TO authenticated USING (true);

-- Allow service role full access for edge functions
CREATE POLICY "Allow service role full access to anomalies"
  ON public.distribution_order_anomalies FOR ALL
  USING (true);

CREATE POLICY "Allow service role full access to schedules"
  ON public.distribution_customer_schedules FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX idx_anomalies_customer ON public.distribution_order_anomalies(customer_id);
CREATE INDEX idx_anomalies_status ON public.distribution_order_anomalies(status);
CREATE INDEX idx_anomalies_detected_at ON public.distribution_order_anomalies(detected_at DESC);
CREATE INDEX idx_anomalies_type ON public.distribution_order_anomalies(anomaly_type);
CREATE INDEX idx_schedules_customer ON public.distribution_customer_schedules(customer_id);

-- Enable realtime for anomalies
ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_order_anomalies;