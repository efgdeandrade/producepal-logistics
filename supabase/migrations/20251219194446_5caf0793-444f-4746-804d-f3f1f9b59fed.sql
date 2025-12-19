-- Add picker session and weight verification fields to fnb_picker_queue
ALTER TABLE public.fnb_picker_queue
ADD COLUMN IF NOT EXISTS picker_name text,
ADD COLUMN IF NOT EXISTS pick_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS verified_weight_kg numeric,
ADD COLUMN IF NOT EXISTS expected_weight_kg numeric;

-- Add shortage approval workflow fields to fnb_order_items
ALTER TABLE public.fnb_order_items
ADD COLUMN IF NOT EXISTS shortage_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shortage_approved_by uuid,
ADD COLUMN IF NOT EXISTS shortage_approved_at timestamp with time zone;

-- Create index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_fnb_picker_queue_picker_name ON public.fnb_picker_queue(picker_name);
CREATE INDEX IF NOT EXISTS idx_fnb_picker_queue_completed_at ON public.fnb_picker_queue(completed_at);