-- 1. Fix message type constraint to allow all WhatsApp message types
ALTER TABLE public.whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;

ALTER TABLE public.whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_message_type_check 
CHECK (message_type IS NULL OR message_type IN (
  'text', 'image', 'document', 'order', 'template', 
  'audio', 'video', 'location', 'contact', 'sticker', 
  'reaction', 'button', 'interactive'
));

-- 2. Add read tracking columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS read_by uuid REFERENCES public.profiles(id);

-- 3. Add missing columns to distribution_orders for WhatsApp orders
ALTER TABLE public.distribution_orders 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS requested_delivery_time text,
ADD COLUMN IF NOT EXISTS has_special_requirements boolean DEFAULT false;

-- 4. Create team notification settings table
CREATE TABLE IF NOT EXISTS public.team_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  whatsapp_phone text NOT NULL,
  display_name text,
  role text DEFAULT 'sales',
  notify_on_new_orders boolean DEFAULT true,
  notify_on_escalations boolean DEFAULT true,
  notify_on_complaints boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Enable RLS on team_notification_settings
ALTER TABLE public.team_notification_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for team_notification_settings
CREATE POLICY "Authenticated users can view team notification settings"
ON public.team_notification_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage team notification settings"
ON public.team_notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_read_tracking 
ON public.whatsapp_messages(direction, read_at) 
WHERE direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_distribution_orders_source 
ON public.distribution_orders(source);

CREATE INDEX IF NOT EXISTS idx_team_notification_settings_active 
ON public.team_notification_settings(is_active) 
WHERE is_active = true;

-- 8. Enable realtime for team notification settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_notification_settings;