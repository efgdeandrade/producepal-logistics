-- Fix suppliers table RLS to restrict access to management roles only
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

CREATE POLICY "Authorized roles can view suppliers"
ON public.suppliers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'logistics'::app_role)
);