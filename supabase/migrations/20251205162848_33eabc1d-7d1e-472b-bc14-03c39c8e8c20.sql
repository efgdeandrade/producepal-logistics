-- Drop the overly permissive SELECT policy on orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;

-- Create a more restrictive SELECT policy
-- Users can only view: their own orders, or if they are admin/management
CREATE POLICY "Users can view relevant orders"
ON public.orders
FOR SELECT
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'logistics'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
);