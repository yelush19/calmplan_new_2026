-- ============================================
-- CalmPlan - Supabase Setup Script
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Create the app_data table
CREATE TABLE IF NOT EXISTS app_data (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (collection, id)
);

-- 2. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_data_collection ON app_data (collection);
CREATE INDEX IF NOT EXISTS idx_app_data_created ON app_data (created_date);

-- 3. Enable Row Level Security (RLS) - required by Supabase
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- 4. Create a permissive policy for the anon key
-- (For a single-user app, this allows all operations)
CREATE POLICY "Allow all operations for anon" ON app_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Enable Realtime for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE app_data;

-- ✅ Done! Your CalmPlan app should now connect to Supabase.
