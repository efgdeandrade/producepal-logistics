-- ============================================
-- Email Inbox System - Phase 1 Database Schema
-- ============================================

-- Gmail credentials storage (encrypted tokens)
CREATE TABLE public.gmail_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  watch_expiration TIMESTAMPTZ,
  history_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email inbox - stores all incoming emails
CREATE TABLE public.email_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'pending_review', 'confirmed', 'declined', 'error')),
  matched_customer_id UUID REFERENCES public.distribution_customers(id),
  linked_order_id UUID,
  extracted_data JSONB DEFAULT '{}',
  extraction_confidence DECIMAL(5,2),
  error_message TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  declined_at TIMESTAMPTZ,
  declined_by UUID,
  confirmation_email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email attachments
CREATE TABLE public.email_inbox_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.email_inbox(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  extracted_data JSONB DEFAULT '{}',
  extraction_confidence DECIMAL(5,2),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email confirmation templates
CREATE TABLE public.email_confirmation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add source_email_id to distribution_orders for bidirectional linking
ALTER TABLE public.distribution_orders 
ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES public.email_inbox(id);

-- Add foreign key for linked_order_id after distribution_orders column exists
ALTER TABLE public.email_inbox
ADD CONSTRAINT email_inbox_linked_order_id_fkey 
FOREIGN KEY (linked_order_id) REFERENCES public.distribution_orders(id);

-- Create indexes for performance
CREATE INDEX idx_email_inbox_status ON public.email_inbox(status);
CREATE INDEX idx_email_inbox_received_at ON public.email_inbox(received_at DESC);
CREATE INDEX idx_email_inbox_from_email ON public.email_inbox(from_email);
CREATE INDEX idx_email_inbox_matched_customer ON public.email_inbox(matched_customer_id);
CREATE INDEX idx_email_attachments_email_id ON public.email_inbox_attachments(email_id);
CREATE INDEX idx_distribution_orders_source_email ON public.distribution_orders(source_email_id);

-- Enable RLS
ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_inbox_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_confirmation_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gmail_credentials (admin only - contains sensitive tokens)
CREATE POLICY "Admin only access to gmail credentials"
  ON public.gmail_credentials FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_inbox
CREATE POLICY "Admin/management full access to email inbox"
  ON public.email_inbox FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- RLS Policies for email_inbox_attachments
CREATE POLICY "Admin/management full access to email attachments"
  ON public.email_inbox_attachments FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- RLS Policies for email_confirmation_templates
CREATE POLICY "Admin/management full access to email templates"
  ON public.email_confirmation_templates FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Enable realtime for email_inbox (for live updates in UI)
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_inbox;

-- Trigger for updated_at
CREATE TRIGGER update_gmail_credentials_updated_at
  BEFORE UPDATE ON public.gmail_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_inbox_updated_at
  BEFORE UPDATE ON public.email_inbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_confirmation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default confirmation template
INSERT INTO public.email_confirmation_templates (name, description, subject_template, body_template, is_default, is_active)
VALUES (
  'Order Confirmed',
  'Default template sent when an order is confirmed from email',
  'Order Confirmed - #{order_number}',
  E'Dear {customer_name},\n\nThank you for your order!\n\nWe have received and confirmed your order #{order_number} for delivery on {delivery_date}.\n\nOrder Summary:\n{items_table}\n\nIf you have any questions, please reply to this email or contact us.\n\nBest regards,\nFuik Distribution',
  true,
  true
);