-- Fix overly permissive RLS policy on fnb_picker_queue
-- Restrict management access to admin, management, and production roles only

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage picker queue" ON fnb_picker_queue;

-- Create role-restricted policy for managing picker queue
CREATE POLICY "Authorized roles can manage picker queue"
ON fnb_picker_queue FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'production'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'production'::app_role)
);