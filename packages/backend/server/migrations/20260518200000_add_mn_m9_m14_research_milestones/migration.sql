-- M9 (Memory) + M14 (Work Queues)
--
-- This migration was originally generated when M10 (MnWorkProduct) and M11
-- (definitionOfDone) had not yet been split into their own migration files,
-- so the diff included their content too. After the M10/M11 migrations were
-- added with earlier timestamps (20260518170000_add_mn_m11_definition_of_done
-- and 20260518180000_add_mn_m10_work_products), the duplicates here failed
-- production with: ERROR type "MnWorkProductKind" already exists (P3018).
--
-- This file now contains ONLY M9 + M14 entities. M10 and M11 ship via their
-- own migrations. All CREATE statements use IF NOT EXISTS / EXCEPTION
-- WHEN duplicate_object guards so the migration is idempotent — safe to
-- retry against a DB that partially applied the original broken version.

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnMemoryKind" AS ENUM ('FACT', 'DECISION', 'OBSERVATION', 'PLAYBOOK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnIntakeStatus" AS ENUM ('RECEIVED', 'ROUTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_agent_memories" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "agent_id" VARCHAR NOT NULL,
    "task_id" VARCHAR,
    "kind" "MnMemoryKind" NOT NULL,
    "content_md" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "retrieved_count" INTEGER NOT NULL DEFAULT 0,
    "last_retrieved_at" TIMESTAMPTZ(3),
    "importance" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_work_queues" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "intake_webhook_token" VARCHAR NOT NULL,
    "routing_rules" JSONB NOT NULL DEFAULT '[]',
    "default_assignee_agent_id" VARCHAR,
    "default_priority" "MnTaskPriority" NOT NULL DEFAULT 'LOW',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_work_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_work_queue_intakes" (
    "id" VARCHAR NOT NULL,
    "queue_id" VARCHAR NOT NULL,
    "external_ref" VARCHAR,
    "payload" JSONB NOT NULL,
    "status" "MnIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
    "routed_to_task_id" VARCHAR,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_work_queue_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "mn_agent_memories_workspace_id_agent_id_importance_idx" ON "mn_agent_memories"("workspace_id", "agent_id", "importance" DESC);
CREATE INDEX IF NOT EXISTS "mn_agent_memories_workspace_id_task_id_idx" ON "mn_agent_memories"("workspace_id", "task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mn_work_queues_intake_webhook_token_key" ON "mn_work_queues"("intake_webhook_token");
CREATE INDEX IF NOT EXISTS "mn_work_queues_workspace_id_idx" ON "mn_work_queues"("workspace_id");
CREATE INDEX IF NOT EXISTS "mn_work_queues_project_id_idx" ON "mn_work_queues"("project_id");
CREATE INDEX IF NOT EXISTS "mn_work_queues_default_assignee_agent_id_idx" ON "mn_work_queues"("default_assignee_agent_id");
CREATE INDEX IF NOT EXISTS "mn_work_queue_intakes_queue_id_received_at_idx" ON "mn_work_queue_intakes"("queue_id", "received_at");
CREATE INDEX IF NOT EXISTS "mn_work_queue_intakes_status_idx" ON "mn_work_queue_intakes"("status");
CREATE INDEX IF NOT EXISTS "mn_work_queue_intakes_external_ref_idx" ON "mn_work_queue_intakes"("external_ref");

-- AddForeignKey (idempotent — Postgres has no IF NOT EXISTS for ADD CONSTRAINT,
-- so each ALTER is wrapped in a duplicate_object catch)
DO $$ BEGIN
  ALTER TABLE "mn_agent_memories" ADD CONSTRAINT "mn_agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_agent_memories" ADD CONSTRAINT "mn_agent_memories_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_default_assignee_agent_id_fkey" FOREIGN KEY ("default_assignee_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_work_queue_intakes" ADD CONSTRAINT "mn_work_queue_intakes_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "mn_work_queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mn_work_queue_intakes" ADD CONSTRAINT "mn_work_queue_intakes_routed_to_task_id_fkey" FOREIGN KEY ("routed_to_task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
