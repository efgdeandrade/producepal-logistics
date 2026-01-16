-- Add missing columns for email order processing
ALTER TABLE email_inbox 
ADD COLUMN IF NOT EXISTS extracted_customer_name TEXT,
ADD COLUMN IF NOT EXISTS extracted_delivery_date DATE,
ADD COLUMN IF NOT EXISTS extracted_po_number TEXT,
ADD COLUMN IF NOT EXISTS extraction_notes TEXT,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;