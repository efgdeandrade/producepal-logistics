-- Table to track the most commonly used picking unit per product (global learning)
CREATE TABLE public.distribution_product_picking_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.distribution_products(id) ON DELETE CASCADE,
  picking_unit TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, picking_unit)
);

-- Create index for fast lookups
CREATE INDEX idx_product_picking_units_product ON distribution_product_picking_units(product_id);
CREATE INDEX idx_product_picking_units_usage ON distribution_product_picking_units(product_id, usage_count DESC);

-- Enable RLS
ALTER TABLE public.distribution_product_picking_units ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to read and modify
CREATE POLICY "Allow authenticated users to view picking units"
  ON public.distribution_product_picking_units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert picking units"
  ON public.distribution_product_picking_units
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update picking units"
  ON public.distribution_product_picking_units
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_product_picking_units_timestamp
  BEFORE UPDATE ON public.distribution_product_picking_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_product_picking_units;