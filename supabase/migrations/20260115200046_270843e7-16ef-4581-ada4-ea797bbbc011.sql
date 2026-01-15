-- Fix public exposure for customers and employee_documents tables

-- ============================================
-- customers - Customer contact information (standard business table, not distribution)
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;

-- Only authenticated users with proper roles can access customers
CREATE POLICY "Admin/management full access to customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Drivers can view customers for delivery purposes
CREATE POLICY "Drivers can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- ============================================
-- employee_documents - HR sensitive documents
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_documents;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON employee_documents;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON employee_documents;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON employee_documents;

-- Only HR/admin can manage documents
CREATE POLICY "Admin/HR full access to employee documents"
  ON employee_documents FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'hr'::app_role)
  );