-- Create bills table
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  vendor_id UUID REFERENCES public.suppliers(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE,
  bill_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'manager_review', 'approved', 'rejected', 'in_quickbooks', 'paid')),
  google_drive_file_id TEXT,
  google_drive_url TEXT,
  pdf_url TEXT,
  ocr_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bill_approvals table
CREATE TABLE public.bill_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  approver_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments TEXT,
  signature_url TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bill_line_items table
CREATE TABLE public.bill_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  account_code TEXT,
  product_id UUID REFERENCES public.products(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quickbooks_sync_log table
CREATE TABLE public.quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  quickbooks_bill_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_date TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  payment_status TEXT CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for bill PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('bills', 'bills', false);

-- Enable RLS on all tables
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bills table
CREATE POLICY "Authenticated users can view bills"
  ON public.bills FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can create bills"
  ON public.bills FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Management can update bills"
  ON public.bills FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Admins can delete bills"
  ON public.bills FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for bill_approvals table
CREATE POLICY "Users can view their approval tasks"
  ON public.bill_approvals FOR SELECT
  USING (approver_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "System can create approvals"
  ON public.bill_approvals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Approvers can update their approvals"
  ON public.bill_approvals FOR UPDATE
  USING (approver_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for bill_line_items table
CREATE POLICY "Authenticated users can view bill line items"
  ON public.bill_line_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage bill line items"
  ON public.bill_line_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- RLS Policies for quickbooks_sync_log table
CREATE POLICY "Authenticated users can view sync logs"
  ON public.quickbooks_sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage sync logs"
  ON public.quickbooks_sync_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Storage policies for bills bucket
CREATE POLICY "Authenticated users can view bills"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bills' AND auth.uid() IS NOT NULL);

CREATE POLICY "Management can upload bills"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bills' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)));

CREATE POLICY "Management can update bills"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bills' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)));

-- Triggers for updated_at
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_bills_status ON public.bills(status);
CREATE INDEX idx_bills_vendor_id ON public.bills(vendor_id);
CREATE INDEX idx_bills_bill_date ON public.bills(bill_date);
CREATE INDEX idx_bill_approvals_bill_id ON public.bill_approvals(bill_id);
CREATE INDEX idx_bill_approvals_approver_id ON public.bill_approvals(approver_id);
CREATE INDEX idx_bill_line_items_bill_id ON public.bill_line_items(bill_id);
CREATE INDEX idx_quickbooks_sync_bill_id ON public.quickbooks_sync_log(bill_id);