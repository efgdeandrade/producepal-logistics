
-- Create cif_exports table
CREATE TABLE public.cif_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_order_id TEXT NOT NULL,
  cif_version_id UUID REFERENCES public.cif_versions(id),
  export_type TEXT NOT NULL CHECK (export_type IN ('estimate', 'actual', 'full')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.cif_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with CIF view role can read exports"
  ON public.cif_exports FOR SELECT
  USING (public.has_cif_view_role(auth.uid()));

CREATE POLICY "Users with CIF edit role can create exports"
  ON public.cif_exports FOR INSERT
  WITH CHECK (public.has_cif_edit_role(auth.uid()));

-- Create cif_audits table
CREATE TABLE public.cif_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_order_id TEXT NOT NULL,
  cif_version_id UUID REFERENCES public.cif_versions(id),
  audit_status TEXT NOT NULL DEFAULT 'pending',
  issues_json JSONB,
  summary_text TEXT,
  lovable_fix_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  model_used TEXT,
  input_hash TEXT
);

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

-- Create storage bucket for CIF exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('cif-exports', 'cif-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cif-exports bucket
CREATE POLICY "CIF view role can read exports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cif-exports' AND public.has_cif_view_role(auth.uid()));

CREATE POLICY "CIF edit role can upload exports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cif-exports' AND public.has_cif_edit_role(auth.uid()));
