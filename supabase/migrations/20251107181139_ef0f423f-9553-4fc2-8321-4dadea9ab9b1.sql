-- Create receipt_numbers table
CREATE TABLE public.receipt_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_receipt_numbers_order_id ON public.receipt_numbers(order_id);
CREATE INDEX idx_receipt_numbers_customer_name ON public.receipt_numbers(customer_name);
CREATE INDEX idx_receipt_numbers_generated_at ON public.receipt_numbers(generated_at DESC);

-- Enable RLS
ALTER TABLE public.receipt_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view receipt numbers"
ON public.receipt_numbers
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert receipt numbers"
ON public.receipt_numbers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Management can delete receipt numbers"
ON public.receipt_numbers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Function to generate sequential receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_receipt_number TEXT;
BEGIN
  -- Lock the table to prevent concurrent issues
  LOCK TABLE public.receipt_numbers IN EXCLUSIVE MODE;
  
  -- Get the highest receipt number
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(receipt_number FROM 'RCT-([0-9]+)') AS INTEGER
      )
    ), 
    0
  ) INTO next_number
  FROM public.receipt_numbers
  WHERE receipt_number ~ '^RCT-[0-9]+$';
  
  -- Increment and format
  next_number := next_number + 1;
  new_receipt_number := 'RCT-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_receipt_number;
END;
$$;