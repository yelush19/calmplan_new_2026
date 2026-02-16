-- ============================================
-- CalmPlan - Supabase Setup
-- Run this in Supabase SQL Editor (one time)
-- ============================================

-- Generic data table - stores all entities as JSONB
-- No need to create separate tables for each entity type
CREATE TABLE IF NOT EXISTS app_data (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

-- Index for fast collection queries
CREATE INDEX IF NOT EXISTS idx_app_data_collection ON app_data (collection);
CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data (updated_date DESC);

-- Enable Row Level Security (optional - can add auth later)
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required)
-- IMPORTANT: Update this policy when you add authentication
CREATE POLICY "allow_all" ON app_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_date on changes
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_date
  BEFORE UPDATE ON app_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_date();
