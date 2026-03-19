ALTER TABLE anomaly_log ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
ALTER TABLE anomaly_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();