-- Fix fnb_order_items - restrict ALL operations to management roles
DROP POLICY IF EXISTS "Authenticated users can manage fnb order items" ON fnb_order_items;

CREATE POLICY "Management can manage fnb order items" ON fnb_order_items
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role)
);