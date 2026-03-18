-- ═══════════════════════════════════════
-- ADMINISTRATION TABLES
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  document_number text,
  issue_date date,
  expiry_date date,
  status text DEFAULT 'active',
  storage_path text,
  notes text,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_supplier_documents_updated_at
  BEFORE UPDATE ON supplier_documents
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_docs_read ON supplier_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_docs_write ON supplier_documents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY supplier_docs_update ON supplier_documents FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY supplier_docs_delete ON supplier_documents FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);

CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  assigned_to uuid REFERENCES profiles(id),
  due_date date,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_admin_tasks_updated_at
  BEFORE UPDATE ON admin_tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_tasks_read ON admin_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_tasks_write ON admin_tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY admin_tasks_update ON admin_tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY admin_tasks_delete ON admin_tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);

-- ═══════════════════════════════════════
-- R&D TABLES
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS rd_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'new_product',
  status text DEFAULT 'idea',
  priority text DEFAULT 'medium',
  potential_revenue_xcg numeric,
  estimated_cost_xcg numeric,
  source text DEFAULT 'internal',
  submitted_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  target_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_rd_opportunities_updated_at
  BEFORE UPDATE ON rd_opportunities
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE rd_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY rd_read ON rd_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY rd_write ON rd_opportunities FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY rd_update ON rd_opportunities FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY rd_delete ON rd_opportunities FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);

CREATE TABLE IF NOT EXISTS rd_market_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  source text,
  detected_at timestamptz DEFAULT now(),
  relevance_score numeric DEFAULT 0.5,
  status text DEFAULT 'new',
  reviewed_by uuid REFERENCES profiles(id),
  linked_opportunity_id uuid REFERENCES rd_opportunities(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rd_market_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY rd_signals_read ON rd_market_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY rd_signals_write ON rd_market_signals FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY rd_signals_update ON rd_market_signals FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY rd_signals_delete ON rd_market_signals FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);

-- ═══════════════════════════════════════
-- IMPORT ENHANCEMENTS
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE NOT NULL,
  supplier_name text NOT NULL,
  origin_country text DEFAULT 'Colombia',
  status text DEFAULT 'ordered',
  order_date date,
  estimated_arrival date,
  actual_arrival date,
  total_cif_xcg numeric DEFAULT 0,
  total_weight_kg numeric DEFAULT 0,
  container_count integer DEFAULT 1,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_import_shipments_updated_at
  BEFORE UPDATE ON import_shipments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE import_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipments_read ON import_shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY shipments_write ON import_shipments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY shipments_update ON import_shipments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);
CREATE POLICY shipments_delete ON import_shipments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('director','right_hand','manager'))
);

-- ═══════════════════════════════════════
-- SUMMARY VIEWS
-- ═══════════════════════════════════════

CREATE OR REPLACE VIEW administration_summary AS
SELECT
  (SELECT COUNT(*) FROM supplier_documents
    WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
    AND status = 'active') as docs_expiring_soon,
  (SELECT COUNT(*) FROM supplier_documents
    WHERE expiry_date < CURRENT_DATE AND status = 'active') as docs_expired,
  (SELECT COUNT(*) FROM admin_tasks
    WHERE status IN ('open','in_progress')
    AND due_date < CURRENT_DATE) as overdue_tasks,
  (SELECT COUNT(*) FROM admin_tasks
    WHERE status = 'open') as open_tasks,
  (SELECT COUNT(*) FROM supplier_documents) as total_supplier_docs,
  (SELECT COUNT(*) FROM import_shipments
    WHERE status IN ('ordered','in_transit','customs')) as active_shipments;

CREATE OR REPLACE VIEW rd_summary AS
SELECT
  (SELECT COUNT(*) FROM rd_opportunities WHERE status = 'idea') as ideas_pending,
  (SELECT COUNT(*) FROM rd_opportunities WHERE status = 'researching') as in_research,
  (SELECT COUNT(*) FROM rd_opportunities WHERE status = 'validated') as validated,
  (SELECT COUNT(*) FROM rd_opportunities WHERE status = 'implemented') as implemented,
  (SELECT COUNT(*) FROM rd_market_signals WHERE status = 'new') as new_signals,
  (SELECT COUNT(*) FROM rd_opportunities
    WHERE source = 'customer_request') as customer_requests;

CREATE OR REPLACE VIEW import_summary AS
SELECT
  (SELECT COUNT(*) FROM import_shipments
    WHERE status IN ('ordered','in_transit')) as shipments_in_transit,
  (SELECT COUNT(*) FROM import_shipments
    WHERE status = 'customs') as shipments_in_customs,
  (SELECT COUNT(*) FROM import_shipments
    WHERE status = 'arrived') as shipments_arrived,
  (SELECT COUNT(*) FROM supplier_documents
    WHERE document_type IN ('import_permit','health_certificate','phytosanitary')
    AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
    AND status = 'active') as valid_import_docs,
  (SELECT COALESCE(SUM(total_cif_xcg), 0) FROM import_shipments
    WHERE created_at > now() - interval '30 days'
    AND status != 'cancelled') as monthly_import_value;

-- Storage bucket for supplier documents
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-documents', 'supplier-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload supplier docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-documents');

CREATE POLICY "Authenticated users can read supplier docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supplier-documents');

CREATE POLICY "Managers can delete supplier docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-documents');