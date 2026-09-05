-- Sales CRM (2026-06-12): add the "Live" pipeline stage (revenue-live,
-- post Closed Won) and a manual within-column sort order for the kanban.
-- Idempotent (CLAUDE.md): safe to re-run.

-- 1. Within-column manual ordering for the pipeline board. DEFAULT 0 is
--    correct for every existing row; ties fall back to created_at desc.
ALTER TABLE "crm_opportunities"
  ADD COLUMN IF NOT EXISTS "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "crm_opportunities_stage_sort_order_within_stage_idx"
  ON "crm_opportunities" ("stage", "sort_order_within_stage");

-- Backfill a DISTINCT order per stage from the current display order
-- (created_at desc) so existing rows don't all collide at 0 (which would
-- let an un-reordered card jump above hand-ordered ones). Deterministic, so
-- a partial-apply re-run recomputes identical values. Runs only once via
-- migrate deploy; the WHERE guard skips it if any row was already ordered.
UPDATE "crm_opportunities" o
SET "sort_order_within_stage" = sub.rn
FROM (
  SELECT
    "id",
    (ROW_NUMBER() OVER (PARTITION BY "stage" ORDER BY "created_at" DESC) - 1) AS rn
  FROM "crm_opportunities"
) sub
WHERE o."id" = sub."id"
  AND NOT EXISTS (
    SELECT 1 FROM "crm_opportunities" WHERE "sort_order_within_stage" <> 0
  );

-- 2. Seed the "Live" stage config row. sort_order 45 places it between
--    Closed Won (40) and Closed Lost (50). Probability 100 — a live deal
--    is already won. ON CONFLICT keeps the insert idempotent.
INSERT INTO "opportunity_stage_config"
  ("key", "label", "probability", "sort_order", "color", "updated_at")
VALUES
  ('live', 'Live', 100, 45, 'border-t-violet-500', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
