-- Drop the overly permissive ALL policy on weight_learning_patterns
DROP POLICY IF EXISTS "System can manage learning patterns" ON public.weight_learning_patterns;

-- Create restrictive policies for write operations
-- Edge functions use service role which bypasses RLS, so we only need to restrict regular users
CREATE POLICY "Management can manage learning patterns"
ON public.weight_learning_patterns
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
);