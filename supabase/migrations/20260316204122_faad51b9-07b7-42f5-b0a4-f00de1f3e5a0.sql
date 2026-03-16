
ALTER TABLE dre_conversations
  ADD COLUMN IF NOT EXISTS agent_state jsonb DEFAULT '{"phase":"idle"}',
  ADD COLUMN IF NOT EXISTS last_agent_state_at timestamptz;

ALTER TABLE distribution_orders
  ADD COLUMN IF NOT EXISTS agent_state_snapshot jsonb;
