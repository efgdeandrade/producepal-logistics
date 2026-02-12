
-- =============================================
-- CIF PROFILE MODULE - Tables, RLS, Indexes
-- =============================================

-- 1) Drop old CIF tables
DROP TABLE IF EXISTS cif_product_performance CASCADE;
DROP TABLE IF EXISTS cif_allocation_decisions CASCADE;
DROP TABLE IF EXISTS cif_anomalies CASCADE;
DROP TABLE IF EXISTS cif_audit_log CASCADE;
DROP TABLE IF EXISTS cif_calculation_snapshots CASCADE;
DROP TABLE IF EXISTS cif_calculations CASCADE;
DROP TABLE IF EXISTS cif_estimates CASCADE;
DROP TABLE IF EXISTS cif_learning_patterns CASCADE;

-- 2) Add missing columns to suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS currency_default text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS incoterms_default text DEFAULT 'FOB',
  ADD COLUMN IF NOT EXISTS lead_time_days integer;

-- 3) Add missing columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fx_rate_usd_to_xcg_snapshot numeric DEFAULT 1.82,
  ADD COLUMN IF NOT EXISTS settings_overrides_json jsonb;

-- 4) Global CIF settings
INSERT INTO public.settings (key, value, description)
VALUES
  ('cif_fx_rate_usd_to_xcg', '{"rate": 1.82}'::jsonb, 'Default FX rate: 1 USD = X XCG'),
  ('cif_champion_cost_per_kg', '{"rate": 2.63, "currency": "USD"}'::jsonb, 'Champion fixed cost per KG (USD)'),
  ('cif_swissport_cost_per_kg', '{"rate": 0.37, "currency": "USD"}'::jsonb, 'Swissport fixed cost per KG (USD)'),
  ('cif_local_logistics_cost', '{"amount": 100.00, "currency": "XCG"}'::jsonb, 'Local fixed logistics cost'),
  ('cif_bank_charges', '{"amount": 75.00, "currency": "USD"}'::jsonb, 'Default bank charges'),
  ('cif_spoilage_allowance', '{"percentage": 0, "mode": "percentage"}'::jsonb, 'Spoilage allowance (% or fixed)'),
  ('cif_pallet_config', '{"type": "europallet", "length_cm": 80, "width_cm": 120, "max_height_cm": 155}'::jsonb, 'Pallet configuration'),
  ('cif_wholesale_margin', '{"margin_pct": 20, "markup_pct": 25}'::jsonb, 'Wholesale pricing: 20% margin'),
  ('cif_retail_margin', '{"margin_pct": 44, "markup_pct": 78.57}'::jsonb, 'Retail pricing: 44% margin')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

-- 5) CIF Versions
CREATE TABLE public.cif_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  version_no integer NOT NULL DEFAULT 1,
  version_type text NOT NULL CHECK (version_type IN ('estimate', 'actual')),
  allocation_method_default text NOT NULL DEFAULT 'chargeable_weight',
  is_final boolean NOT NULL DEFAULT false,
  fx_rate_usd_to_xcg numeric NOT NULL DEFAULT 1.82,
  champion_cost_per_kg numeric NOT NULL DEFAULT 2.63,
  swissport_cost_per_kg numeric NOT NULL DEFAULT 0.37,
  local_logistics_xcg numeric NOT NULL DEFAULT 100.00,
  bank_charges_usd numeric NOT NULL DEFAULT 75.00,
  spoilage_mode text NOT NULL DEFAULT 'percentage' CHECK (spoilage_mode IN ('percentage', 'component')),
  spoilage_pct numeric NOT NULL DEFAULT 0,
  totals_json jsonb,
  ai_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(import_order_id, version_no, version_type)
);

-- 6) CIF Components
CREATE TABLE public.cif_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cif_version_id uuid NOT NULL REFERENCES public.cif_versions(id) ON DELETE CASCADE,
  component_type text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'approved')),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'XCG')),
  amount numeric NOT NULL DEFAULT 0,
  amount_usd numeric NOT NULL DEFAULT 0,
  allocation_basis text NOT NULL DEFAULT 'chargeable_weight'
    CHECK (allocation_basis IN ('chargeable_weight', 'actual_weight', 'volume', 'value', 'cases', 'pieces', 'equal')),
  notes text,
  source_document_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7) CIF Allocations
CREATE TABLE public.cif_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cif_version_id uuid NOT NULL REFERENCES public.cif_versions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_code text NOT NULL,
  qty_cases integer NOT NULL DEFAULT 0,
  qty_pieces integer NOT NULL DEFAULT 0,
  supplier_cost_usd_per_case numeric NOT NULL DEFAULT 0,
  supplier_cost_usd numeric NOT NULL DEFAULT 0,
  supplier_cost_xcg numeric NOT NULL DEFAULT 0,
  actual_weight_kg numeric NOT NULL DEFAULT 0,
  volumetric_weight_kg numeric NOT NULL DEFAULT 0,
  chargeable_weight_kg numeric NOT NULL DEFAULT 0,
  allocated_costs_json jsonb DEFAULT '{}'::jsonb,
  allocated_shared_costs_usd numeric NOT NULL DEFAULT 0,
  allocated_shared_costs_xcg numeric NOT NULL DEFAULT 0,
  spoilage_usd numeric NOT NULL DEFAULT 0,
  landed_total_usd numeric NOT NULL DEFAULT 0,
  landed_total_xcg numeric NOT NULL DEFAULT 0,
  landed_cost_per_piece_usd numeric,
  landed_cost_per_piece_xcg numeric,
  landed_cost_per_case_usd numeric,
  landed_cost_per_case_xcg numeric,
  landed_cost_per_kg_usd numeric,
  landed_cost_per_kg_xcg numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8) Pricing Suggestions
CREATE TABLE public.cif_pricing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cif_allocation_id uuid NOT NULL REFERENCES public.cif_allocations(id) ON DELETE CASCADE,
  cif_version_id uuid NOT NULL REFERENCES public.cif_versions(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  wholesale_price_per_piece_usd numeric,
  wholesale_price_per_piece_xcg numeric,
  wholesale_price_per_case_usd numeric,
  wholesale_price_per_case_xcg numeric,
  wholesale_price_per_kg_usd numeric,
  wholesale_price_per_kg_xcg numeric,
  retail_price_per_piece_usd numeric,
  retail_price_per_piece_xcg numeric,
  retail_price_per_case_usd numeric,
  retail_price_per_case_xcg numeric,
  retail_price_per_kg_usd numeric,
  retail_price_per_kg_xcg numeric,
  wholesale_margin_pct numeric NOT NULL DEFAULT 20,
  retail_margin_pct numeric NOT NULL DEFAULT 44,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9) CIF Variances
CREATE TABLE public.cif_variances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  estimate_version_id uuid REFERENCES public.cif_versions(id) ON DELETE SET NULL,
  actual_version_id uuid REFERENCES public.cif_versions(id) ON DELETE SET NULL,
  variance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10) CIF Documents
CREATE TABLE public.cif_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  cif_version_id uuid REFERENCES public.cif_versions(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  extracted_fields_json jsonb,
  extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11) Drive Links
CREATE TABLE public.cif_drive_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  google_drive_folder_id text,
  google_drive_folder_url text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12) ASYCUDA Records
CREATE TABLE public.cif_asycuda_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  declaration_no text,
  declaration_date date,
  duties_amount numeric DEFAULT 0,
  taxes_amount numeric DEFAULT 0,
  clearance_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13) Change Log
CREATE TABLE public.cif_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.cif_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_pricing_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_variances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_drive_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_asycuda_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cif_change_log ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.has_cif_edit_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'import', 'finance')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_cif_view_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'import', 'finance', 'sales')
  )
$$;

-- Policies for cif_versions
CREATE POLICY "cif_versions_select" ON public.cif_versions FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_versions_insert" ON public.cif_versions FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_versions_update" ON public.cif_versions FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_versions_delete" ON public.cif_versions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for cif_components
CREATE POLICY "cif_components_select" ON public.cif_components FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_components_insert" ON public.cif_components FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_components_update" ON public.cif_components FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_components_delete" ON public.cif_components FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for cif_allocations
CREATE POLICY "cif_allocations_select" ON public.cif_allocations FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_allocations_insert" ON public.cif_allocations FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_allocations_update" ON public.cif_allocations FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_allocations_delete" ON public.cif_allocations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for pricing suggestions
CREATE POLICY "cif_pricing_select" ON public.cif_pricing_suggestions FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_pricing_insert" ON public.cif_pricing_suggestions FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_pricing_update" ON public.cif_pricing_suggestions FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_pricing_delete" ON public.cif_pricing_suggestions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for variances
CREATE POLICY "cif_variances_select" ON public.cif_variances FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_variances_insert" ON public.cif_variances FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));

-- Policies for documents
CREATE POLICY "cif_documents_select" ON public.cif_documents FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_documents_insert" ON public.cif_documents FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_documents_update" ON public.cif_documents FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));

-- Policies for drive links
CREATE POLICY "cif_drive_links_select" ON public.cif_drive_links FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_drive_links_insert" ON public.cif_drive_links FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_drive_links_update" ON public.cif_drive_links FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));

-- Policies for ASYCUDA
CREATE POLICY "cif_asycuda_select" ON public.cif_asycuda_records FOR SELECT TO authenticated USING (public.has_cif_view_role(auth.uid()));
CREATE POLICY "cif_asycuda_insert" ON public.cif_asycuda_records FOR INSERT TO authenticated WITH CHECK (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_asycuda_update" ON public.cif_asycuda_records FOR UPDATE TO authenticated USING (public.has_cif_edit_role(auth.uid()));

-- Change log: anyone authenticated can insert, edit roles can view
CREATE POLICY "cif_changelog_select" ON public.cif_change_log FOR SELECT TO authenticated USING (public.has_cif_edit_role(auth.uid()));
CREATE POLICY "cif_changelog_insert" ON public.cif_change_log FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_cif_versions_order ON public.cif_versions(import_order_id);
CREATE INDEX idx_cif_versions_type ON public.cif_versions(version_type);
CREATE INDEX idx_cif_components_version ON public.cif_components(cif_version_id);
CREATE INDEX idx_cif_allocations_version ON public.cif_allocations(cif_version_id);
CREATE INDEX idx_cif_allocations_product ON public.cif_allocations(product_code);
CREATE INDEX idx_cif_pricing_version ON public.cif_pricing_suggestions(cif_version_id);
CREATE INDEX idx_cif_documents_order ON public.cif_documents(import_order_id);
CREATE INDEX idx_cif_changelog_record ON public.cif_change_log(table_name, record_id);
