
-- Add unique constraint on customer_phone for upsert to work correctly
ALTER TABLE distribution_order_sessions
ADD CONSTRAINT distribution_order_sessions_customer_phone_key UNIQUE (customer_phone);

-- Add index for faster lookups on status and expires_at
CREATE INDEX IF NOT EXISTS idx_order_sessions_status_expires 
ON distribution_order_sessions(status, expires_at) 
WHERE status = 'pending_confirmation';
