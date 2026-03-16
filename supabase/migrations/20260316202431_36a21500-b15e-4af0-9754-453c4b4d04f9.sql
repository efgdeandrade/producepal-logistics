
ALTER TABLE distribution_ai_match_logs
  ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES dre_conversations(id),
  ADD COLUMN IF NOT EXISTS dre_reply text,
  ADD COLUMN IF NOT EXISTS needs_language_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrected_reply text,
  ADD COLUMN IF NOT EXISTS reply_corrected_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reply_corrected_at timestamptz;
