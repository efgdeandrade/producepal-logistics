-- Add reply threading columns to email_inbox
ALTER TABLE public.email_inbox 
ADD COLUMN IF NOT EXISTS is_reply boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_email_id uuid REFERENCES public.email_inbox(id),
ADD COLUMN IF NOT EXISTS reply_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reply_message_id text;

-- Create index for thread lookups
CREATE INDEX IF NOT EXISTS idx_email_inbox_parent_email_id ON public.email_inbox(parent_email_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_thread_id ON public.email_inbox(thread_id);