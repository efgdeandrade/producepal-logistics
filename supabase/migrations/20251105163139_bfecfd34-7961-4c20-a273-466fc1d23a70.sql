-- Create product price history table
CREATE TABLE public.product_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  old_price_usd_per_unit NUMERIC,
  new_price_usd_per_unit NUMERIC,
  old_price_xcg_per_unit NUMERIC,
  new_price_xcg_per_unit NUMERIC,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_email TEXT,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view price history"
ON public.product_price_history
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert price history"
ON public.product_price_history
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_product_price_history_product_id ON public.product_price_history(product_id);
CREATE INDEX idx_product_price_history_created_at ON public.product_price_history(created_at DESC);

-- Create function to log price changes
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only log if prices actually changed
  IF (OLD.price_usd_per_unit IS DISTINCT FROM NEW.price_usd_per_unit) OR
     (OLD.price_xcg_per_unit IS DISTINCT FROM NEW.price_xcg_per_unit) THEN
    
    -- Get user email if available
    IF auth.uid() IS NOT NULL THEN
      SELECT email INTO user_email
      FROM auth.users
      WHERE id = auth.uid();
    END IF;
    
    -- Insert price history record
    INSERT INTO public.product_price_history (
      product_id,
      product_code,
      product_name,
      old_price_usd_per_unit,
      new_price_usd_per_unit,
      old_price_xcg_per_unit,
      new_price_xcg_per_unit,
      changed_by,
      changed_by_email
    ) VALUES (
      NEW.id,
      NEW.code,
      NEW.name,
      OLD.price_usd_per_unit,
      NEW.price_usd_per_unit,
      OLD.price_xcg_per_unit,
      NEW.price_xcg_per_unit,
      auth.uid(),
      COALESCE(user_email, 'system')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic price change logging
CREATE TRIGGER trigger_log_product_price_change
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_product_price_change();