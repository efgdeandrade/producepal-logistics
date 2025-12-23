-- Create table for tracking order modifications
CREATE TABLE public.fnb_order_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.fnb_orders(id) ON DELETE CASCADE,
  modified_by UUID,
  modified_by_email TEXT,
  modification_type TEXT NOT NULL, -- 'item_added', 'item_removed', 'item_updated', 'status_changed', 'quantity_changed'
  previous_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fnb_order_modifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view order modifications" 
ON public.fnb_order_modifications 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized roles can insert order modifications" 
ON public.fnb_order_modifications 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

-- Create index for performance
CREATE INDEX idx_fnb_order_modifications_order_id ON public.fnb_order_modifications(order_id);
CREATE INDEX idx_fnb_order_modifications_created_at ON public.fnb_order_modifications(created_at DESC);