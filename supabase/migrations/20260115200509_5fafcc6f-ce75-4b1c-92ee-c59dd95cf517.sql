-- Fix remaining public exposure issues for critical tables

-- ============================================
-- distribution_customers - Customer contact information (WhatsApp, addresses, GPS)
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON distribution_customers;
DROP POLICY IF EXISTS "Anyone can view distribution customers" ON distribution_customers;
DROP POLICY IF EXISTS "check_permission" ON distribution_customers;

-- Admin/management full access
CREATE POLICY "Admin/management full access to distribution customers"
  ON distribution_customers FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Drivers can view customer info for deliveries
CREATE POLICY "Drivers can view distribution customers"
  ON distribution_customers FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- ============================================
-- employees - Employee personal information
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
DROP POLICY IF EXISTS "Anyone can view employees" ON employees;
DROP POLICY IF EXISTS "Employees are viewable by authenticated users" ON employees;

-- Admin/HR full access
CREATE POLICY "Admin/HR full access to employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'hr'::app_role)
  );

-- Management can view employees
CREATE POLICY "Management can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- ============================================
-- driver_wallets - Financial balances
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON driver_wallets;
DROP POLICY IF EXISTS "Anyone can view driver wallets" ON driver_wallets;

-- Admin/management full access
CREATE POLICY "Admin/management full access to driver wallets"
  ON driver_wallets FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- ============================================
-- orders - Order history
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON orders;

-- Admin/management full access
CREATE POLICY "Admin/management full access to orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Drivers can view orders
CREATE POLICY "Drivers can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- Production staff can view orders
CREATE POLICY "Production can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'production'::app_role)
  );

-- ============================================
-- distribution_conversations - Customer conversation data
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON distribution_conversations;
DROP POLICY IF EXISTS "Anyone can view distribution conversations" ON distribution_conversations;

-- Admin/management full access
CREATE POLICY "Admin/management full access to distribution conversations"
  ON distribution_conversations FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );