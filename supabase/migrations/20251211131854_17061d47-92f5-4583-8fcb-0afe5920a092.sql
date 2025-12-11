-- Fix invoices table - overly permissive SELECT policy
-- Drop the current policy that allows any authenticated user to view invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;

-- Create a restricted policy allowing only authorized financial roles to view invoices
CREATE POLICY "Authorized roles can view invoices" ON invoices
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  has_role(auth.uid(), 'accounting'::app_role)
);