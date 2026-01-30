-- Fix order_items RLS policy for INSERT operations
-- The existing policy uses ALL but lacks WITH CHECK clause for inserts

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can manage order items for their orders" ON public.order_items;

-- Create separate policies for each operation with proper WITH CHECK clauses

-- SELECT: Allow users to view order items for orders they have access to
CREATE POLICY "Users can view order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
      OR has_role(auth.uid(), 'logistics'::app_role)
      OR has_role(auth.uid(), 'accounting'::app_role)
    )
  )
);

-- INSERT: Allow users to insert order items for orders they own or have admin/management roles
CREATE POLICY "Users can insert order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
    )
  )
);

-- UPDATE: Allow users to update order items for their orders
CREATE POLICY "Users can update order items"
ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
    )
  )
);

-- DELETE: Allow users to delete order items for their orders
CREATE POLICY "Users can delete order items"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
    )
  )
);