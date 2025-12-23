-- Create a security definer function to safely update user roles
-- This prevents RLS issues when an admin edits their own roles
CREATE OR REPLACE FUNCTION public.update_user_roles(
  target_user_id uuid,
  new_roles app_role[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First verify the calling user is an admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;
  
  -- Delete existing roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Insert new roles if any provided
  IF array_length(new_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT target_user_id, unnest(new_roles);
  END IF;
END;
$$;