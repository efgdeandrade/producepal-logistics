-- Add payment tracking to bills table
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_date date,
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;

-- Create import documents table
CREATE TABLE IF NOT EXISTS import_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  category text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  notes text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on import_documents
ALTER TABLE import_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_documents
CREATE POLICY "Authenticated users can view import documents"
ON import_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert import documents"
ON import_documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update import documents"
ON import_documents FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete import documents"
ON import_documents FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_import_documents_updated_at
BEFORE UPDATE ON import_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for import documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-documents', 'import-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for import-documents bucket
CREATE POLICY "Authenticated users can upload import documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'import-documents');

CREATE POLICY "Authenticated users can view import documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'import-documents');

CREATE POLICY "Authenticated users can delete import documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'import-documents');