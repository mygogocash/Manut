-- M10 — Artifacts & Work Products.
--
-- First-class registry of meaningful task / agent outputs (docs,
-- files, URLs, PRs, deployments, CSV exports, screenshots). The
-- artifact itself stays in its source-of-truth system; this table
-- only stores the reference plus enough metadata to render and
-- re-open it.
--
-- Cascade semantics:
--   - taskId → Cascade. A work product without a task is meaningless;
--     deleting the task takes its registry rows with it.
--   - producedByAgentId → SetNull. Historical attribution survives
--     agent decommissioning; null producer = human or
--     since-deleted agent.
--
-- IF NOT EXISTS guards on enum / table creation so re-applying the
-- migration on a partially-migrated DB is safe (CLAUDE.md §1 deploy
-- hygiene; v1.10.x scar — removing IF NOT EXISTS from a migration
-- that already ran is R0).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MnWorkProductKind" AS ENUM (
    'DOC', 'FILE', 'URL', 'PR', 'DEPLOYMENT', 'CSV', 'SCREENSHOT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_work_products" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "produced_by_agent_id" VARCHAR,
    "kind" "MnWorkProductKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "byte_size" INTEGER,
    "title" VARCHAR,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_work_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_work_products_workspace_id_task_id_created_at_idx"
  ON "mn_work_products"("workspace_id", "task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_work_products_produced_by_agent_id_idx"
  ON "mn_work_products"("produced_by_agent_id");

-- AddForeignKey
ALTER TABLE "mn_work_products" ADD CONSTRAINT "mn_work_products_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_products" ADD CONSTRAINT "mn_work_products_produced_by_agent_id_fkey"
  FOREIGN KEY ("produced_by_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
