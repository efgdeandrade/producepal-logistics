-- Create CIF Audit Log table for tracking all calculation inputs/outputs
CREATE TABLE public.cif_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text NOT NULL,
  calculation_type text NOT NULL CHECK (calculation_type IN ('estimate', 'actual')),
  calculation_timestamp timestamptz NOT NULL DEFAULT now(),
  exchange_rate_used numeric NOT NULL,
  total_freight_usd numeric NOT NULL,
  distribution_method text NOT NULL,
  blend_ratio numeric,
  products_input jsonb NOT NULL,
  products_output jsonb NOT NULL,
  validation_status text NOT NULL DEFAULT 'passed' CHECK (validation_status IN ('passed', 'warnings', 'failed')),
  validation_messages jsonb DEFAULT '[]'::jsonb,
  learning_adjustments_applied jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create CIF Anomalies table for flagging suspicious variances
CREATE TABLE public.cif_anomalies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text NOT NULL,
  product_code text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  estimated_cif_xcg numeric NOT NULL,
  actual_cif_xcg numeric NOT NULL,
  variance_percentage numeric NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('high_variance', 'negative_margin', 'missing_data', 'learning_cap_exceeded')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  excluded_from_learning boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.cif_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS policies for cif_audit_log - use has_role function for proper access control
CREATE POLICY "Authorized users can view audit logs" ON public.cif_audit_log
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'management'::app_role) OR
    public.has_role(auth.uid(), 'logistics'::app_role)
  );

CREATE POLICY "Authenticated users can create audit logs" ON public.cif_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for cif_anomalies
CREATE POLICY "Authorized users can view anomalies" ON public.cif_anomalies
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'management'::app_role) OR
    public.has_role(auth.uid(), 'logistics'::app_role)
  );

CREATE POLICY "Authenticated users can create anomalies" ON public.cif_anomalies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update anomalies" ON public.cif_anomalies
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Create indexes for efficient querying
CREATE INDEX idx_cif_audit_log_order_id ON public.cif_audit_log(order_id);
CREATE INDEX idx_cif_audit_log_created_at ON public.cif_audit_log(created_at DESC);
CREATE INDEX idx_cif_anomalies_order_id ON public.cif_anomalies(order_id);
CREATE INDEX idx_cif_anomalies_reviewed ON public.cif_anomalies(reviewed) WHERE reviewed = false;
CREATE INDEX idx_cif_anomalies_severity ON public.cif_anomalies(severity);