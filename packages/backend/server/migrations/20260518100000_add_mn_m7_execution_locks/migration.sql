-- M7 — Atomic checkout + execution locks for MnTask
--
-- Adds two run-id slots on MnTask:
--   checkout_run_id     — soft reservation (queue dispatcher claim)
--   execution_run_id    — hard execution lock (set atomically via UPDATE
--                          ... WHERE ... in MnTaskCheckoutService.tryCheckout)
--   execution_locked_at — stale-lock cutoff (>5 min == re-acquirable)
--   execution_policy    — free-form policy JSONB (retry, approval, etc.)
--   execution_state     — free-form recovery state JSONB
--
-- Idempotent column adds via IF NOT EXISTS so re-applying this migration
-- on a partially-migrated DB is safe (CLAUDE.md §1 deploy hygiene).

-- AddColumn (idempotent guards)
ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "checkout_run_id" VARCHAR;
ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "execution_run_id" VARCHAR;
ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "execution_locked_at" TIMESTAMPTZ(3);
ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "execution_policy" JSONB;
ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "execution_state" JSONB;

-- CreateEnum (no IF NOT EXISTS for ENUMs; rely on Prisma migration table)
CREATE TYPE "MnExecutionRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "mn_execution_runs" (
    "id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "agent_id" VARCHAR,
    "status" "MnExecutionRunStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "mn_execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mn_tasks_execution_run_id_idx" ON "mn_tasks"("execution_run_id");
CREATE INDEX "mn_execution_runs_task_id_started_at_idx" ON "mn_execution_runs"("task_id", "started_at" DESC);
CREATE INDEX "mn_execution_runs_status_started_at_idx" ON "mn_execution_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "mn_execution_runs" ADD CONSTRAINT "mn_execution_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mn_execution_runs" ADD CONSTRAINT "mn_execution_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
