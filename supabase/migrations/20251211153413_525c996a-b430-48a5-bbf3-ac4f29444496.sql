-- Fix overly permissive RLS policy on fnb_customer_patterns
-- Restrict SELECT access to admin and management roles only

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view fnb patterns" ON fnb_customer_patterns;

-- Create role-restricted policy for viewing F&B customer patterns
CREATE POLICY "Authorized roles can view fnb patterns"
ON fnb_customer_patterns FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
);