-- Projects module — Phase 4c: retire legacy `due_date` column.
--
-- Phase 1 (#412) added `start_date` + `end_date` to `project_tasks`
-- and backfilled both from `due_date`. Phase 2 (#413) introduced
-- dual-write in `addTask` / `updateTask` so every edit since then has
-- kept the two fields in sync (with `end_date` as the source of
-- truth). By the time this runs in prod, every row's `end_date`
-- already reflects what `due_date` would carry, so dropping the
-- column is data-safe.
--
-- Idempotent (re-runnable) via DROP COLUMN IF EXISTS — a partial
-- apply that drops the column on attempt 1 turns the re-attempt into
-- a no-op instead of a P3009 stuck-migration.

ALTER TABLE "project_tasks"
  DROP COLUMN IF EXISTS "due_date";
