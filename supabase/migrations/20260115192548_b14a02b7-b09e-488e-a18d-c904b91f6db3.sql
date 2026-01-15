-- Fix overly permissive RLS policies on distribution tables
-- Replace USING(true) policies with role-based access control

-- ============================================
-- distribution_invoices - Sensitive financial data
-- ============================================
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_invoices;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to view invoices" ON distribution_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to manage invoices" ON distribution_invoices;

-- Admin/management can do everything
CREATE POLICY "Admin/management full access to invoices"
  ON distribution_invoices FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

-- Drivers can view invoices for their deliveries (read-only)
CREATE POLICY "Drivers can view invoices for orders"
  ON distribution_invoices FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- ============================================
-- distribution_invoice_items - Invoice line items
-- ============================================
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON distribution_invoice_items;
DROP POLICY IF EXISTS "Allow authenticated users to view invoice items" ON distribution_invoice_items;

CREATE POLICY "Admin/management full access to invoice items"
  ON distribution_invoice_items FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

CREATE POLICY "Drivers can view invoice items"
  ON distribution_invoice_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- ============================================
-- distribution_invoice_orders - Invoice-order relationship
-- ============================================
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON distribution_invoice_orders;
DROP POLICY IF EXISTS "Allow authenticated users to view invoice orders" ON distribution_invoice_orders;

CREATE POLICY "Admin/management full access to invoice orders"
  ON distribution_invoice_orders FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );

CREATE POLICY "Drivers can view invoice orders"
  ON distribution_invoice_orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::app_role)
  );

-- ============================================
-- distribution_invoice_activity - Audit logs
-- ============================================
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_invoice_activity;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_invoice_activity;

CREATE POLICY "Admin/management full access to invoice activity"
  ON distribution_invoice_activity FOR ALL
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
-- distribution_ai_match_logs - AI training data (sensitive)
-- ============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON distribution_ai_match_logs;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_ai_match_logs;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_ai_match_logs;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_ai_match_logs;

CREATE POLICY "Admin/management full access to AI match logs"
  ON distribution_ai_match_logs FOR ALL
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
-- distribution_customer_schedules - Customer patterns
-- ============================================
DROP POLICY IF EXISTS "Allow service role full access" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "Allow authenticated full access" ON distribution_customer_schedules;

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
-- distribution_context_words - Dictionary (read access for all, write for admin)
-- ============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON distribution_context_words;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_context_words;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_context_words;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_context_words;

-- Everyone can read the dictionary
CREATE POLICY "Authenticated users can read context words"
  ON distribution_context_words FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify
CREATE POLICY "Admin/management can manage context words"
  ON distribution_context_words FOR ALL
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
-- distribution_conversation_intents - Chatbot config
-- ============================================
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON distribution_conversation_intents;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON distribution_conversation_intents;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON distribution_conversation_intents;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON distribution_conversation_intents;

-- Everyone can read intents for the chatbot
CREATE POLICY "Authenticated users can read conversation intents"
  ON distribution_conversation_intents FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify
CREATE POLICY "Admin/management can manage conversation intents"
  ON distribution_conversation_intents FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role)
  );