
-- Fix profiles RLS: restrict full profile access to own profile + admins

-- Drop the overly permissive select policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create a directory view for non-admin users to see colleague names
CREATE OR REPLACE VIEW public.profiles_directory AS
SELECT 
  id,
  full_name,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_directory TO authenticated;
