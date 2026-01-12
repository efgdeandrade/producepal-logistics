-- Create table to store QuickBooks OAuth tokens
CREATE TABLE public.quickbooks_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin access only" ON public.quickbooks_tokens
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_quickbooks_tokens_updated_at
  BEFORE UPDATE ON public.quickbooks_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();