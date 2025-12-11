-- Fix overly permissive RLS policy on fnb_conversations
-- Restrict SELECT access to admin, management, and production roles only

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view fnb conversations" ON fnb_conversations;

-- Create role-restricted policy for viewing F&B conversations
CREATE POLICY "Authorized roles can view fnb conversations"
ON fnb_conversations FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'production'::app_role)
);