-- =============================================
-- CIF ESTIMATION SYSTEM REMODEL - PHASE 1
-- =============================================

-- 1. Create supplier_cost_config table for supplier-specific fixed costs
CREATE TABLE IF NOT EXISTS public.supplier_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  fixed_cost_per_shipment_usd NUMERIC DEFAULT 0,
  handling_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id)
);

-- Enable RLS on supplier_cost_config
ALTER TABLE public.supplier_cost_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for supplier_cost_config (admin-only write, all authenticated read)
CREATE POLICY "Authenticated users can view supplier cost config"
  ON public.supplier_cost_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert supplier cost config"
  ON public.supplier_cost_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update supplier cost config"
  ON public.supplier_cost_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete supplier cost config"
  ON public.supplier_cost_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_supplier_cost_config_updated_at
  BEFORE UPDATE ON public.supplier_cost_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add new columns to cif_estimates for categorized actual costs
ALTER TABLE public.cif_estimates 
  ADD COLUMN IF NOT EXISTS actual_labor_xcg NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_bank_charges_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS supplier_fixed_costs_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_labor_xcg NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_bank_charges_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_supplier_fixed_costs_usd NUMERIC;

-- 3. Create cif_calculation_snapshots for order-level estimate/actual storage
CREATE TABLE IF NOT EXISTS public.cif_calculation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('estimate', 'actual')),
  total_freight_usd NUMERIC,
  freight_exterior_usd NUMERIC,
  freight_local_usd NUMERIC,
  local_logistics_usd NUMERIC,
  labor_xcg NUMERIC,
  bank_charges_usd NUMERIC,
  other_costs_usd NUMERIC,
  supplier_fixed_costs_usd NUMERIC,
  distribution_method TEXT,
  blend_ratio NUMERIC,
  exchange_rate NUMERIC,
  total_chargeable_weight_kg NUMERIC,
  total_actual_weight_kg NUMERIC,
  total_volumetric_weight_kg NUMERIC,
  products_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_adjustments_applied JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS on cif_calculation_snapshots
ALTER TABLE public.cif_calculation_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for cif_calculation_snapshots
CREATE POLICY "Authenticated users can view calculation snapshots"
  ON public.cif_calculation_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create calculation snapshots"
  ON public.cif_calculation_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their own snapshots"
  ON public.cif_calculation_snapshots FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_cif_snapshots_order_type 
  ON public.cif_calculation_snapshots(order_id, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_cif_snapshots_created 
  ON public.cif_calculation_snapshots(created_at DESC);

-- 4. Add default settings for bank charges if not exists
INSERT INTO public.settings (key, value, description)
VALUES (
  'default_bank_charges_usd',
  '0',
  'Default bank/wire transfer charges per shipment in USD'
)
ON CONFLICT (key) DO NOTHING;