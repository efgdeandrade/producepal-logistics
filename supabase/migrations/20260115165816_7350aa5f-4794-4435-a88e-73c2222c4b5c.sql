-- Fix whatsapp_messages RLS policies to restrict access to appropriate roles

-- Drop ALL existing policies on whatsapp_messages to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin and management can view whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin and management can update whatsapp messages" ON public.whatsapp_messages;

-- Create new policies with restricted access

-- Restrict SELECT to admin and management roles only
CREATE POLICY "whatsapp_msg_select_admin_mgmt"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'management')
  );

-- Keep INSERT for authenticated users (webhook uses service role which bypasses RLS)
CREATE POLICY "whatsapp_msg_insert_authenticated"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Restrict UPDATE to admin and management only
CREATE POLICY "whatsapp_msg_update_admin_mgmt"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
  );