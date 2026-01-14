-- Update products RLS policies to use check_permission function
-- This allows the interim role (and any role with data permissions) to manage products

-- Drop existing hardcoded policies
DROP POLICY IF EXISTS "Admins and management can manage products" ON products;
DROP POLICY IF EXISTS "Authorized roles can view products" ON products;

-- Create new flexible policies using check_permission function
CREATE POLICY "Users can view products based on permissions"
ON products
FOR SELECT
TO authenticated
USING (public.check_permission('data', 'view'));

CREATE POLICY "Users can create products based on permissions"
ON products
FOR INSERT
TO authenticated
WITH CHECK (public.check_permission('data', 'create'));

CREATE POLICY "Users can update products based on permissions"
ON products
FOR UPDATE
TO authenticated
USING (public.check_permission('data', 'update'));

CREATE POLICY "Users can delete products based on permissions"
ON products
FOR DELETE
TO authenticated
USING (public.check_permission('data', 'delete'));