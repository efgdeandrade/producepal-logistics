-- Add default_portal column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_portal TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.default_portal IS 'Preferred department portal: distribution, logistics, production, hr, import, executive';