-- Projects — team scoping (May 2026):
--
-- `team` segments project rows into independent workspaces:
--   * 'general' — BD dashboard at /projects (existing)
--   * 'it'      — IT Helpdesk → Projects tab
--
-- Adding NOT NULL DEFAULT 'general' is a cheap operation in Postgres 11+
-- (constant default avoids a table rewrite). Existing rows backfill to
-- 'general' so /projects keeps showing what it shows today.
--
-- Migration is idempotent via IF NOT EXISTS.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "team" TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS "projects_team_idx" ON "projects"("team");
