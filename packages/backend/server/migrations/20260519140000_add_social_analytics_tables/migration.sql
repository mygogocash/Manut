-- Social analytics tables (SocialConnection, SocialEvent, SocialMetric,
-- SocialInsight, SocialAiBudget, SocialAuditLog).
--
-- The Prisma models existed in schema.prisma but no migration was ever
-- generated for them, so on Railway prod the tables never got created.
-- Symptom on 2026-05-19: AnalyticsResolver.getOverview and
-- ConnectionResolver.listConnections in the analytics plugin both crashed
-- on startup with `The table public.social_connections does not exist`
-- (and same for social_metrics). Frontend integrations panel surfaced the
-- error as a misleading "Failed to load calendar accounts" toast because
-- the panel fans out multiple queries in parallel.
--
-- All DDL uses idempotent guards (DO $$ EXCEPTION WHEN duplicate_object
-- for enums, IF NOT EXISTS for tables/indexes/foreign keys). Same pattern
-- as 07b557918 and 20260518230000.

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'THREADS', 'TIKTOK', 'LINE_VOOM', 'GOGOCASH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MetricBucket" AS ENUM ('HOUR', 'DAY', 'WEEK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "InsightType" AS ENUM ('WEEKLY_STRATEGY', 'TREND', 'ANOMALY', 'RECOMMENDATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'NOTABLE', 'ACTION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum: add new value to existing NotificationType (idempotent — IF NOT EXISTS works for ALTER TYPE since PG 12)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BudgetSoftCap';

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_connections" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "external_account_id" VARCHAR NOT NULL,
    "external_account_name" VARCHAR NOT NULL,
    "connected_by_user_id" VARCHAR NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "last_sync_at" TIMESTAMPTZ(3),
    "last_error_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_events" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "connection_id" VARCHAR NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "event_type" VARCHAR NOT NULL,
    "external_id" VARCHAR NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "social_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_metrics" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "metric_key" VARCHAR NOT NULL,
    "bucket" "MetricBucket" NOT NULL,
    "bucket_start" TIMESTAMPTZ(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "social_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_insights" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "insight_type" "InsightType" NOT NULL,
    "platforms" "SocialPlatform"[],
    "title" VARCHAR NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "model_used" VARCHAR NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(3),
    "acknowledged_by_id" VARCHAR,

    CONSTRAINT "social_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_ai_budget" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "month_year" VARCHAR NOT NULL,
    "spent_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cap_usd" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "social_ai_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_audit_logs" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "user_id" VARCHAR,
    "platform" "SocialPlatform" NOT NULL,
    "action" VARCHAR NOT NULL,
    "request_id" VARCHAR,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_connections_workspace_id_idx" ON "social_connections"("workspace_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_connections_status_expires_at_idx" ON "social_connections"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_workspace_id_platform_external_account_i_key" ON "social_connections"("workspace_id", "platform", "external_account_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_events_workspace_id_occurred_at_idx" ON "social_events"("workspace_id", "occurred_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_events_workspace_id_platform_event_type_occurred_at_idx" ON "social_events"("workspace_id", "platform", "event_type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_events_connection_id_external_id_event_type_key" ON "social_events"("connection_id", "external_id", "event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_metrics_workspace_id_platform_bucket_bucket_start_idx" ON "social_metrics"("workspace_id", "platform", "bucket", "bucket_start");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_metrics_workspace_id_platform_metric_key_bucket_buck_key" ON "social_metrics"("workspace_id", "platform", "metric_key", "bucket", "bucket_start");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_insights_workspace_id_created_at_idx" ON "social_insights"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_insights_workspace_id_insight_type_created_at_idx" ON "social_insights"("workspace_id", "insight_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_ai_budget_workspace_id_month_year_key" ON "social_ai_budget"("workspace_id", "month_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_audit_logs_workspace_id_created_at_idx" ON "social_audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_audit_logs_user_id_created_at_idx" ON "social_audit_logs"("user_id", "created_at");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
