-- Drop the overly permissive INSERT policy on user_activity
DROP POLICY IF EXISTS "All authenticated users can insert activity" ON public.user_activity;

-- Create a more restrictive INSERT policy
-- Users can only insert activity records for themselves
CREATE POLICY "Users can only log their own activity"
ON public.user_activity
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);