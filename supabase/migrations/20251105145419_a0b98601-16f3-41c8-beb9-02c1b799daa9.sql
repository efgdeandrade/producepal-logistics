-- Create supplier_orders table to track purchase orders placed to suppliers
CREATE TABLE public.supplier_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
  total_amount NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier_order_items table to track items in each supplier order
CREATE TABLE public.supplier_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10, 2),
  line_total NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_orders
CREATE POLICY "Authenticated users can view supplier orders"
  ON public.supplier_orders
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and management can manage supplier orders"
  ON public.supplier_orders
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role)
  );

-- RLS Policies for supplier_order_items
CREATE POLICY "Authenticated users can view supplier order items"
  ON public.supplier_order_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and management can manage supplier order items"
  ON public.supplier_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_orders
      WHERE supplier_orders.id = supplier_order_items.supplier_order_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'management'::app_role)
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_supplier_orders_supplier_id ON public.supplier_orders(supplier_id);
CREATE INDEX idx_supplier_orders_order_date ON public.supplier_orders(order_date);
CREATE INDEX idx_supplier_order_items_order_id ON public.supplier_order_items(supplier_order_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_supplier_orders_updated_at
  BEFORE UPDATE ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_supplier_order_items_updated_at
  BEFORE UPDATE ON public.supplier_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();