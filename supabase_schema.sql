-- =============================================================
-- CalmPlan - Supabase Schema
-- Run this SQL in Supabase Dashboard > SQL Editor
-- =============================================================

-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS app_data;

-- Main data table: stores ALL entities in a single generic table
-- Each row = one record. The "collection" column identifies the entity type.
-- The "data" column stores the full record as JSONB.
CREATE TABLE app_data (
  id          TEXT        NOT NULL,
  collection  TEXT        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite primary key: each (collection, id) pair is unique
  PRIMARY KEY (collection, id)
);

-- Index for fast collection-level queries
CREATE INDEX idx_app_data_collection ON app_data (collection);

-- Index for date-based sorting within collections
CREATE INDEX idx_app_data_created ON app_data (collection, created_date);

-- GIN index for fast JSONB queries (filtering on data fields)
CREATE INDEX idx_app_data_data ON app_data USING GIN (data);

-- =============================================================
-- Row Level Security (RLS)
-- For this app we allow all operations (anon key = full access)
-- =============================================================
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Allow all operations for the anon role (single-user desktop app)
CREATE POLICY "Allow all for anon" ON app_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant full access to anon and authenticated roles
GRANT ALL ON app_data TO anon;
GRANT ALL ON app_data TO authenticated;

-- =============================================================
-- Collections that will be stored in this table:
-- =============================================================
-- events              - Calendar events
-- tasks               - Tasks
-- task_sessions       - Work session tracking
-- day_schedules       - Daily schedule plans
-- weekly_recommendations - Weekly AI recommendations
-- clients             - Client records
-- dashboards          - Dashboard configurations
-- account_reconciliations - Bank reconciliation records
-- invoices            - Invoice tracking
-- service_providers   - External service providers
-- client_contacts     - Client contact persons
-- client_service_providers - Client-provider relationships
-- client_accounts     - Bank accounts per client
-- service_companies   - Service company records
-- leads               - Sales leads
-- roadmap_items       - Product/project roadmap
-- weekly_schedules    - Weekly schedule templates
-- family_members      - Family member records
-- daily_mood_checks   - Daily mood tracking
-- therapists          - Therapist records
-- tax_reports         - Current year tax reports
-- tax_reports_2025    - 2025 tax reports
-- tax_reports_2024    - 2024 tax reports
-- weekly_tasks        - Weekly task assignments
-- balance_sheets      - Annual balance sheets
-- sticky_notes        - Quick sticky notes
-- projects            - Project tracking
-- system_config       - System configuration
-- periodic_reports    - Periodic summary reports
-- file_metadata       - File attachment metadata
-- backup_snapshots    - Backup snapshots (auto-managed)
-- =============================================================
