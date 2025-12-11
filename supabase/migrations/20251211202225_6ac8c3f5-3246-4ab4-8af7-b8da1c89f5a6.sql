-- Remove the overly permissive INSERT policy on product_price_history
-- The trigger function log_product_price_change() runs as SECURITY DEFINER
-- and will still be able to insert records automatically on price changes
DROP POLICY IF EXISTS "System can insert price history" ON public.product_price_history;

-- Create a restrictive policy that only allows admin/management to insert directly (if ever needed)
CREATE POLICY "Admin/management can insert price history"
ON public.product_price_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role)
);