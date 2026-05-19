-- M12 (MAXIMIZER mode) + M13 (Task plans) + M15 (CEO conversations) +
-- M17 (Org changes / self-organization proposals)
--
-- This migration is IDEMPOTENT — safe to retry against a partially-applied
-- DB. The `maximizer_mode` ALTER TABLE here duplicates the earlier
-- `20260518210000_add_mn_m12_maximizer_mode` migration; that file was
-- written first (M12 only) and this one was generated against an older
-- HEAD that hadn't yet picked it up, so the diff re-emitted the column
-- add. Production hit P3018:
--   ERROR: column "maximizer_mode" of relation "mn_agents" already exists
-- on Railway after `20260518210000` applied cleanly. Same class of bug
-- as `07b557918`'s fix to `20260518200000` (M9+M14).
--
-- All CREATE statements use IF NOT EXISTS / EXCEPTION WHEN duplicate_object
-- guards so the migration is safe to retry whether or not earlier steps
-- partially applied.

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnTaskPlanStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnCeoTurnRole" AS ENUM ('USER', 'CEO_AGENT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnCeoResolutionKind" AS ENUM ('NONE', 'TASK_CREATED', 'APPROVAL_REQUESTED', 'PLAN_DRAFTED', 'DECISION_RECORDED', 'BUDGET_QUERY', 'STATUS_QUERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnOrgChangeType" AS ENUM ('ROLE_ADJUSTMENT', 'DELEGATION_CHANGE', 'NEW_ROUTINE', 'AGENT_HIRE_PROPOSAL', 'REPORTING_CHANGE', 'CAPABILITY_GRANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MnOrgChangeStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent; already added by 20260518210000_add_mn_m12_maximizer_mode)
ALTER TABLE "mn_agents" ADD COLUMN IF NOT EXISTS "maximizer_mode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_task_plans" (
    "id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "body_md" TEXT NOT NULL,
    "status" "MnTaskPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "author_agent_id" VARCHAR,
    "author_user_id" VARCHAR,
    "reviewer_comments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_task_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_ceo_conversations" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "owner_user_id" VARCHAR NOT NULL,
    "title" VARCHAR,
    "last_resolution_kind" "MnCeoResolutionKind",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_ceo_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_ceo_turns" (
    "id" VARCHAR NOT NULL,
    "conversation_id" VARCHAR NOT NULL,
    "role" "MnCeoTurnRole" NOT NULL,
    "body_md" TEXT NOT NULL,
    "resolution_kind" "MnCeoResolutionKind" NOT NULL DEFAULT 'NONE',
    "resolution_ref_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_ceo_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_org_changes" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "type" "MnOrgChangeType" NOT NULL,
    "proposed_by_agent_id" VARCHAR,
    "status" "MnOrgChangeStatus" NOT NULL DEFAULT 'PROPOSED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "rationale" TEXT NOT NULL,
    "decision_note" TEXT,
    "decided_by_user_id" VARCHAR,
    "decided_at" TIMESTAMPTZ(3),
    "applied_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_org_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_task_plans_task_id_status_idx" ON "mn_task_plans"("task_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mn_task_plans_task_id_revision_number_key" ON "mn_task_plans"("task_id", "revision_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_ceo_conversations_workspace_id_owner_user_id_updated_at_idx" ON "mn_ceo_conversations"("workspace_id", "owner_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_ceo_turns_conversation_id_created_at_idx" ON "mn_ceo_turns"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_org_changes_workspace_id_status_created_at_idx" ON "mn_org_changes"("workspace_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_org_changes_workspace_id_project_id_status_idx" ON "mn_org_changes"("workspace_id", "project_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_org_changes_proposed_by_agent_id_idx" ON "mn_org_changes"("proposed_by_agent_id");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_task_plans" ADD CONSTRAINT "mn_task_plans_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "mn_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_task_plans" ADD CONSTRAINT "mn_task_plans_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_task_plans" ADD CONSTRAINT "mn_task_plans_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_ceo_conversations" ADD CONSTRAINT "mn_ceo_conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_ceo_conversations" ADD CONSTRAINT "mn_ceo_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_ceo_turns" ADD CONSTRAINT "mn_ceo_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "mn_ceo_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_org_changes" ADD CONSTRAINT "mn_org_changes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_org_changes" ADD CONSTRAINT "mn_org_changes_proposed_by_agent_id_fkey" FOREIGN KEY ("proposed_by_agent_id") REFERENCES "mn_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "mn_org_changes" ADD CONSTRAINT "mn_org_changes_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
