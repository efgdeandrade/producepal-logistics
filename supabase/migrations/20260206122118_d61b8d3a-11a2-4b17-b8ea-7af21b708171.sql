-- Add is_ignored column to distribution_ai_match_logs to mark non-product lines
ALTER TABLE public.distribution_ai_match_logs 
ADD COLUMN IF NOT EXISTS is_ignored boolean DEFAULT false;

-- Add index for quick filtering
CREATE INDEX IF NOT EXISTS idx_ai_match_logs_is_ignored ON public.distribution_ai_match_logs(is_ignored) WHERE is_ignored = true;