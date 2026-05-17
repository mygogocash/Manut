-- CreateEnum
CREATE TYPE "MnAgentAdapterType" AS ENUM ('COPILOT_CHAT_SESSION');

-- CreateEnum
CREATE TYPE "MnAgentStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MnHeartbeatInvocationSource" AS ENUM ('CHAT_TURN', 'MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "MnHeartbeatRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ai_sessions_metadata" ADD COLUMN     "agent_id" VARCHAR;

-- CreateTable
CREATE TABLE "mn_agents" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "role_id" VARCHAR,
    "name" VARCHAR NOT NULL,
    "adapter_type" "MnAgentAdapterType" NOT NULL DEFAULT 'COPILOT_CHAT_SESSION',
    "adapter_config" JSONB NOT NULL DEFAULT '{}',
    "runtime_config" JSONB NOT NULL DEFAULT '{}',
    "status" "MnAgentStatus" NOT NULL DEFAULT 'IDLE',
    "reports_to_agent_id" VARCHAR,
    "capabilities" TEXT,
    "last_heartbeat_at" TIMESTAMPTZ(3),
    "created_by_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_agent_api_keys" (
    "id" VARCHAR NOT NULL,
    "agent_id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "key_hash" VARCHAR NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_agent_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_heartbeat_runs" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "agent_id" VARCHAR NOT NULL,
    "invocation_source" "MnHeartbeatInvocationSource" NOT NULL,
    "status" "MnHeartbeatRunStatus" NOT NULL,
    "ai_session_id" VARCHAR,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "external_run_id" VARCHAR,
    "error" TEXT,

    CONSTRAINT "mn_heartbeat_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mn_agents_workspace_id_project_id_status_idx" ON "mn_agents"("workspace_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "mn_agents_workspace_id_reports_to_agent_id_idx" ON "mn_agents"("workspace_id", "reports_to_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "mn_agent_api_keys_key_hash_key" ON "mn_agent_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "mn_agent_api_keys_agent_id_idx" ON "mn_agent_api_keys"("agent_id");

-- CreateIndex
CREATE INDEX "mn_agent_api_keys_workspace_id_project_id_idx" ON "mn_agent_api_keys"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "mn_heartbeat_runs_workspace_id_agent_id_started_at_idx" ON "mn_heartbeat_runs"("workspace_id", "agent_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "mn_heartbeat_runs_ai_session_id_idx" ON "mn_heartbeat_runs"("ai_session_id");

-- AddForeignKey
ALTER TABLE "ai_sessions_metadata" ADD CONSTRAINT "ai_sessions_metadata_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agents" ADD CONSTRAINT "mn_agents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agents" ADD CONSTRAINT "mn_agents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agents" ADD CONSTRAINT "mn_agents_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "mn_agent_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agents" ADD CONSTRAINT "mn_agents_reports_to_agent_id_fkey" FOREIGN KEY ("reports_to_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agents" ADD CONSTRAINT "mn_agents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_agent_api_keys" ADD CONSTRAINT "mn_agent_api_keys_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_heartbeat_runs" ADD CONSTRAINT "mn_heartbeat_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_heartbeat_runs" ADD CONSTRAINT "mn_heartbeat_runs_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "ai_sessions_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

