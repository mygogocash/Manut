-- IT CRM Intelligence dashboard — lifecycle / SLA / health fields.
--
-- Idempotent: every ADD COLUMN uses IF NOT EXISTS and each backfill is
-- guarded on the seed value (… IS NULL) so a re-run — or a value the app
-- writes later — is never clobbered. Safe to replay after a partial apply.

-- ── it_projects ────────────────────────────────────────────────────────
ALTER TABLE "it_projects" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);
ALTER TABLE "it_projects" ADD COLUMN IF NOT EXISTS "health_status" TEXT;
ALTER TABLE "it_projects" ADD COLUMN IF NOT EXISTS "effort_points" INTEGER;

-- Baseline stage-aging from updated_at so the first dashboard load isn't blank.
UPDATE "it_projects" SET "status_changed_at" = "updated_at" WHERE "status_changed_at" IS NULL;

-- Seed a starting RAG health so the heat-map exhibit has data on day one:
--   green  = already terminal (delivered)
--   red    = active AND (slipped go-live OR a blocker/dependency noted)
--   yellow = everything else still in flight
-- Order matters (green → red → yellow); each step only fills rows still null.
UPDATE "it_projects" SET "health_status" = 'green'
  WHERE "health_status" IS NULL
    AND "status" IN ('completed', 'prod_integrated', 'closed', 'cancelled');
UPDATE "it_projects" SET "health_status" = 'red'
  WHERE "health_status" IS NULL
    AND "status" NOT IN ('completed', 'prod_integrated', 'closed', 'cancelled')
    AND ("revised_go_live_date" IS NOT NULL OR "dependency" IS NOT NULL OR "comment" IS NOT NULL);
UPDATE "it_projects" SET "health_status" = 'yellow' WHERE "health_status" IS NULL;

-- ── it_project_tasks ───────────────────────────────────────────────────
ALTER TABLE "it_project_tasks" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);
ALTER TABLE "it_project_tasks" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "it_project_tasks" ADD COLUMN IF NOT EXISTS "effort_points" INTEGER;

UPDATE "it_project_tasks" SET "status_changed_at" = "updated_at" WHERE "status_changed_at" IS NULL;
-- Tasks already in the terminal `done` column get a best-effort completion
-- time of updated_at (the status flip is usually the last edit). Guarded so
-- a precise value the app stamps later wins on re-run.
UPDATE "it_project_tasks" SET "completed_at" = "updated_at"
  WHERE "completed_at" IS NULL AND "status" = 'done';

-- ── helpdesk_tickets ───────────────────────────────────────────────────
ALTER TABLE "helpdesk_tickets" ADD COLUMN IF NOT EXISTS "first_response_at" TIMESTAMP(3);
ALTER TABLE "helpdesk_tickets" ADD COLUMN IF NOT EXISTS "reopened_count" INTEGER NOT NULL DEFAULT 0;
-- Deliberately no first_response_at backfill: we can't know historically
-- when IT first engaged, and a proxy (e.g. = resolved_at) would corrupt the
-- response-SLA metric. Attainment is computed only over tickets carrying a
-- real stamp going forward.
