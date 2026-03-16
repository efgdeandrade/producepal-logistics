
-- ═══════════════════════════════════════════════════════════
-- PART A — ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════

-- A.1 distribution_customers
ALTER TABLE distribution_customers
  ADD COLUMN IF NOT EXISTS zone text CHECK (zone IN ('pariba','meimei','pabou')),
  ADD COLUMN IF NOT EXISTS payment_terms text CHECK (payment_terms IN ('cod_cash','cod_swipe','net7','net15','net30')),
  ADD COLUMN IF NOT EXISTS telegram_chat_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS shopify_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS qb_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS order_pattern_baseline jsonb;

-- A.2 distribution_orders
ALTER TABLE distribution_orders
  ADD COLUMN IF NOT EXISTS source_channel text CHECK (source_channel IN ('telegram','email_po','shopify','manual','whatsapp')),
  ADD COLUMN IF NOT EXISTS is_late_order boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_order_manager_decision text DEFAULT 'pending' CHECK (late_order_manager_decision IN ('approved','declined','pending')),
  ADD COLUMN IF NOT EXISTS late_order_decided_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS late_order_decided_at timestamptz;

-- A.3 distribution_products
ALTER TABLE distribution_products
  ADD COLUMN IF NOT EXISTS name_aliases text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS case_length_cm numeric,
  ADD COLUMN IF NOT EXISTS case_width_cm numeric,
  ADD COLUMN IF NOT EXISTS case_height_cm numeric,
  ADD COLUMN IF NOT EXISTS gross_weight_per_case_kg numeric,
  ADD COLUMN IF NOT EXISTS units_per_case integer,
  ADD COLUMN IF NOT EXISTS unit_of_sale text CHECK (unit_of_sale IN ('kg','bunch','piece'));

-- A.4 driver_wallets
ALTER TABLE driver_wallets
  ADD COLUMN IF NOT EXISTS total_swipe_collected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervisor_verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS supervisor_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_deposited_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS manager_deposited_at timestamptz;

-- A.5 profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS phone text;

-- ═══════════════════════════════════════════════════════════
-- PART B — CREATE NEW TABLES
-- ═══════════════════════════════════════════════════════════

-- B.1 pending_customers
CREATE TABLE IF NOT EXISTS pending_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id text UNIQUE,
  whatsapp_number text,
  detected_language text,
  first_message text,
  status text DEFAULT 'unlinked' CHECK (status IN ('unlinked','linked','rejected')),
  linked_customer_id uuid REFERENCES distribution_customers(id),
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE pending_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_customers_staff ON pending_customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));

-- B.2 dre_conversations
CREATE TABLE IF NOT EXISTS dre_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES distribution_customers(id),
  pending_customer_id uuid REFERENCES pending_customers(id),
  channel text CHECK (channel IN ('telegram','whatsapp')),
  external_chat_id text NOT NULL,
  control_status text DEFAULT 'dre_active' CHECK (control_status IN ('dre_active','human_in_control','escalated')),
  assigned_agent_id uuid REFERENCES profiles(id),
  language_detected text CHECK (language_detected IN ('papiamentu','dutch','english','spanish')),
  is_proactive_outreach boolean DEFAULT false,
  anomaly_type text CHECK (anomaly_type IN ('time_based','volume_based')),
  order_id uuid REFERENCES distribution_orders(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE dre_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dre_conversations_staff ON dre_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));
ALTER PUBLICATION supabase_realtime ADD TABLE dre_conversations;

-- B.3 dre_messages
CREATE TABLE IF NOT EXISTS dre_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES dre_conversations(id) ON DELETE CASCADE,
  role text CHECK (role IN ('dre','customer','agent')),
  content text NOT NULL,
  media_type text CHECK (media_type IN ('text','voice','image','file')),
  media_url text,
  language_detected text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dre_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY dre_messages_staff ON dre_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));
ALTER PUBLICATION supabase_realtime ADD TABLE dre_messages;

-- B.4 invoice_number_seq
CREATE TABLE IF NOT EXISTS invoice_number_seq (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_number integer NOT NULL DEFAULT 1000,
  prefix text NOT NULL DEFAULT 'FUIK'
);
ALTER TABLE invoice_number_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_seq_read ON invoice_number_seq FOR SELECT TO authenticated USING (true);
CREATE POLICY invoice_seq_update ON invoice_number_seq FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));

-- B.5 invoice_audit_trail (append-only)
CREATE TABLE IF NOT EXISTS invoice_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  field_changed text NOT NULL,
  original_value text,
  new_value text,
  change_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoice_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_trail_insert ON invoice_audit_trail FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY audit_trail_select ON invoice_audit_trail FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_trail_no_update ON invoice_audit_trail FOR UPDATE TO authenticated USING (false);
CREATE POLICY audit_trail_no_delete ON invoice_audit_trail FOR DELETE TO authenticated USING (false);

-- B.6 app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_read ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_write ON app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));

-- B.7 whatsapp_settings
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  redirect_message_en text DEFAULT 'Hi! For orders, please message us on Telegram — it is faster and easier. Send us a message here: {telegram_link}',
  redirect_message_nl text DEFAULT 'Hoi! Voor bestellingen kun je ons bereiken via Telegram: {telegram_link}',
  redirect_message_pap text DEFAULT 'Bon dia! Pa bo orde, manda nos mensahe riba Telegram: {telegram_link}',
  redirect_message_es text DEFAULT 'Hola! Para pedidos, escríbenos por Telegram: {telegram_link}',
  telegram_link text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_settings_read ON whatsapp_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY whatsapp_settings_write ON whatsapp_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));

-- B.8 anomaly_log
CREATE TABLE IF NOT EXISTS anomaly_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES distribution_customers(id),
  anomaly_type text CHECK (anomaly_type IN ('time_based','volume_based')),
  triggered_at timestamptz DEFAULT now(),
  outreach_conversation_id uuid REFERENCES dre_conversations(id),
  resolved boolean DEFAULT false,
  resolved_at timestamptz
);
ALTER TABLE anomaly_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY anomaly_log_staff ON anomaly_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));

-- B.9 ai_chief_officers
CREATE TABLE IF NOT EXISTS ai_chief_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text UNIQUE NOT NULL,
  officer_name text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','error')),
  last_run_at timestamptz,
  last_suggestion_at timestamptz,
  system_prompt text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_chief_officers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_officers_read ON ai_chief_officers FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_officers_write ON ai_chief_officers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'right_hand'));

-- B.10 ai_suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  suggestion_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  reasoning text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','dismissed','actioned')),
  actioned_by uuid REFERENCES profiles(id),
  actioned_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_suggestions_read ON ai_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_suggestions_insert ON ai_suggestions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_suggestions_action ON ai_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));
ALTER PUBLICATION supabase_realtime ADD TABLE ai_suggestions;

-- B.11 ai_alerts
CREATE TABLE IF NOT EXISTS ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  severity text CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  message text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_alerts_read ON ai_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_alerts_write ON ai_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'business_partner') OR public.has_role(auth.uid(), 'right_hand') OR public.has_role(auth.uid(), 'manager'));
ALTER PUBLICATION supabase_realtime ADD TABLE ai_alerts;

-- B.12 ai_agent_messages
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_department text NOT NULL,
  to_department text NOT NULL,
  message_type text NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_messages_read ON ai_agent_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'right_hand'));
CREATE POLICY ai_messages_insert ON ai_agent_messages FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════

INSERT INTO invoice_number_seq (id, last_number, prefix) VALUES (1, 1000, 'FUIK') ON CONFLICT (id) DO NOTHING;
INSERT INTO whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES
  ('cutoff_time', '07:00'), ('stock_window_time', '07:30'), ('anomaly_volume_threshold', '20'),
  ('business_phone', ''), ('business_name', 'Fuik'), ('telegram_link', '')
ON CONFLICT (key) DO NOTHING;
INSERT INTO ai_chief_officers (department, officer_name) VALUES
  ('sales','Dre'), ('import','Marco'), ('production','Pilar'), ('hr','Rosa'),
  ('finance','Felix'), ('marketing','Maya'), ('market_research','Radar'),
  ('administration','Axel'), ('research_development','Nova'), ('oversight','Oracle')
ON CONFLICT (department) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF app_role AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
