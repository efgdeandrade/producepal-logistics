-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for email-attachments bucket
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'email-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view email attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete email attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'email-attachments' AND auth.role() = 'authenticated');