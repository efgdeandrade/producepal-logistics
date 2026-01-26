-- Create table for pending/draft order sessions
CREATE TABLE public.distribution_order_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.distribution_customers(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  parsed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_language TEXT DEFAULT 'en',
  conversation_snapshot JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_session_status CHECK (status IN ('pending_confirmation', 'confirmed', 'expired', 'abandoned'))
);

-- Enable RLS
ALTER TABLE public.distribution_order_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage sessions
CREATE POLICY "Authenticated users can manage order sessions"
ON public.distribution_order_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_order_sessions_phone ON public.distribution_order_sessions(customer_phone);
CREATE INDEX idx_order_sessions_status ON public.distribution_order_sessions(status) WHERE status = 'pending_confirmation';
CREATE INDEX idx_order_sessions_expires ON public.distribution_order_sessions(expires_at) WHERE status = 'pending_confirmation';

-- Add trigger for updated_at
CREATE TRIGGER update_order_sessions_updated_at
BEFORE UPDATE ON public.distribution_order_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_order_sessions;

COMMENT ON TABLE public.distribution_order_sessions IS 'Tracks incomplete order sessions for follow-up reminders';
COMMENT ON COLUMN public.distribution_order_sessions.expires_at IS 'When this session should trigger a follow-up reminder';