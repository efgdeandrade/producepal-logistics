-- Create day_order_templates table for storing standing order templates per day
CREATE TABLE public.day_order_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- Create day_order_template_items table for storing items in each template
CREATE TABLE public.day_order_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.day_order_templates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.day_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_order_template_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for day_order_templates
CREATE POLICY "Authenticated users can view templates"
ON public.day_order_templates
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage templates"
ON public.day_order_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS policies for day_order_template_items
CREATE POLICY "Authenticated users can view template items"
ON public.day_order_template_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage template items"
ON public.day_order_template_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Create indexes for performance
CREATE INDEX idx_day_order_templates_day ON public.day_order_templates(day_of_week);
CREATE INDEX idx_day_order_template_items_template ON public.day_order_template_items(template_id);
CREATE INDEX idx_day_order_template_items_customer ON public.day_order_template_items(customer_id);

-- Add updated_at trigger
CREATE TRIGGER update_day_order_templates_updated_at
BEFORE UPDATE ON public.day_order_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();