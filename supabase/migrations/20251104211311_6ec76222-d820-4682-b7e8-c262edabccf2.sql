-- Add production and delivery management tables

-- Production orders table
CREATE TABLE public.production_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, in_production, completed, cancelled
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Production items (what to produce per customer)
CREATE TABLE public.production_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  product_code TEXT NOT NULL,
  predicted_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deliveries table
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID REFERENCES public.production_orders(id),
  route_id UUID REFERENCES public.routes(id),
  delivery_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_transit, delivered, cancelled
  driver_id UUID REFERENCES auth.users(id),
  total_amount NUMERIC(10,2) DEFAULT 0,
  adjusted_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Delivery items with waste tracking
CREATE TABLE public.delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  product_code TEXT NOT NULL,
  planned_quantity INTEGER NOT NULL DEFAULT 0,
  delivered_quantity INTEGER,
  waste_quantity INTEGER DEFAULT 0,
  unit_price NUMERIC(10,2),
  line_total NUMERIC(10,2),
  adjusted_total NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Waste records for detailed tracking and analysis
CREATE TABLE public.waste_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  product_code TEXT NOT NULL,
  waste_quantity INTEGER NOT NULL,
  waste_reason TEXT, -- expired, damaged, overstocked, etc.
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI predictions for inventory optimization
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  product_code TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_quantity INTEGER NOT NULL,
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  based_on_days INTEGER, -- how many days of history used
  actual_quantity INTEGER, -- filled in after delivery
  actual_waste INTEGER, -- filled in after delivery
  accuracy_score NUMERIC(3,2), -- calculated after delivery
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoices/Receipts
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_date DATE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  waste_adjustment NUMERIC(10,2) DEFAULT 0,
  adjusted_total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, printed, paid, void
  printed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_orders
CREATE POLICY "Authenticated users can view production orders"
  ON public.production_orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage production orders"
  ON public.production_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role) OR has_role(auth.uid(), 'production'::app_role));

-- RLS Policies for production_items
CREATE POLICY "Authenticated users can view production items"
  ON public.production_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage production items"
  ON public.production_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role) OR has_role(auth.uid(), 'production'::app_role));

-- RLS Policies for deliveries
CREATE POLICY "Authenticated users can view deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management and drivers can manage deliveries"
  ON public.deliveries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role) OR has_role(auth.uid(), 'driver'::app_role) OR driver_id = auth.uid());

-- RLS Policies for delivery_items
CREATE POLICY "Authenticated users can view delivery items"
  ON public.delivery_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management and drivers can manage delivery items"
  ON public.delivery_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM deliveries 
    WHERE deliveries.id = delivery_items.delivery_id 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role) OR deliveries.driver_id = auth.uid())
  ));

-- RLS Policies for waste_records
CREATE POLICY "Authenticated users can view waste records"
  ON public.waste_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert waste records"
  ON public.waste_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for predictions
CREATE POLICY "Authenticated users can view predictions"
  ON public.predictions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage predictions"
  ON public.predictions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage invoices"
  ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Add indexes for performance
CREATE INDEX idx_production_orders_date ON public.production_orders(order_date, delivery_date);
CREATE INDEX idx_production_items_order ON public.production_items(production_order_id);
CREATE INDEX idx_production_items_customer ON public.production_items(customer_id);
CREATE INDEX idx_deliveries_date ON public.deliveries(delivery_date);
CREATE INDEX idx_deliveries_route ON public.deliveries(route_id);
CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_customer ON public.delivery_items(customer_id);
CREATE INDEX idx_waste_records_delivery ON public.waste_records(delivery_id);
CREATE INDEX idx_waste_records_customer_product ON public.waste_records(customer_id, product_code);
CREATE INDEX idx_predictions_customer_product ON public.predictions(customer_id, product_code);
CREATE INDEX idx_invoices_delivery ON public.invoices(delivery_id);

-- Add triggers for updated_at
CREATE TRIGGER update_production_orders_updated_at
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_production_items_updated_at
  BEFORE UPDATE ON public.production_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_delivery_items_updated_at
  BEFORE UPDATE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add production role to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'production') THEN
    ALTER TYPE public.app_role ADD VALUE 'production';
  END IF;
END $$;