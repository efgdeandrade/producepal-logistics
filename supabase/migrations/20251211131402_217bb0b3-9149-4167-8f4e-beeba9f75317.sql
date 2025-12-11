-- Fix bill_approvals table - overly permissive INSERT policy
-- Drop the current policy that allows any authenticated user to create approvals
DROP POLICY IF EXISTS "System can create approvals" ON bill_approvals;

-- Create a restricted policy allowing only authorized roles to create approvals
CREATE POLICY "Authorized users can create approvals" ON bill_approvals
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  has_role(auth.uid(), 'accounting'::app_role)
);