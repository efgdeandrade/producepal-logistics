-- Create fnb_standing_order_templates table
CREATE TABLE public.fnb_standing_order_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 6),
  template_name TEXT NOT NULL DEFAULT 'Standing Order',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- Create fnb_standing_order_items table
CREATE TABLE public.fnb_standing_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.fnb_standing_order_templates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.fnb_customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.fnb_products(id) ON DELETE CASCADE,
  default_quantity NUMERIC NOT NULL DEFAULT 1,
  default_price_xcg NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fnb_week_generations table to track which weeks have been generated
CREATE TABLE public.fnb_week_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID,
  orders_created INTEGER NOT NULL DEFAULT 0,
  UNIQUE(week_start_date)
);

-- Enable RLS on all tables
ALTER TABLE public.fnb_standing_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_standing_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_week_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies for fnb_standing_order_templates
CREATE POLICY "Authenticated users can view standing order templates"
  ON public.fnb_standing_order_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage standing order templates"
  ON public.fnb_standing_order_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for fnb_standing_order_items
CREATE POLICY "Authenticated users can view standing order items"
  ON public.fnb_standing_order_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage standing order items"
  ON public.fnb_standing_order_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for fnb_week_generations
CREATE POLICY "Authenticated users can view week generations"
  ON public.fnb_week_generations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage week generations"
  ON public.fnb_week_generations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_fnb_standing_order_items_template_id ON public.fnb_standing_order_items(template_id);
CREATE INDEX idx_fnb_standing_order_items_customer_id ON public.fnb_standing_order_items(customer_id);
CREATE INDEX idx_fnb_week_generations_week_start ON public.fnb_week_generations(week_start_date);