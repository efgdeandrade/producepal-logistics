-- Fix remaining public exposure issues for distribution_customer_schedules and distribution_order_anomalies

-- ============================================
-- distribution_customer_schedules - Already addressed, but need to ensure no public access
-- ============================================
-- Drop any existing permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Admin/management full access to customer schedules" ON distribution_customer_schedules;

-- Only admin/management can access customer schedules
CREATE POLICY "Admin/management full access to customer schedules"
  ON distribution_customer_schedules FOR ALL
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
-- distribution_order_anomalies - Customer behavior intelligence
-- ============================================
-- Drop any existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Allow service role full access" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "Allow authenticated full access" ON distribution_order_anomalies;

-- Only admin/management can access order anomalies
CREATE POLICY "Admin/management full access to order anomalies"
  ON distribution_order_anomalies FOR ALL
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
-- distribution_response_templates - Chatbot templates
-- ============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON distribution_response_templates;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_response_templates;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_response_templates;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_response_templates;

-- Everyone can read templates for the chatbot
CREATE POLICY "Authenticated users can read response templates"
  ON distribution_response_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify templates
CREATE POLICY "Admin/management can manage response templates"
  ON distribution_response_templates FOR ALL
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
-- distribution_translations - Translations
-- ============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON distribution_translations;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_translations;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_translations;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_translations;

-- Everyone can read translations
CREATE POLICY "Authenticated users can read translations"
  ON distribution_translations FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify translations
CREATE POLICY "Admin/management can manage translations"
  ON distribution_translations FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );