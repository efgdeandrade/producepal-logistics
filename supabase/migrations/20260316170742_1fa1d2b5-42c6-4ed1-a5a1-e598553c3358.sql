-- Create order-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-media', 'order-media', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for service role access
CREATE POLICY "Service role can manage order-media" ON storage.objects
  FOR ALL USING (bucket_id = 'order-media')
  WITH CHECK (bucket_id = 'order-media');

-- Add shopify_customer_id to distribution_customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'distribution_customers' AND column_name = 'shopify_customer_id') THEN
    ALTER TABLE public.distribution_customers ADD COLUMN shopify_customer_id text;
  END IF;
END $$;