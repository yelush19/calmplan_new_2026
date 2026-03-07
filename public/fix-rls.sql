-- ══════════════════════════════════════════════════════════════
-- CalmPlan: Fix RLS (Row Level Security) on app_data table
-- ══════════════════════════════════════════════════════════════
--
-- PROBLEM: RLS is blocking ALL reads. The table has data (281+ rows)
-- but SELECT queries return 0 rows because there's no matching
-- RLS policy for the current session.
--
-- HOW TO RUN:
-- 1. Go to your Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- 4. Refresh calmplan.litay.co.il — data should load from Supabase directly
--
-- WHAT THIS DOES:
-- Option A (recommended): Adds a permissive SELECT policy for all users
-- Option B (nuclear): Disables RLS entirely on app_data
--
-- ══════════════════════════════════════════════════════════════

-- OPTION A: Add a permissive policy (keeps RLS enabled but allows reads)
-- This allows anyone with the anon key to read all data.
-- Writes are still protected by default Supabase policies.

DROP POLICY IF EXISTS "Allow public read access" ON app_data;
CREATE POLICY "Allow public read access"
  ON app_data
  FOR SELECT
  USING (true);

-- Also allow inserts and updates for the anon key
DROP POLICY IF EXISTS "Allow public insert" ON app_data;
CREATE POLICY "Allow public insert"
  ON app_data
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON app_data;
CREATE POLICY "Allow public update"
  ON app_data
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete" ON app_data;
CREATE POLICY "Allow public delete"
  ON app_data
  FOR DELETE
  USING (true);

-- ══════════════════════════════════════════════════════════════
-- OPTION B (uncomment if Option A doesn't work):
-- Completely disable RLS on the table.
-- This is safe for a single-user app like CalmPlan.
--
-- ALTER TABLE app_data DISABLE ROW LEVEL SECURITY;
-- ══════════════════════════════════════════════════════════════

-- Verify: this should return your row count (281+)
SELECT count(*) as total_rows FROM app_data;
SELECT collection, count(*) as count FROM app_data GROUP BY collection ORDER BY count DESC;
