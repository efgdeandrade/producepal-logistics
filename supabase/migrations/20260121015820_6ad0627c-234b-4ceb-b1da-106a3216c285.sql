-- Backfill missing attachment records from storage objects
-- This creates records for PDFs already uploaded to storage but not recorded in the database

INSERT INTO email_inbox_attachments (email_id, filename, mime_type, storage_path, size_bytes)
SELECT 
  ei.id as email_id,
  split_part(so.name, '/', 2) as filename,
  COALESCE(so.metadata->>'mimetype', 'application/pdf') as mime_type,
  so.name as storage_path,
  COALESCE((so.metadata->>'size')::integer, 0) as size_bytes
FROM storage.objects so
JOIN email_inbox ei ON ei.message_id = split_part(so.name, '/', 1)
WHERE so.bucket_id = 'email-attachments'
  AND NOT EXISTS (
    SELECT 1 FROM email_inbox_attachments ea 
    WHERE ea.email_id = ei.id AND ea.storage_path = so.name
  );