
-- Activation codes for Telegram group setup
CREATE TABLE IF NOT EXISTS customer_telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES distribution_customers(id) ON DELETE CASCADE,
  activation_code text UNIQUE NOT NULL,
  group_chat_id text,
  group_name text,
  status text DEFAULT 'pending',
  activated_at timestamptz,
  welcome_sent_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION validate_telegram_group_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'activated', 'deactivated') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_telegram_group_status
  BEFORE INSERT OR UPDATE ON customer_telegram_groups
  FOR EACH ROW EXECUTE FUNCTION validate_telegram_group_status();

ALTER TABLE customer_telegram_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY tg_groups_read ON customer_telegram_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY tg_groups_write ON customer_telegram_groups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role IN ('admin', 'director', 'right_hand', 'manager')
  ));

CREATE POLICY tg_groups_update ON customer_telegram_groups FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role IN ('admin', 'director', 'right_hand', 'manager')
  ));

CREATE POLICY tg_groups_delete ON customer_telegram_groups FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role IN ('admin', 'director', 'right_hand', 'manager')
  ));
