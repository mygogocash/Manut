-- CreateEnum
CREATE TYPE "MnMemoryKind" AS ENUM ('FACT', 'DECISION', 'OBSERVATION', 'PLAYBOOK');

-- CreateEnum
CREATE TYPE "MnIntakeStatus" AS ENUM ('RECEIVED', 'ROUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MnWorkProductKind" AS ENUM ('DOC', 'FILE', 'URL', 'PR', 'DEPLOYMENT', 'CSV', 'SCREENSHOT');

-- AlterTable
ALTER TABLE "mn_tasks" ADD COLUMN     "definition_of_done" JSONB;

-- CreateTable
CREATE TABLE "mn_agent_memories" (
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
CREATE TABLE "mn_work_queues" (
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
CREATE TABLE "mn_work_queue_intakes" (
    "id" VARCHAR NOT NULL,
    "queue_id" VARCHAR NOT NULL,
    "external_ref" VARCHAR,
    "payload" JSONB NOT NULL,
    "status" "MnIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
    "routed_to_task_id" VARCHAR,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_work_queue_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_work_products" (
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
CREATE INDEX "mn_agent_memories_workspace_id_agent_id_importance_idx" ON "mn_agent_memories"("workspace_id", "agent_id", "importance" DESC);

-- CreateIndex
CREATE INDEX "mn_agent_memories_workspace_id_task_id_idx" ON "mn_agent_memories"("workspace_id", "task_id");

-- CreateIndex
CREATE UNIQUE INDEX "mn_work_queues_intake_webhook_token_key" ON "mn_work_queues"("intake_webhook_token");

-- CreateIndex
CREATE INDEX "mn_work_queues_workspace_id_idx" ON "mn_work_queues"("workspace_id");

-- CreateIndex
CREATE INDEX "mn_work_queues_project_id_idx" ON "mn_work_queues"("project_id");

-- CreateIndex
CREATE INDEX "mn_work_queues_default_assignee_agent_id_idx" ON "mn_work_queues"("default_assignee_agent_id");

-- CreateIndex
CREATE INDEX "mn_work_queue_intakes_queue_id_received_at_idx" ON "mn_work_queue_intakes"("queue_id", "received_at");

-- CreateIndex
CREATE INDEX "mn_work_queue_intakes_status_idx" ON "mn_work_queue_intakes"("status");

-- CreateIndex
CREATE INDEX "mn_work_queue_intakes_external_ref_idx" ON "mn_work_queue_intakes"("external_ref");

-- CreateIndex
CREATE INDEX "mn_work_products_workspace_id_task_id_created_at_idx" ON "mn_work_products"("workspace_id", "task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mn_work_products_produced_by_agent_id_idx" ON "mn_work_products"("produced_by_agent_id");

-- AddForeignKey
ALTER TABLE "mn_agent_memories" ADD CONSTRAINT "mn_agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agent_memories" ADD CONSTRAINT "mn_agent_memories_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_queues" ADD CONSTRAINT "mn_work_queues_default_assignee_agent_id_fkey" FOREIGN KEY ("default_assignee_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_queue_intakes" ADD CONSTRAINT "mn_work_queue_intakes_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "mn_work_queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_queue_intakes" ADD CONSTRAINT "mn_work_queue_intakes_routed_to_task_id_fkey" FOREIGN KEY ("routed_to_task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_products" ADD CONSTRAINT "mn_work_products_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_work_products" ADD CONSTRAINT "mn_work_products_produced_by_agent_id_fkey" FOREIGN KEY ("produced_by_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

