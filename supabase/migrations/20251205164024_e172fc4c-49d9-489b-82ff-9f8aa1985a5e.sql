-- Fix market_price_snapshots RLS policies to require authentication
-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Users can view market price snapshots" ON public.market_price_snapshots;
DROP POLICY IF EXISTS "Users can insert market price snapshots" ON public.market_price_snapshots;

-- Create authenticated policies
CREATE POLICY "Authenticated users can view market snapshots"
ON public.market_price_snapshots
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can insert market snapshots"
ON public.market_price_snapshots
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
);

-- Also add update/delete policies for management
CREATE POLICY "Management can update market snapshots"
ON public.market_price_snapshots
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
);

CREATE POLICY "Management can delete market snapshots"
ON public.market_price_snapshots
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
);