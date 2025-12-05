-- Fix customers table RLS to restrict PII access to appropriate roles
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "Authorized roles can view customers"
ON public.customers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'logistics'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
);

-- Fix bills table RLS to restrict financial data to appropriate roles
DROP POLICY IF EXISTS "Authenticated users can view bills" ON public.bills;

CREATE POLICY "Authorized roles can view bills"
ON public.bills
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
);