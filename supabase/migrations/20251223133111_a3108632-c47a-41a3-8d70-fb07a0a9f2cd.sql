-- Add admin role to the owner account
INSERT INTO public.user_roles (user_id, role)
VALUES ('3959d842-9a22-489e-9cba-b0ffd95f4edf', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create a bootstrap function for future fresh instances
CREATE OR REPLACE FUNCTION public.claim_initial_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if any admin exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An admin already exists. Cannot claim initial admin.';
  END IF;
  
  -- Assign admin role to the current user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin');
END;
$$;