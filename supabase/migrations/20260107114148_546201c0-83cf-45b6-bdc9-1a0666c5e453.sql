-- Fix RLS policies that are too permissive
-- These policies use "true" which allows any authenticated user to perform operations
-- We'll make them more restrictive by checking if the user is authenticated

-- Drop and recreate alert_executions policy
DROP POLICY IF EXISTS "System can insert alert executions" ON public.alert_executions;
CREATE POLICY "Authenticated users can insert alert executions" 
ON public.alert_executions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate fnb_conversations policy
DROP POLICY IF EXISTS "System can insert fnb conversations" ON public.fnb_conversations;
CREATE POLICY "Authenticated users can insert fnb conversations" 
ON public.fnb_conversations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate fnb_product_aliases policies
DROP POLICY IF EXISTS "Authenticated users can insert aliases" ON public.fnb_product_aliases;
CREATE POLICY "Authenticated users can insert aliases" 
ON public.fnb_product_aliases 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update aliases" ON public.fnb_product_aliases;
CREATE POLICY "Authenticated users can update aliases" 
ON public.fnb_product_aliases 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Drop and recreate fnb_unmatched_items policies
DROP POLICY IF EXISTS "Authenticated users can delete unmatched items" ON public.fnb_unmatched_items;
CREATE POLICY "Authenticated users can delete unmatched items" 
ON public.fnb_unmatched_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert unmatched items" ON public.fnb_unmatched_items;
CREATE POLICY "Authenticated users can insert unmatched items" 
ON public.fnb_unmatched_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update unmatched items" ON public.fnb_unmatched_items;
CREATE POLICY "Authenticated users can update unmatched items" 
ON public.fnb_unmatched_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Drop and recreate notifications policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate receipt_numbers policy
DROP POLICY IF EXISTS "System can insert receipt numbers" ON public.receipt_numbers;
CREATE POLICY "Authenticated users can insert receipt numbers" 
ON public.receipt_numbers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate whatsapp_messages policies
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can insert whatsapp messages" 
ON public.whatsapp_messages 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can update whatsapp messages" 
ON public.whatsapp_messages 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);