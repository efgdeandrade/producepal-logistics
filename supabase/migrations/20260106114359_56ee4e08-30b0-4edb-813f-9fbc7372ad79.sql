-- Create the update_updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for global product aliases (common variations across all customers)
CREATE TABLE public.fnb_product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.fnb_products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT DEFAULT 'any',
  confidence_score NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, alias)
);

-- Enable RLS
ALTER TABLE public.fnb_product_aliases ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow all authenticated users to read, admins to write
CREATE POLICY "Anyone can view product aliases" 
ON public.fnb_product_aliases 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert aliases" 
ON public.fnb_product_aliases 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update aliases" 
ON public.fnb_product_aliases 
FOR UPDATE 
USING (true);

-- Create index for fast alias lookups
CREATE INDEX idx_fnb_product_aliases_alias ON public.fnb_product_aliases(LOWER(alias));
CREATE INDEX idx_fnb_product_aliases_product_id ON public.fnb_product_aliases(product_id);

-- Add trigger for updated_at
CREATE TRIGGER update_fnb_product_aliases_updated_at
BEFORE UPDATE ON public.fnb_product_aliases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();