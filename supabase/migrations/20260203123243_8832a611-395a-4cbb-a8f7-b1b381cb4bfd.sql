-- Create cross-department product mappings table
CREATE TABLE public.cross_department_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_product_code TEXT NOT NULL,
  distribution_product_id UUID NOT NULL REFERENCES distribution_products(id) ON DELETE CASCADE,
  conversion_factor NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(import_product_code, distribution_product_id)
);

-- Enable RLS
ALTER TABLE public.cross_department_product_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view mappings" 
ON public.cross_department_product_mappings 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage mappings" 
ON public.cross_department_product_mappings 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Add distribution columns to import_order_driver_assignments
ALTER TABLE public.import_order_driver_assignments
ADD COLUMN distribution_customer_ids UUID[] DEFAULT '{}',
ADD COLUMN include_distribution BOOLEAN DEFAULT false;

-- Add trigger for updated_at
CREATE TRIGGER update_cross_department_product_mappings_updated_at
  BEFORE UPDATE ON public.cross_department_product_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();