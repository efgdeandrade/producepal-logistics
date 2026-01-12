-- Add is_ob_eligible column to fnb_products
ALTER TABLE public.fnb_products 
ADD COLUMN IF NOT EXISTS is_ob_eligible boolean DEFAULT false;

-- Set O.B. eligible for Lime Extract products
UPDATE public.fnb_products 
SET is_ob_eligible = true 
WHERE code IN ('LIME_EXT_1L', 'LIME_EXT_5L');

-- Create fnb_invoices table
CREATE TABLE public.fnb_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'synced', 'failed')),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days')::date,
  customer_id uuid NOT NULL REFERENCES public.fnb_customers(id),
  subtotal_xcg numeric(12,2) NOT NULL DEFAULT 0,
  ob_tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_xcg numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  customer_memo text,
  created_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamp with time zone,
  quickbooks_invoice_id text,
  quickbooks_invoice_number text,
  quickbooks_sync_status text DEFAULT 'pending' CHECK (quickbooks_sync_status IN ('pending', 'synced', 'failed')),
  quickbooks_sync_error text,
  quickbooks_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create fnb_invoice_items table
CREATE TABLE public.fnb_invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.fnb_invoices(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.fnb_order_items(id),
  product_id uuid REFERENCES public.fnb_products(id),
  product_name text NOT NULL,
  description text,
  quantity numeric(12,3) NOT NULL,
  unit_price_xcg numeric(12,2) NOT NULL,
  line_total_xcg numeric(12,2) NOT NULL,
  is_ob_eligible boolean DEFAULT false,
  ob_tax_inclusive numeric(12,2) DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create fnb_invoice_orders junction table
CREATE TABLE public.fnb_invoice_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.fnb_invoices(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.fnb_orders(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, order_id)
);

-- Add invoice_id reference to fnb_orders for quick lookup
ALTER TABLE public.fnb_orders 
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.fnb_invoices(id);

-- Create invoice activity log table
CREATE TABLE public.fnb_invoice_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.fnb_invoices(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.fnb_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_invoice_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_invoice_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for fnb_invoices
CREATE POLICY "Authenticated users can view invoices" 
ON public.fnb_invoices FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create invoices" 
ON public.fnb_invoices FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices" 
ON public.fnb_invoices FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete draft invoices" 
ON public.fnb_invoices FOR DELETE 
TO authenticated 
USING (status = 'draft');

-- RLS policies for fnb_invoice_items
CREATE POLICY "Authenticated users can view invoice items" 
ON public.fnb_invoice_items FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage invoice items" 
ON public.fnb_invoice_items FOR ALL 
TO authenticated 
USING (true);

-- RLS policies for fnb_invoice_orders
CREATE POLICY "Authenticated users can view invoice orders" 
ON public.fnb_invoice_orders FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage invoice orders" 
ON public.fnb_invoice_orders FOR ALL 
TO authenticated 
USING (true);

-- RLS policies for fnb_invoice_activity
CREATE POLICY "Authenticated users can view invoice activity" 
ON public.fnb_invoice_activity FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create invoice activity" 
ON public.fnb_invoice_activity FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create updated_at trigger for fnb_invoices
CREATE TRIGGER update_fnb_invoices_updated_at
BEFORE UPDATE ON public.fnb_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_fnb_invoices_customer_id ON public.fnb_invoices(customer_id);
CREATE INDEX idx_fnb_invoices_status ON public.fnb_invoices(status);
CREATE INDEX idx_fnb_invoices_invoice_date ON public.fnb_invoices(invoice_date);
CREATE INDEX idx_fnb_invoice_items_invoice_id ON public.fnb_invoice_items(invoice_id);
CREATE INDEX idx_fnb_invoice_orders_invoice_id ON public.fnb_invoice_orders(invoice_id);
CREATE INDEX idx_fnb_invoice_orders_order_id ON public.fnb_invoice_orders(order_id);
CREATE INDEX idx_fnb_orders_invoice_id ON public.fnb_orders(invoice_id);