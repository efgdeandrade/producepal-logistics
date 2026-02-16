
-- Add missing columns to cif_exports
ALTER TABLE public.cif_exports 
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT '2026-02-16_v1',
  ADD COLUMN IF NOT EXISTS input_hash TEXT NOT NULL DEFAULT '';

-- Drop and recreate cif_audits with correct schema
DROP TABLE IF EXISTS public.cif_audits;

CREATE TABLE public.cif_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_order_id TEXT NOT NULL,
  cif_version_id UUID NOT NULL REFERENCES public.cif_versions(id),
  engine_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  audit_status TEXT NOT NULL DEFAULT 'pending',
  summary_text TEXT,
  issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  fix_prompt TEXT DEFAULT '',
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Unique index on input_hash for caching
CREATE UNIQUE INDEX idx_cif_audits_input_hash ON public.cif_audits(input_hash);

ALTER TABLE public.cif_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with CIF view role can read audits"
  ON public.cif_audits FOR SELECT
  USING (public.has_cif_view_role(auth.uid()));

CREATE POLICY "Users with CIF edit role can create audits"
  ON public.cif_audits FOR INSERT
  WITH CHECK (public.has_cif_edit_role(auth.uid()));

CREATE POLICY "Users with CIF edit role can update audits"
  ON public.cif_audits FOR UPDATE
  USING (public.has_cif_edit_role(auth.uid()));

-- Also fix cif_exports import_order_id to TEXT (already is) and created_by to TEXT
-- The created_by was UUID, change to TEXT for email storage
ALTER TABLE public.cif_exports ALTER COLUMN created_by TYPE TEXT;
