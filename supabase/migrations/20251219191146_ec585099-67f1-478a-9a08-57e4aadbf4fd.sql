-- Add columns for processed receipt data
ALTER TABLE public.fnb_orders 
ADD COLUMN IF NOT EXISTS receipt_photo_processed_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_extracted_data JSONB;