-- Add customer_type enum
CREATE TYPE public.customer_type AS ENUM ('regular', 'supermarket', 'cod', 'credit');

-- Add customer_type to fnb_customers
ALTER TABLE public.fnb_customers 
ADD COLUMN customer_type public.customer_type NOT NULL DEFAULT 'regular';

-- Add payment_method enum for COD tracking
CREATE TYPE public.payment_method_type AS ENUM ('cash', 'swipe', 'transfer', 'credit');

-- Add receipt and payment tracking to fnb_orders
ALTER TABLE public.fnb_orders 
ADD COLUMN receipt_photo_url TEXT,
ADD COLUMN receipt_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN receipt_verified_by UUID,
ADD COLUMN payment_method_used public.payment_method_type;

-- Create storage bucket for receipt photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-receipts', 'delivery-receipts', false);

-- Storage policies for receipt photos
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-receipts');

CREATE POLICY "Authenticated users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-receipts');

CREATE POLICY "Management can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-receipts' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
);