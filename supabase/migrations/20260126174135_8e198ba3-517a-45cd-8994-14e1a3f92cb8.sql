-- Add proximity columns to distribution_customers
ALTER TABLE public.distribution_customers
ADD COLUMN IF NOT EXISTS distance_to_dc_meters NUMERIC,
ADD COLUMN IF NOT EXISTS is_close_proximity BOOLEAN DEFAULT false;

-- Add order timing columns to distribution_customer_schedules
ALTER TABLE public.distribution_customer_schedules
ADD COLUMN IF NOT EXISTS typical_delivery_type TEXT,
ADD COLUMN IF NOT EXISTS typical_order_hour INTEGER,
ADD COLUMN IF NOT EXISTS order_time_consistency NUMERIC;

-- Create Dre outreach log table for sales attribution tracking
CREATE TABLE IF NOT EXISTS public.dre_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.distribution_customers(id) ON DELETE CASCADE,
  anomaly_id UUID REFERENCES public.distribution_order_anomalies(id) ON DELETE SET NULL,
  outreach_type TEXT NOT NULL,
  outreach_timing TEXT,
  message_sent TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  sent_at TIMESTAMPTZ DEFAULT now(),
  customer_responded BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  order_generated_id UUID,
  order_revenue NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add dre_outreach_id to distribution_orders for attribution
ALTER TABLE public.distribution_orders
ADD COLUMN IF NOT EXISTS dre_outreach_id UUID REFERENCES public.dre_outreach_log(id) ON DELETE SET NULL;

-- Add foreign key for order_generated_id after orders table reference is possible
ALTER TABLE public.dre_outreach_log
ADD CONSTRAINT fk_order_generated
FOREIGN KEY (order_generated_id) REFERENCES public.distribution_orders(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dre_outreach_customer ON public.dre_outreach_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_dre_outreach_status ON public.dre_outreach_log(status);
CREATE INDEX IF NOT EXISTS idx_dre_outreach_sent_at ON public.dre_outreach_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_orders_dre_outreach ON public.distribution_orders(dre_outreach_id);

-- Enable RLS on dre_outreach_log
ALTER TABLE public.dre_outreach_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for dre_outreach_log (admin/management/logistics can view and manage)
CREATE POLICY "Admin and management can view dre outreach logs"
ON public.dre_outreach_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management', 'logistics', 'accounting')
  )
);

CREATE POLICY "Admin and management can insert dre outreach logs"
ON public.dre_outreach_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management', 'logistics')
  )
);

CREATE POLICY "Admin and management can update dre outreach logs"
ON public.dre_outreach_log FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management', 'logistics')
  )
);

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to dre outreach logs"
ON public.dre_outreach_log FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable realtime for dre_outreach_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_outreach_log;

-- Create trigger for updated_at
CREATE TRIGGER update_dre_outreach_log_updated_at
BEFORE UPDATE ON public.dre_outreach_log
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();