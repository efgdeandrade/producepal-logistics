-- Fix fnb_customer_patterns - only add management policy (SELECT already exists)
DROP POLICY IF EXISTS "System can manage fnb patterns" ON fnb_customer_patterns;
CREATE POLICY "Management can manage fnb patterns" ON fnb_customer_patterns
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role)
);