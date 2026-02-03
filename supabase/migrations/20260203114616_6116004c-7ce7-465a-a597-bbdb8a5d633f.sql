-- Create table to store driver-customer assignments for import orders
CREATE TABLE public.import_order_driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  driver_id UUID REFERENCES public.profiles(id),
  customer_names TEXT[] NOT NULL DEFAULT '{}',
  sequence_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups by order
CREATE INDEX idx_driver_assignments_order_id ON public.import_order_driver_assignments(order_id);

-- Enable RLS
ALTER TABLE public.import_order_driver_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to manage driver assignments
CREATE POLICY "Authenticated users can view driver assignments"
  ON public.import_order_driver_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create driver assignments"
  ON public.import_order_driver_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update driver assignments"
  ON public.import_order_driver_assignments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete driver assignments"
  ON public.import_order_driver_assignments
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_driver_assignments_updated_at
  BEFORE UPDATE ON public.import_order_driver_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();