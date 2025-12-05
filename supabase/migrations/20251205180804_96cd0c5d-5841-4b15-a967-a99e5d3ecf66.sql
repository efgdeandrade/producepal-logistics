-- Fix bills storage bucket RLS to restrict access to appropriate roles
DROP POLICY IF EXISTS "Authenticated users can view bills" ON storage.objects;

CREATE POLICY "Authorized roles can view bills"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bills'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'accounting'::app_role)
  )
);