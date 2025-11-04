-- Fix RLS policies to restrict public data exposure
-- This migration addresses critical security vulnerabilities where sensitive data
-- is publicly accessible due to overly permissive RLS policies

-- 1. Fix profiles table - restrict user email visibility
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));


-- 2. Fix suppliers table - require authentication to view supplier data
DROP POLICY IF EXISTS "Users can view all suppliers" ON public.suppliers;

CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- 3. Fix user_roles table - restrict role visibility
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));


-- 4. Fix orders table - require authentication to view orders
DROP POLICY IF EXISTS "Users can view all orders" ON public.orders;

CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- 5. Fix order_items table - require authentication to view order items
DROP POLICY IF EXISTS "Users can view all order items" ON public.order_items;

CREATE POLICY "Authenticated users can view order items"
  ON public.order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- 6. Fix products table - require authentication to view products
DROP POLICY IF EXISTS "Users can view all products" ON public.products;

CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);