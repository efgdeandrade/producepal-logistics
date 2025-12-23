-- Phase 2: Create assistance queue table for picker help requests
CREATE TABLE public.fnb_assistance_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picker_queue_id uuid REFERENCES fnb_picker_queue(id) ON DELETE CASCADE,
  picker_name text NOT NULL,
  reason text NOT NULL,
  notes text,
  status text DEFAULT 'pending', -- pending, acknowledged, resolved
  created_at timestamptz DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

-- Enable RLS
ALTER TABLE public.fnb_assistance_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view assistance queue"
ON public.fnb_assistance_queue FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized roles can manage assistance queue"
ON public.fnb_assistance_queue FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

-- Add alert tracking to order items (non-blocking alerts)
ALTER TABLE fnb_order_items ADD COLUMN IF NOT EXISTS shortage_alerted_at timestamptz;

-- Enable realtime for assistance queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.fnb_assistance_queue;

-- Comment
COMMENT ON TABLE public.fnb_assistance_queue IS 'Queue for picker assistance requests - non-blocking alerts for supervisors';