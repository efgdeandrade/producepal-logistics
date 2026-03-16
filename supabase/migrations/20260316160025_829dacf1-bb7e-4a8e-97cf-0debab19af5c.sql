
-- Add unit_options array to distribution_products
ALTER TABLE public.distribution_products ADD COLUMN IF NOT EXISTS unit_options text[] DEFAULT '{}'::text[];

-- Add fuik_invoice_number to distribution_invoices
ALTER TABLE public.distribution_invoices ADD COLUMN IF NOT EXISTS fuik_invoice_number text;

-- Create the atomic FUIK invoice number generator
CREATE OR REPLACE FUNCTION public.generate_fuik_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
  prefix_val text;
  year_str text;
BEGIN
  UPDATE invoice_number_seq
    SET last_number = last_number + 1
    WHERE id = 1
    RETURNING last_number, prefix
    INTO next_num, prefix_val;

  year_str := to_char(current_date, 'YYYY');
  RETURN prefix_val || '-' || year_str || '-' || lpad(next_num::text, 4, '0');
END;
$$;
