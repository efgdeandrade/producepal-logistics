-- Fix RLS policies for distribution_customer_schedules table
-- Risk: Customer ordering patterns exposed to all authenticated users

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to view schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Allow authenticated users to update schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Allow authenticated users to insert schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON distribution_customer_schedules;

-- Create role-restricted policies for distribution_customer_schedules
CREATE POLICY "schedules_select_admin_mgmt"
  ON distribution_customer_schedules FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "schedules_insert_admin_mgmt"
  ON distribution_customer_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "schedules_update_admin_mgmt"
  ON distribution_customer_schedules FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

-- Fix RLS policies for distribution_order_anomalies table
-- Risk: Customer behavior issues and internal notes exposed to all authenticated users

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to view anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Allow authenticated users to update anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Allow authenticated users to insert anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Authenticated users can view anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Authenticated users can update anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Authenticated users can insert anomalies" ON distribution_order_anomalies;

-- Create role-restricted policies for distribution_order_anomalies
CREATE POLICY "anomalies_select_admin_mgmt"
  ON distribution_order_anomalies FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "anomalies_insert_admin_mgmt"
  ON distribution_order_anomalies FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "anomalies_update_admin_mgmt"
  ON distribution_order_anomalies FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );