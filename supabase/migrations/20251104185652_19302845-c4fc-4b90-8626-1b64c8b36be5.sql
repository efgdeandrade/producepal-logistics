-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pack_size INTEGER NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  price_usd DECIMAL(10, 2),
  price_xcg DECIMAL(10, 2),
  weight DECIMAL(10, 2),
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  week_number INTEGER NOT NULL,
  delivery_date DATE NOT NULL,
  placed_by TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'void')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  po_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view all suppliers"
  ON public.suppliers FOR SELECT
  USING (true);

CREATE POLICY "Admins and management can manage suppliers"
  ON public.suppliers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for products
CREATE POLICY "Users can view all products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Admins and management can manage products"
  ON public.products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for orders
CREATE POLICY "Users can view all orders"
  ON public.orders FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Admins and management can delete orders"
  ON public.orders FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for order_items
CREATE POLICY "Users can view all order items"
  ON public.order_items FOR SELECT
  USING (true);

CREATE POLICY "Users can manage order items for their orders"
  ON public.order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
    )
  );

-- Create indexes for performance
CREATE INDEX idx_orders_week_number ON public.orders(week_number);
CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_products_code ON public.products(code);

-- Create triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert initial products
INSERT INTO public.products (code, name, pack_size, price_usd, price_xcg) VALUES
  ('STB_500', 'Strawberries 500g', 10, 25.00, 45.00),
  ('STB_250', 'Strawberries 250g', 20, 30.00, 54.00),
  ('BLB_125', 'Blueberries 125g', 12, 28.00, 50.40),
  ('CTO_250', 'Cherry Tomatoes 250g', 20, 20.00, 36.00),
  ('CTO_500', 'Cherry Tomatoes 500g', 10, 18.00, 32.40),
  ('CTO_PKG', 'Cherry Tomatoes per KG', 1, 15.00, 27.00);