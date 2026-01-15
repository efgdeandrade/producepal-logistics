-- Fix employee-photos bucket security
-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

-- Drop ALL existing policies for employee-photos bucket to avoid conflicts
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname ILIKE '%employee%photo%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
  END LOOP;
END $$;

-- Create new secure policies with unique names

-- 1. Authenticated users can view employee photos (required for the app to work)
CREATE POLICY "emp_photos_auth_view_v2"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-photos');

-- 2. HR and Admin can manage all photos (full CRUD)
CREATE POLICY "emp_photos_hr_admin_manage_v2"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
)
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
);

-- 3. Employees can upload their own photo (path: {user_id}/profile.*)
CREATE POLICY "emp_photos_self_upload_v2"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Employees can update their own photo
CREATE POLICY "emp_photos_self_update_v2"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);