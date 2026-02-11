
-- Fix the view to use SECURITY INVOKER (default for views, but let's be explicit)
DROP VIEW IF EXISTS public.profiles_directory;

CREATE VIEW public.profiles_directory 
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_directory TO authenticated;
