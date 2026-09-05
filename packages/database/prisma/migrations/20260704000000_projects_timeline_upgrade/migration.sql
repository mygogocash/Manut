-- Projects module — Notion-style timeline upgrade (Phase 1: schema only).
--
-- Adds:
--   • project_milestones                  — optional grouping above tasks
--   • project_tasks.milestone_id          — task ↔ milestone link (nullable)
--   • project_tasks.start_date/end_date   — date range for timeline view
--   • project_task_assignees              — multi-assign join + allocation %
--   • project_task_dependencies           — blocking/blocked-by graph
--   • project_task_resources              — files / links / doc refs
--
-- Idempotent (re-runnable). Backfills `start_date` / `end_date` from
-- existing `due_date` and seeds `project_task_assignees` from the
-- legacy single `owner_id` so the multi-assign view has data on day 1.

-- ─── ProjectTask new columns ─────────────────────────────────────────

ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "milestone_id" UUID,
  ADD COLUMN IF NOT EXISTS "start_date"   DATE,
  ADD COLUMN IF NOT EXISTS "end_date"     DATE;

-- ─── project_milestones ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_milestones" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id"  TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "description" TEXT,
    "status"      TEXT         NOT NULL DEFAULT 'not_started',
    "owner_id"    UUID,
    "start_date"  DATE,
    "end_date"    DATE,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_milestones_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "project_milestones_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id")
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "project_milestones_project_id_idx"
    ON "project_milestones" ("project_id");

-- ─── project_tasks.milestone_id FK + index ───────────────────────────

DO $$ BEGIN
  ALTER TABLE "project_tasks"
    ADD CONSTRAINT "project_tasks_milestone_id_fkey"
    FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id")
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "project_tasks_milestone_id_idx"
    ON "project_tasks" ("milestone_id");

-- ─── project_task_assignees ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_task_assignees" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"        UUID         NOT NULL,
    "user_id"        UUID         NOT NULL,
    "allocation_pct" INTEGER,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_task_assignees_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "project_task_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_task_assignees_task_user_key"
    ON "project_task_assignees" ("task_id", "user_id");
CREATE INDEX IF NOT EXISTS "project_task_assignees_task_id_idx"
    ON "project_task_assignees" ("task_id");
CREATE INDEX IF NOT EXISTS "project_task_assignees_user_id_idx"
    ON "project_task_assignees" ("user_id");

-- ─── project_task_dependencies ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_task_dependencies" (
    "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"            UUID         NOT NULL,
    "depends_on_task_id" UUID         NOT NULL,
    "type"               TEXT         NOT NULL DEFAULT 'finish_to_start',
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_task_dependencies_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "project_task_dependencies_depends_on_task_id_fkey"
        FOREIGN KEY ("depends_on_task_id") REFERENCES "project_tasks"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_task_dependencies_pair_key"
    ON "project_task_dependencies" ("task_id", "depends_on_task_id");
CREATE INDEX IF NOT EXISTS "project_task_dependencies_task_id_idx"
    ON "project_task_dependencies" ("task_id");
CREATE INDEX IF NOT EXISTS "project_task_dependencies_depends_on_task_id_idx"
    ON "project_task_dependencies" ("depends_on_task_id");

-- ─── project_task_resources ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_task_resources" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"    UUID         NOT NULL,
    "kind"       TEXT         NOT NULL,
    "label"      TEXT         NOT NULL,
    "url"        TEXT         NOT NULL,
    "doc_id"     UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID         NOT NULL,
    CONSTRAINT "project_task_resources_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "project_task_resources_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_task_resources_task_id_idx"
    ON "project_task_resources" ("task_id");

-- ─── Backfill ────────────────────────────────────────────────────────

-- Existing tasks only had `due_date`. Seed both range fields with it
-- so the new timeline view renders zero-width bars on the due date
-- instead of dropping rows. Range refinements come later via the API.
UPDATE "project_tasks"
   SET "start_date" = "due_date",
       "end_date"   = "due_date"
 WHERE "due_date" IS NOT NULL
   AND "start_date" IS NULL
   AND "end_date"   IS NULL;

-- Mirror legacy single-owner into the multi-assign table. Skips rows
-- with NULL owner_id and skips inserts that would violate the unique
-- (task_id, user_id) constraint so re-running is safe.
INSERT INTO "project_task_assignees" ("task_id", "user_id")
SELECT t."id", t."owner_id"
  FROM "project_tasks" t
 WHERE t."owner_id" IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;
