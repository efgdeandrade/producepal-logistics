-- Add columns for Gmail health tracking
ALTER TABLE public.gmail_credentials 
ADD COLUMN IF NOT EXISTS needs_reauth boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error text;