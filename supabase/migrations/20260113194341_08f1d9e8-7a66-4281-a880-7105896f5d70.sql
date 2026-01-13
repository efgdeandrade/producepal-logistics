-- Add is_sandbox column to quickbooks_tokens table
ALTER TABLE public.quickbooks_tokens 
ADD COLUMN IF NOT EXISTS is_sandbox boolean DEFAULT true;

-- Update existing tokens to sandbox (since we know the current connection is sandbox)
UPDATE public.quickbooks_tokens SET is_sandbox = true WHERE is_sandbox IS NULL;