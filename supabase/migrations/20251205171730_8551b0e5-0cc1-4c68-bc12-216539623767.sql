-- Fix products table RLS to restrict pricing data access to appropriate roles
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

CREATE POLICY "Authorized roles can view products"
ON public.products
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
  OR has_role(auth.uid(), 'logistics'::app_role)
  OR has_role(auth.uid(), 'production'::app_role)
);