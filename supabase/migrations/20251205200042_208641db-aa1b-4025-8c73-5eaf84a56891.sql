-- F&B Customers (separate from wholesale customers)
CREATE TABLE fnb_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_phone TEXT UNIQUE NOT NULL,
  preferred_language TEXT DEFAULT 'pap',
  address TEXT,
  quickbooks_customer_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- F&B Products (separate catalog)
CREATE TABLE fnb_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_pap TEXT,
  name_nl TEXT,
  name_es TEXT,
  unit TEXT NOT NULL,
  price_xcg NUMERIC NOT NULL,
  min_order_qty NUMERIC DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  quickbooks_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- F&B Orders
CREATE TABLE fnb_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES fnb_customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status TEXT DEFAULT 'pending',
  total_xcg NUMERIC DEFAULT 0,
  notes TEXT,
  language_used TEXT,
  quickbooks_invoice_id TEXT,
  quickbooks_invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- F&B Order Items
CREATE TABLE fnb_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES fnb_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES fnb_products(id),
  quantity NUMERIC NOT NULL,
  unit_price_xcg NUMERIC NOT NULL,
  total_xcg NUMERIC NOT NULL,
  picked_quantity NUMERIC,
  picked_by UUID,
  picked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp Conversation History
CREATE TABLE fnb_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES fnb_customers(id),
  message_id TEXT UNIQUE,
  direction TEXT NOT NULL,
  message_text TEXT NOT NULL,
  detected_language TEXT,
  parsed_intent TEXT,
  parsed_items JSONB,
  order_id UUID REFERENCES fnb_orders(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer Order Patterns for AI suggestions
CREATE TABLE fnb_customer_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES fnb_customers(id),
  product_id UUID REFERENCES fnb_products(id),
  order_count INTEGER DEFAULT 0,
  total_quantity NUMERIC DEFAULT 0,
  avg_quantity NUMERIC,
  last_ordered_at TIMESTAMPTZ,
  day_of_week_preference INTEGER[],
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Picker Queue for shared workstation
CREATE TABLE fnb_picker_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES fnb_orders(id) ON DELETE CASCADE,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE fnb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_customer_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_picker_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fnb_customers
CREATE POLICY "Authenticated users can view fnb customers" ON fnb_customers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Management can manage fnb customers" ON fnb_customers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for fnb_products
CREATE POLICY "Authenticated users can view fnb products" ON fnb_products
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Management can manage fnb products" ON fnb_products
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for fnb_orders
CREATE POLICY "Authenticated users can view fnb orders" ON fnb_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create fnb orders" ON fnb_orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Management can manage fnb orders" ON fnb_orders
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for fnb_order_items
CREATE POLICY "Authenticated users can view fnb order items" ON fnb_order_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage fnb order items" ON fnb_order_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for fnb_conversations
CREATE POLICY "Authenticated users can view fnb conversations" ON fnb_conversations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert fnb conversations" ON fnb_conversations
  FOR INSERT WITH CHECK (true);

-- RLS Policies for fnb_customer_patterns
CREATE POLICY "Authenticated users can view fnb patterns" ON fnb_customer_patterns
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can manage fnb patterns" ON fnb_customer_patterns
  FOR ALL USING (true);

-- RLS Policies for fnb_picker_queue
CREATE POLICY "Authenticated users can view picker queue" ON fnb_picker_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage picker queue" ON fnb_picker_queue
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Enable realtime for orders and picker queue
ALTER PUBLICATION supabase_realtime ADD TABLE fnb_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE fnb_picker_queue;

-- Updated at triggers
CREATE TRIGGER update_fnb_customers_updated_at BEFORE UPDATE ON fnb_customers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_fnb_products_updated_at BEFORE UPDATE ON fnb_products
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_fnb_orders_updated_at BEFORE UPDATE ON fnb_orders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();