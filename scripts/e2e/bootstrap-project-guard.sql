-- Run this once, manually, only after confirming both database URLs belong to
-- the dedicated hosted Supabase project named manut-intranet-e2e. The runtime
-- reset refuses to proceed without this marker.
CREATE SCHEMA IF NOT EXISTS e2e_control;
REVOKE ALL ON SCHEMA e2e_control FROM PUBLIC;

CREATE TABLE IF NOT EXISTS e2e_control.project_guard (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  project_name TEXT NOT NULL CHECK (project_name = 'manut-intranet-e2e'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO e2e_control.project_guard (singleton, project_name)
VALUES (TRUE, 'manut-intranet-e2e')
ON CONFLICT (singleton) DO UPDATE
SET project_name = EXCLUDED.project_name;

