-- ═══════════════════════════════════════════
-- PAPIAMENTU TRAINING KNOWLEDGE BASE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS papiamentu_training_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_question text NOT NULL,
  kathy_response text NOT NULL,
  corrected_phrase text,
  category text NOT NULL,
  language_from text DEFAULT 'papiamentu',
  example_context text,
  confidence_score numeric DEFAULT 0.5,
  times_used integer DEFAULT 0,
  times_corrected integer DEFAULT 0,
  flagged_for_review boolean DEFAULT false,
  flagged_by uuid REFERENCES profiles(id),
  flagged_reason text,
  added_by text DEFAULT 'kathy',
  audio_url text,
  transcription text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_training_entry_category()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('vocabulary','grammar','sales_phrase','slang','objection_handling','greeting','product_name','unit_name','other') THEN
    RAISE EXCEPTION 'Invalid category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_training_entry_category_trigger
  BEFORE INSERT OR UPDATE ON papiamentu_training_entries
  FOR EACH ROW EXECUTE FUNCTION validate_training_entry_category();

CREATE OR REPLACE FUNCTION public.validate_training_entry_confidence()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.confidence_score < 0 OR NEW.confidence_score > 1 THEN
    RAISE EXCEPTION 'confidence_score must be between 0 and 1';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_training_entry_confidence_trigger
  BEFORE INSERT OR UPDATE ON papiamentu_training_entries
  FOR EACH ROW EXECUTE FUNCTION validate_training_entry_confidence();

ALTER TABLE papiamentu_training_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY pap_training_read ON papiamentu_training_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY pap_training_insert ON papiamentu_training_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pap_training_update ON papiamentu_training_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY pap_training_delete ON papiamentu_training_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text IN ('admin')));

-- ═══════════════════════════════════════════
-- DAILY TRAINING SESSIONS
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS papiamentu_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  questions_sent integer DEFAULT 0,
  responses_received integer DEFAULT 0,
  entries_created integer DEFAULT 0,
  status text DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text
);

CREATE OR REPLACE FUNCTION public.validate_training_session_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','in_progress','completed','failed') THEN
    RAISE EXCEPTION 'Invalid session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_training_session_status_trigger
  BEFORE INSERT OR UPDATE ON papiamentu_training_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_training_session_status();

ALTER TABLE papiamentu_training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pap_sessions_read ON papiamentu_training_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY pap_sessions_write ON papiamentu_training_sessions FOR ALL TO authenticated USING (true);

-- ═══════════════════════════════════════════
-- INDIVIDUAL TRAINING QUESTIONS PER SESSION
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS papiamentu_training_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES papiamentu_training_sessions(id),
  question_number integer NOT NULL,
  category text NOT NULL,
  question_text text NOT NULL,
  context text,
  audio_url text,
  kathy_response_text text,
  kathy_response_audio_url text,
  kathy_response_transcription text,
  responded_at timestamptz,
  entry_id uuid REFERENCES papiamentu_training_entries(id),
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_training_question_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('sent','responded','skipped','entry_created') THEN
    RAISE EXCEPTION 'Invalid question status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_training_question_status_trigger
  BEFORE INSERT OR UPDATE ON papiamentu_training_questions
  FOR EACH ROW EXECUTE FUNCTION validate_training_question_status();

ALTER TABLE papiamentu_training_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pap_questions_read ON papiamentu_training_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY pap_questions_write ON papiamentu_training_questions FOR ALL TO authenticated USING (true);

-- Add Kathy settings to app_settings
INSERT INTO app_settings (key, value) VALUES
  ('kathy_telegram_chat_id', ''),
  ('training_schedule_time', '09:00'),
  ('training_questions_per_day', '15'),
  ('tts_voice', 'nova')
ON CONFLICT (key) DO NOTHING;

-- Add confidence boosting column
ALTER TABLE distribution_ai_match_logs
  ADD COLUMN IF NOT EXISTS boosted_entry_id uuid REFERENCES papiamentu_training_entries(id);