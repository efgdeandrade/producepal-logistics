-- Fix overly permissive RLS policies for distribution_order_sessions
DROP POLICY IF EXISTS "Authenticated users can manage order sessions" ON public.distribution_order_sessions;

-- Create role-based policies for distribution_order_sessions
-- SELECT: Allow admin, management, production to view order sessions
CREATE POLICY "Admin/management/production can view order sessions"
ON public.distribution_order_sessions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
  OR public.has_role(auth.uid(), 'production'::app_role)
);

-- INSERT/UPDATE/DELETE: Only admin and management
CREATE POLICY "Admin/management can manage order sessions"
ON public.distribution_order_sessions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
);

CREATE POLICY "Admin/management can update order sessions"
ON public.distribution_order_sessions
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
);

CREATE POLICY "Admin/management can delete order sessions"
ON public.distribution_order_sessions
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
);

-- Fix market_news_cache - remove overly permissive policies
DROP POLICY IF EXISTS "Service can manage market news" ON public.market_news_cache;
DROP POLICY IF EXISTS "Authenticated users can read market news" ON public.market_news_cache;

-- Create proper role-based policies for market_news_cache
-- SELECT: Management, admin, and import roles can view market news
CREATE POLICY "Management can view market news"
ON public.market_news_cache
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'management'::app_role)
  OR public.has_role(auth.uid(), 'logistics'::app_role)
);

-- No direct INSERT/UPDATE/DELETE for users - managed by edge functions with service role