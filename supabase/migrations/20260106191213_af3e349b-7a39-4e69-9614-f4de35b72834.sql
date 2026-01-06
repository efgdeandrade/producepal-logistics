-- Add break_started_at column to time_entries for tracking active breaks
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS break_started_at TIMESTAMPTZ;