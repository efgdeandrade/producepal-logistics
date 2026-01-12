-- Create a function to check permissions from the role_permissions table
CREATE OR REPLACE FUNCTION public.check_permission(
  _resource text,
  _action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role::text = rp.role::text
    WHERE ur.user_id = auth.uid()
      AND rp.resource = _resource
      AND (
        CASE _action
          WHEN 'view' THEN rp.can_view
          WHEN 'create' THEN rp.can_create
          WHEN 'update' THEN rp.can_update
          WHEN 'delete' THEN rp.can_delete
          ELSE false
        END
      )
  )
  OR public.has_role(auth.uid(), 'admin')
$$;

-- Drop old restrictive policies on customers table
DROP POLICY IF EXISTS "Admins and management can manage customers" ON customers;
DROP POLICY IF EXISTS "Authorized roles can view customers" ON customers;
DROP POLICY IF EXISTS "Users with data view permission can view customers" ON customers;
DROP POLICY IF EXISTS "Users with data create permission can insert customers" ON customers;
DROP POLICY IF EXISTS "Users with data update permission can update customers" ON customers;
DROP POLICY IF EXISTS "Users with data delete permission can delete customers" ON customers;

-- Create new policies for customers using check_permission
CREATE POLICY "Users with data view permission can view customers"
ON customers FOR SELECT TO authenticated
USING (public.check_permission('data', 'view'));

CREATE POLICY "Users with data create permission can insert customers"
ON customers FOR INSERT TO authenticated
WITH CHECK (public.check_permission('data', 'create'));

CREATE POLICY "Users with data update permission can update customers"
ON customers FOR UPDATE TO authenticated
USING (public.check_permission('data', 'update'));

CREATE POLICY "Users with data delete permission can delete customers"
ON customers FOR DELETE TO authenticated
USING (public.check_permission('data', 'delete'));

-- Drop old restrictive policies on fnb_customers table
DROP POLICY IF EXISTS "Admins and management can manage fnb_customers" ON fnb_customers;
DROP POLICY IF EXISTS "Authorized roles can view fnb_customers" ON fnb_customers;
DROP POLICY IF EXISTS "Users with data view permission can view fnb_customers" ON fnb_customers;
DROP POLICY IF EXISTS "Users with data create permission can insert fnb_customers" ON fnb_customers;
DROP POLICY IF EXISTS "Users with data update permission can update fnb_customers" ON fnb_customers;
DROP POLICY IF EXISTS "Users with data delete permission can delete fnb_customers" ON fnb_customers;

-- Create new policies for fnb_customers using check_permission
CREATE POLICY "Users with data view permission can view fnb_customers"
ON fnb_customers FOR SELECT TO authenticated
USING (public.check_permission('data', 'view'));

CREATE POLICY "Users with data create permission can insert fnb_customers"
ON fnb_customers FOR INSERT TO authenticated
WITH CHECK (public.check_permission('data', 'create'));

CREATE POLICY "Users with data update permission can update fnb_customers"
ON fnb_customers FOR UPDATE TO authenticated
USING (public.check_permission('data', 'update'));

CREATE POLICY "Users with data delete permission can delete fnb_customers"
ON fnb_customers FOR DELETE TO authenticated
USING (public.check_permission('data', 'delete'));