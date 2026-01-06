-- Create whatsapp_messages table for message history
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  message_id TEXT UNIQUE,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'order', 'template')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  customer_id UUID REFERENCES public.fnb_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.fnb_orders(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create external_integrations table for managing connections
CREATE TABLE public.external_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'quickbooks', 'custom_api', 'email', 'sms')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create webhook_configs table
CREATE TABLE public.webhook_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_messages (authenticated users can manage)
CREATE POLICY "Authenticated users can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated USING (true);

-- RLS Policies for external_integrations (admin only)
CREATE POLICY "Admins can view integrations"
  ON public.external_integrations FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert integrations"
  ON public.external_integrations FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update integrations"
  ON public.external_integrations FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete integrations"
  ON public.external_integrations FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for webhook_configs (admin only)
CREATE POLICY "Admins can view webhook configs"
  ON public.webhook_configs FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert webhook configs"
  ON public.webhook_configs FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update webhook configs"
  ON public.webhook_configs FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete webhook configs"
  ON public.webhook_configs FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for webhook_logs (admin only)
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_customer ON public.whatsapp_messages(customer_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_external_integrations_type ON public.external_integrations(type);
CREATE INDEX idx_webhook_logs_webhook ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);

-- Add updated_at triggers
CREATE TRIGGER update_external_integrations_updated_at
  BEFORE UPDATE ON public.external_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();