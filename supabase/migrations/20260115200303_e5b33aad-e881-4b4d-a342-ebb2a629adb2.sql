-- Fix distribution_product_aliases public exposure
DROP POLICY IF EXISTS "Anyone can view product aliases" ON distribution_product_aliases;
DROP POLICY IF EXISTS "Allow select for all users" ON distribution_product_aliases;
DROP POLICY IF EXISTS "Enable read access for all users" ON distribution_product_aliases;

-- Authenticated users can read product aliases (needed for order matching)
CREATE POLICY "Authenticated users can read product aliases"
  ON distribution_product_aliases FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify product aliases
CREATE POLICY "Admin/management can manage product aliases"
  ON distribution_product_aliases FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );