-- ============================================
-- CalmPlan - File Management System Setup
-- Run this in Supabase SQL Editor (one time)
-- ============================================

-- Note: File metadata is stored in the existing app_data table
-- under the 'file_metadata' collection (same JSONB pattern).
-- This script adds optional indexes and the storage bucket setup.

-- Index for fast file lookups by client_id within file_metadata collection
CREATE INDEX IF NOT EXISTS idx_file_metadata_client
  ON app_data ((data->>'client_id'))
  WHERE collection = 'file_metadata';

-- Index for document type filtering
CREATE INDEX IF NOT EXISTS idx_file_metadata_doc_type
  ON app_data ((data->>'document_type'))
  WHERE collection = 'file_metadata';

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_file_metadata_status
  ON app_data ((data->>'status'))
  WHERE collection = 'file_metadata';

-- ============================================
-- Storage bucket for client files
-- ============================================
-- The bucket 'calmplan-files' already exists.
-- If you want a separate bucket for organized client files:

-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('client-files', 'client-files', false, 52428800)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RLS Policies for storage (when auth is implemented)
-- ============================================
-- Uncomment and adapt these when you add real authentication:

-- -- Allow authenticated users to upload files
-- CREATE POLICY "authenticated_upload" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'calmplan-files');

-- -- Allow authenticated users to read files
-- CREATE POLICY "authenticated_read" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'calmplan-files');

-- -- Allow authenticated users to delete their own files
-- CREATE POLICY "authenticated_delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (bucket_id = 'calmplan-files');

-- ============================================
-- File metadata schema reference (stored as JSONB in app_data)
-- ============================================
-- {
--   "client_id": "string",          -- FK to client
--   "client_name": "string",        -- Denormalized for display
--   "file_name": "string",          -- Original filename
--   "file_path": "string",          -- Storage path in bucket
--   "file_url": "string",           -- Signed URL
--   "file_size": number,            -- Size in bytes
--   "file_type": "string",          -- MIME type
--   "document_type": "string",      -- contract|monthly_report|payslip|correspondence|other
--   "year": "string",               -- e.g. "2026"
--   "month": "string",              -- e.g. "01"-"12" or null
--   "status": "string",             -- draft|final|pending_approval|approved
--   "notes": "string",              -- Free text notes
--   "uploaded_by": "string",        -- User name
--   "version": number,              -- Version number (1, 2, 3...)
--   "parent_file_id": "string",     -- For versioning - points to original file
--   "tags": ["string"],             -- Additional tags
-- }
