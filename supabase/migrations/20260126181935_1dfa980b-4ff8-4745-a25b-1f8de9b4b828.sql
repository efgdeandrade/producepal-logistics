-- Create table for WhatsApp health check history
CREATE TABLE public.whatsapp_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_type TEXT NOT NULL DEFAULT 'api_status',
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'failed'
  response_time_ms INTEGER,
  error_message TEXT,
  error_code TEXT,
  token_valid BOOLEAN,
  phone_number_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_health_checks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with admin/management roles to view
CREATE POLICY "Admins can view health checks"
ON public.whatsapp_health_checks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management')
  )
);

-- Create index for efficient querying
CREATE INDEX idx_whatsapp_health_checks_created_at ON public.whatsapp_health_checks(created_at DESC);
CREATE INDEX idx_whatsapp_health_checks_status ON public.whatsapp_health_checks(status);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_health_checks;