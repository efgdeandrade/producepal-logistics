-- Fix fnb_customers table - overly permissive SELECT policy
-- Drop the current policy that allows any authenticated user to view customer data
DROP POLICY IF EXISTS "Authenticated users can view fnb customers" ON fnb_customers;

-- Create a restricted policy allowing only authorized business roles to view F&B customers
CREATE POLICY "Authorized roles can view fnb customers" ON fnb_customers
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  has_role(auth.uid(), 'production'::app_role)
);