-- Projects — BD-feedback fields (May 2026):
--   * production_live        — boolean "is live in prod yet?"
--   * go_live_date           — original target go-live date
--   * revised_go_live_date   — current target after slips
--   * dependency             — free-text blocker / upstream dep
--   * comment                — free-text status note
--   * sort_order             — manual ordering (drag-to-reorder in list view)
--
-- Status taxonomy is also reset to BD's working set:
--   in_progress, completed, on_hold, not_yet_started,
--   staging_integrated, prod_integrated, uat
--
-- All ADDs use IF NOT EXISTS so the migration is safe to re-run after
-- a partial-apply. Status remap is a single UPDATE per old value, also
-- idempotent (re-running matches zero rows).

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "production_live"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "go_live_date"         DATE;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "revised_go_live_date" DATE;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dependency"           TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "comment"              TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "sort_order"           INTEGER NOT NULL DEFAULT 0;

-- Backfill sort_order so existing rows render in their current
-- (created_at DESC) order. Newest projects get sort_order = 0, oldest
-- get the highest value. Idempotent: only fires for rows still at the
-- default of 0 (every row first time, no row on re-run if any value
-- has been changed since).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn
  FROM "projects"
)
UPDATE "projects" p
SET    sort_order = ranked.rn
FROM   ranked
WHERE  p.id = ranked.id
  AND  p.sort_order = 0
  AND  ranked.rn <> 0;

-- Remap legacy status values onto the new BD taxonomy. Idempotent: the
-- WHERE clause is empty after the first run.
UPDATE "projects" SET status = 'not_yet_started' WHERE status = 'planning';
UPDATE "projects" SET status = 'in_progress'     WHERE status = 'active';
UPDATE "projects" SET status = 'completed'       WHERE status = 'archived';

-- Update column default so newly-created projects start in the BD-default
-- status. Old default was 'planning'.
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'not_yet_started';

CREATE INDEX IF NOT EXISTS "projects_sort_order_idx" ON "projects"("sort_order");
