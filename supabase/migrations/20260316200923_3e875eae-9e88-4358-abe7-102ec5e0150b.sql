
-- Papiamentu language terms table
CREATE TABLE IF NOT EXISTS dre_language_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  language text NOT NULL CHECK (language IN ('papiamentu','dutch','spanish','english')),
  translation_en text NOT NULL,
  category text CHECK (category IN ('produce','unit','greeting','confirmation','other')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dre_language_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY dre_terms_read ON dre_language_terms FOR SELECT TO authenticated USING (true);

CREATE POLICY dre_terms_write ON dre_language_terms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  AND role IN ('director','right_hand','manager')));

-- Add awaiting_confirmation columns to distribution_orders
ALTER TABLE distribution_orders
  ADD COLUMN IF NOT EXISTS awaiting_customer_confirmation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by_customer_at timestamptz;
