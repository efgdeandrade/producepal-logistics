-- Fix employee-photos storage bucket: make it private (require authentication)
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view employee photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'employee-photos');

-- Also update the bucket to be private (not publicly accessible)
UPDATE storage.buckets
SET public = false
WHERE id = 'employee-photos';