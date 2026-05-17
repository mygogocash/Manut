-- CreateEnum
CREATE TYPE "MnBudgetScope" AS ENUM ('WORKSPACE', 'PROJECT', 'AGENT', 'TASK', 'GOAL');

-- CreateEnum
CREATE TYPE "MnApprovalType" AS ENUM ('HIRE_AGENT', 'APPROVE_TASK_COMPLETION', 'BUDGET_OVERRIDE', 'REQUEST_BOARD_APPROVAL', 'TOOL_CALL_REVIEW', 'AGENT_ORG_CHANGE');

-- CreateEnum
CREATE TYPE "MnApprovalStatus" AS ENUM ('PENDING', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MnGoalLevel" AS ENUM ('PROJECT', 'TEAM', 'AGENT', 'TASK');

-- CreateEnum
CREATE TYPE "MnGoalStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ACHIEVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ai_sessions_metadata" ADD COLUMN     "task_id" VARCHAR;

-- AlterTable
ALTER TABLE "mn_tasks" ADD COLUMN     "assignee_agent_id" VARCHAR,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "completed_at" TIMESTAMPTZ(3),
ADD COLUMN     "goal_id" VARCHAR,
ADD COLUMN     "origin_run_id" VARCHAR,
ADD COLUMN     "parent_task_id" VARCHAR,
ADD COLUMN     "started_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "mn_cost_events" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR,
    "agent_id" VARCHAR,
    "task_id" VARCHAR,
    "goal_id" VARCHAR,
    "billing_code" VARCHAR,
    "provider" VARCHAR NOT NULL,
    "model" VARCHAR NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_cost_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_budgets" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR,
    "scope_type" "MnBudgetScope" NOT NULL,
    "scope_id" VARCHAR,
    "month_year" VARCHAR NOT NULL,
    "cap_cents" INTEGER NOT NULL,
    "spent_cents" INTEGER NOT NULL DEFAULT 0,
    "warn_threshold_pct" INTEGER NOT NULL DEFAULT 80,
    "hard_stop_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_approvals" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "type" "MnApprovalType" NOT NULL,
    "requested_by_agent_id" VARCHAR,
    "requested_by_user_id" VARCHAR,
    "status" "MnApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "decision_note" TEXT,
    "decided_by_user_id" VARCHAR,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_approval_comments" (
    "id" VARCHAR NOT NULL,
    "approval_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "author_agent_id" VARCHAR,
    "author_user_id" VARCHAR,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_goals" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "level" "MnGoalLevel" NOT NULL,
    "parent_goal_id" VARCHAR,
    "owner_agent_id" VARCHAR,
    "status" "MnGoalStatus" NOT NULL DEFAULT 'PLANNED',
    "created_by_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_task_blockers" (
    "id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "blocked_by_task_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_task_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mn_cost_events_workspace_id_occurred_at_idx" ON "mn_cost_events"("workspace_id", "occurred_at");

-- CreateIndex
CREATE INDEX "mn_cost_events_workspace_id_project_id_occurred_at_idx" ON "mn_cost_events"("workspace_id", "project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "mn_cost_events_workspace_id_agent_id_occurred_at_idx" ON "mn_cost_events"("workspace_id", "agent_id", "occurred_at");

-- CreateIndex
CREATE INDEX "mn_budgets_workspace_id_scope_type_idx" ON "mn_budgets"("workspace_id", "scope_type");

-- CreateIndex
CREATE UNIQUE INDEX "mn_budgets_workspace_id_scope_type_scope_id_month_year_key" ON "mn_budgets"("workspace_id", "scope_type", "scope_id", "month_year");

-- CreateIndex
CREATE INDEX "mn_approvals_workspace_id_status_created_at_idx" ON "mn_approvals"("workspace_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mn_approvals_workspace_id_project_id_status_idx" ON "mn_approvals"("workspace_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "mn_approvals_requested_by_agent_id_idx" ON "mn_approvals"("requested_by_agent_id");

-- CreateIndex
CREATE INDEX "mn_approval_comments_approval_id_created_at_idx" ON "mn_approval_comments"("approval_id", "created_at");

-- CreateIndex
CREATE INDEX "mn_goals_workspace_id_project_id_status_idx" ON "mn_goals"("workspace_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "mn_goals_workspace_id_level_idx" ON "mn_goals"("workspace_id", "level");

-- CreateIndex
CREATE INDEX "mn_goals_parent_goal_id_idx" ON "mn_goals"("parent_goal_id");

-- CreateIndex
CREATE INDEX "mn_goals_owner_agent_id_idx" ON "mn_goals"("owner_agent_id");

-- CreateIndex
CREATE INDEX "mn_task_blockers_project_id_idx" ON "mn_task_blockers"("project_id");

-- CreateIndex
CREATE INDEX "mn_task_blockers_blocked_by_task_id_idx" ON "mn_task_blockers"("blocked_by_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "mn_task_blockers_task_id_blocked_by_task_id_key" ON "mn_task_blockers"("task_id", "blocked_by_task_id");

-- CreateIndex
CREATE INDEX "mn_tasks_assignee_agent_id_idx" ON "mn_tasks"("assignee_agent_id");

-- CreateIndex
CREATE INDEX "mn_tasks_goal_id_idx" ON "mn_tasks"("goal_id");

-- CreateIndex
CREATE INDEX "mn_tasks_parent_task_id_idx" ON "mn_tasks"("parent_task_id");

-- AddForeignKey
ALTER TABLE "ai_sessions_metadata" ADD CONSTRAINT "ai_sessions_metadata_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_tasks" ADD CONSTRAINT "mn_tasks_assignee_agent_id_fkey" FOREIGN KEY ("assignee_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_tasks" ADD CONSTRAINT "mn_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "mn_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_tasks" ADD CONSTRAINT "mn_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_cost_events" ADD CONSTRAINT "mn_cost_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_cost_events" ADD CONSTRAINT "mn_cost_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_cost_events" ADD CONSTRAINT "mn_cost_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_cost_events" ADD CONSTRAINT "mn_cost_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_budgets" ADD CONSTRAINT "mn_budgets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_budgets" ADD CONSTRAINT "mn_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approvals" ADD CONSTRAINT "mn_approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approvals" ADD CONSTRAINT "mn_approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approvals" ADD CONSTRAINT "mn_approvals_requested_by_agent_id_fkey" FOREIGN KEY ("requested_by_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approvals" ADD CONSTRAINT "mn_approvals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approvals" ADD CONSTRAINT "mn_approvals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approval_comments" ADD CONSTRAINT "mn_approval_comments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "mn_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approval_comments" ADD CONSTRAINT "mn_approval_comments_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_approval_comments" ADD CONSTRAINT "mn_approval_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_goals" ADD CONSTRAINT "mn_goals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_goals" ADD CONSTRAINT "mn_goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "mn_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_goals" ADD CONSTRAINT "mn_goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "mn_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_goals" ADD CONSTRAINT "mn_goals_owner_agent_id_fkey" FOREIGN KEY ("owner_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_task_blockers" ADD CONSTRAINT "mn_task_blockers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_task_blockers" ADD CONSTRAINT "mn_task_blockers_blocked_by_task_id_fkey" FOREIGN KEY ("blocked_by_task_id") REFERENCES "mn_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

