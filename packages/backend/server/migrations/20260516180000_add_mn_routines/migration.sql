-- Manut Routines (PR 1 of the Routines feature).
--
-- Named AI prompts with optional cron schedules. Created/managed via the
-- Manut UI; gated by ENABLE_MANUT_ROUTINES=true. Workspace-shared
-- routines are visible to all workspace members but write-protected to
-- owner-or-admin. Personal routines are visible only to the owner.
--
-- `anthropic_task_id`, `last_run_at`, `next_run_at` are populated by
-- PR-2 (Anthropic scheduled-tasks sync). `output` on the runs table is
-- populated by PR-4 (real execution against Vertex). v0 rows are stubs
-- so the schema doesn't need a follow-up migration when those land.
--
-- Forward-only. Rollback path:
--   DROP TABLE "mn_routine_runs";
--   DROP TABLE "mn_routines";
--   DROP TYPE "MnRoutineRunStatus";
--   DROP TYPE "MnRoutineRunTrigger";
--   DROP TYPE "MnRoutineStatus";
--   DROP TYPE "MnRoutineVisibility";
-- (R0 only if no rows exist; otherwise back up first).

CREATE TYPE "MnRoutineVisibility" AS ENUM ('PERSONAL', 'WORKSPACE_SHARED');
CREATE TYPE "MnRoutineStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');
CREATE TYPE "MnRoutineRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'MCP');
CREATE TYPE "MnRoutineRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMED_OUT');

CREATE TABLE "mn_routines" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "owner_id" VARCHAR NOT NULL,
    "visibility" "MnRoutineVisibility" NOT NULL DEFAULT 'PERSONAL',
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "cron_schedule" VARCHAR(120),
    "timezone" VARCHAR(64),
    "status" "MnRoutineStatus" NOT NULL DEFAULT 'ACTIVE',
    "anthropic_task_id" VARCHAR,
    "last_run_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_routines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mn_routines_workspace_id_visibility_status_idx"
    ON "mn_routines"("workspace_id", "visibility", "status");

CREATE INDEX "mn_routines_owner_id_idx"
    ON "mn_routines"("owner_id");

ALTER TABLE "mn_routines"
    ADD CONSTRAINT "mn_routines_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mn_routines"
    ADD CONSTRAINT "mn_routines_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mn_routine_runs" (
    "id" VARCHAR NOT NULL,
    "routine_id" VARCHAR NOT NULL,
    "triggered_by" VARCHAR,
    "trigger_type" "MnRoutineRunTrigger" NOT NULL,
    "status" "MnRoutineRunStatus" NOT NULL DEFAULT 'QUEUED',
    "output" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_routine_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mn_routine_runs_routine_id_created_at_idx"
    ON "mn_routine_runs"("routine_id", "created_at" DESC);

ALTER TABLE "mn_routine_runs"
    ADD CONSTRAINT "mn_routine_runs_routine_id_fkey"
    FOREIGN KEY ("routine_id") REFERENCES "mn_routines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
