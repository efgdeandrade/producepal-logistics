-- Add team member fields to profiles for WhatsApp group functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
ADD COLUMN IF NOT EXISTS team_role TEXT,
ADD COLUMN IF NOT EXISTS is_fuik_team BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"order_modifications": true, "price_negotiations": true, "complaints": true}'::jsonb;

-- Create index for quick phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone ON public.profiles(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_role ON public.profiles(team_role) WHERE is_fuik_team = true;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.whatsapp_phone IS 'WhatsApp phone number for team member tagging in group chats';
COMMENT ON COLUMN public.profiles.team_role IS 'Role: logistics, management, accounting, sales';
COMMENT ON COLUMN public.profiles.is_fuik_team IS 'Whether this user is a FUIK team member';
COMMENT ON COLUMN public.profiles.notification_preferences IS 'Which escalation types this team member should be tagged for';