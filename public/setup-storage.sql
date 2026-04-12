-- ══════════════════════════════════════════════════════════════
-- CalmPlan: Setup Storage RLS Policies for "calmplan-files" bucket
-- ══════════════════════════════════════════════════════════════
--
-- PROBLEM: After creating the "calmplan-files" bucket manually in
-- Supabase Dashboard → Storage, file uploads still fail because
-- the bucket has 0 RLS policies. Without policies, the anon key
-- cannot upload, read, or delete files.
--
-- HOW TO RUN:
-- 1. Go to your Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- 4. Refresh CalmPlan and try uploading a file again
--
-- WHAT THIS DOES:
-- Adds permissive policies on storage.objects so the anon role
-- can upload, read, update, and delete files inside the
-- "calmplan-files" bucket. This matches the single-user app model
-- already used for the app_data table.
--
-- ══════════════════════════════════════════════════════════════

-- Allow anyone (anon) to read files from calmplan-files
DROP POLICY IF EXISTS "calmplan-files: public read" ON storage.objects;
CREATE POLICY "calmplan-files: public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'calmplan-files');

-- Allow anyone (anon) to upload files to calmplan-files
DROP POLICY IF EXISTS "calmplan-files: public insert" ON storage.objects;
CREATE POLICY "calmplan-files: public insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'calmplan-files');

-- Allow anyone (anon) to update files in calmplan-files (for upserts)
DROP POLICY IF EXISTS "calmplan-files: public update" ON storage.objects;
CREATE POLICY "calmplan-files: public update"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'calmplan-files')
  WITH CHECK (bucket_id = 'calmplan-files');

-- Allow anyone (anon) to delete files from calmplan-files
DROP POLICY IF EXISTS "calmplan-files: public delete" ON storage.objects;
CREATE POLICY "calmplan-files: public delete"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'calmplan-files');

-- ══════════════════════════════════════════════════════════════
-- Verify: this should return 4 rows (one per policy created above)
-- ══════════════════════════════════════════════════════════════
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'calmplan-files%'
ORDER BY policyname;
