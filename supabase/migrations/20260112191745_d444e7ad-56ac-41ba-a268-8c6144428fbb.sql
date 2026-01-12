-- Add unique constraint on realm_id for upsert operations
ALTER TABLE public.quickbooks_tokens ADD CONSTRAINT quickbooks_tokens_realm_id_key UNIQUE (realm_id);