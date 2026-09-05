-- BD-feedback round 7 (May 2026) — add an optional Department label on
-- Project so cross-department teams (Management / Marketing / HR /
-- Accounting / Product / Digital Social / BD / IT / Legal) can tag and
-- filter their projects from /projects. Nullable so historical rows
-- keep validating against the schema until BD backfills them.
--
-- `IF NOT EXISTS` keeps the migration safe to re-run after the schema
-- consolidation pattern we use across the repo.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "department" TEXT;

CREATE INDEX IF NOT EXISTS "projects_department_idx"
  ON "projects" ("department");
